// A greedy scripted player that drives the pure simulation. Used by the pacing test and for tuning costs.
import { Rng } from './rng';
import { RANK_NAMES } from './config';
import type { Track } from './config';
import { dispatchBoat, unloadBoat } from './boats';
import { cancelCast, castLine, hook } from './fishing';
import { bestZone, buyBoat, buyBoatUpgrade, canBuyBoat, canUpgradeBoat } from './fleet';
import { carryCapacity, dockCrates, handCrates, pickUp } from './crates';
import { crateValue, sellAll } from './market';
import { canHireCaptain, canHireDockhand, hireCaptain, hireDockhand, setBoatTarget } from './staff';
import { initialState } from './state';
import type { GameState } from './state';
import { startGame, step } from './sim';
import { buyUpgrade, canBuy } from './upgrades';
import { UPGRADE_IDS } from './config';
import { isNight } from './time';

export interface BotResult {
  rankMinutes: (number | null)[];
  minutes: number;
  state: GameState;
}

export interface BotTuning {
  /** Seconds the player spends on a pier-to-market haul. */
  haulSeconds: number;
  /** Seconds of attention a shopping trip costs. */
  shopSeconds: number;
}
export const DEFAULT_TUNING: BotTuning = { haulSeconds: 10, shopSeconds: 5 };

export function runBot(seed: number, maxMinutes: number, tune: BotTuning = DEFAULT_TUNING, log?: (s: string) => void): BotResult {
  const rng = new Rng(seed);
  const s = initialState();
  startGame(s, rng);
  const DT = 0.25;
  const rankMinutes: (number | null)[] = [0, null, null, null, null];
  let busy = 0;
  const logbook: string[] = [];

  const shop = (): boolean => {
    type Opt = { cost: number; go: () => void };
    const opts: Opt[] = [];
    for (const id of UPGRADE_IDS) {
      if (id === 'icebox') continue;
      if (canBuy(s, id).ok) opts.push({ cost: id === 'handcart' ? 200 : id === 'stall1' ? 2000 : 9000, go: () => { buyUpgrade(s, id); logbook.push(`${(s.clock / 60).toFixed(1)}m ${id}`); } });
    }
    for (const b of s.boats) {
      for (const t of ['hull', 'hold', 'gear', 'sails'] as Track[]) {
        const c = canUpgradeBoat(s, b.id, t);
        if (c.ok) opts.push({ cost: c.cost!, go: () => { buyBoatUpgrade(s, b.id, t); if (t === 'hull') { b.target = bestZone(b); } logbook.push(`${(s.clock / 60).toFixed(1)}m ${b.name} ${t}${b[t]}`); } });
      }
    }
    const bb = canBuyBoat(s);
    if (bb.ok) opts.push({ cost: bb.cost!, go: () => { buyBoat(s); logbook.push(`${(s.clock / 60).toFixed(1)}m boat`); } });
    opts.sort((a, b) => a.cost - b.cost);
    if (opts.length === 0) return false;
    // Greedy: the cheapest thing that raises income. Wait for it if it is not yet affordable? No: only buy what we can afford.
    opts[0].go();
    return true;
  };

  const hires = () => {
    // Staff only once there is a cash cushion, so wages never starve the upgrade fund.
    const wageBill = s.dockhands.length * 25 + s.boats.reduce((a, b) => a + (b.captain?.wage ?? 0), 0);
    const cushion = 150 + wageBill * 3;
    if (s.money < cushion) return;
    if (canHireCaptain(s, s.boats.find((b) => !b.captain)?.id ?? 0).ok && s.boats.some((b) => !b.captain) && s.candidates.length) {
      const boat = s.boats.filter((b) => !b.captain).sort((a, b) => b.hold + b.hull - (a.hold + a.hull))[0];
      const pick = [...s.candidates].sort((a, b) => a.wage - b.wage)[0];
      hireCaptain(s, pick.id, boat.id);
      logbook.push(`${(s.clock / 60).toFixed(1)}m captain ${boat.name}`);
      return;
    }
    if (canHireDockhand(s).ok && s.dockhands.length < s.boats.length + 1) {
      hireDockhand(s, rng);
      logbook.push(`${(s.clock / 60).toFixed(1)}m dockhand`);
    }
  };

  for (let t = 0; t < maxMinutes * 60; t += DT) {
    step(s, DT, rng);
    for (let r = 1; r < 5; r++) if (rankMinutes[r] === null && s.rank >= r) rankMinutes[r] = s.clock / 60;
    if (s.rank >= 4 && maxMinutes > 0 && rankMinutes[4] !== null) break;
    busy -= DT;
    // Fishing is a state machine we only keep while idle.
    if (s.fishing.phase === 'bite') { hook(s, rng); continue; }
    if (busy > 0) continue;
    // 1. boats
    let acted = false;
    for (const b of s.boats) {
      if (b.captain && !b.captain.unpaid) continue;
      if (b.status === 'returned') { cancelCast(s); unloadBoat(s, b.id); acted = true; busy = 1.5; }
      else if (b.status === 'docked' && !isNight(s)) {
        if (b.target !== bestZone(b)) setBoatTarget(s, b.id, bestZone(b));
        if (dispatchBoat(s, b.id, b.target)[0].type === 'boatDispatched') { cancelCast(s); acted = true; busy = 1.5; }
      }
    }
    if (acted) continue;
    // 2. hands full of fish: sell
    const hand = handCrates(s);
    if (hand.length >= carryCapacity(s) || (hand.length > 0 && dockCrates(s).filter((c) => c.carrier === undefined).length === 0)) {
      sellAll(s);
      busy = tune.haulSeconds * 0.5;
      continue;
    }
    // 3. haul dock crates (best first)
    const free = dockCrates(s).filter((c) => c.carrier === undefined && c.freshness > 0);
    if (free.length) {
      cancelCast(s);
      free.sort((a, b) => crateValue(s, b) - crateValue(s, a));
      for (const c of free.slice(0, carryCapacity(s) - hand.length)) pickUp(s, c.id);
      busy = tune.haulSeconds * 0.5;
      continue;
    }
    // 4. shop & hire
    hires();
    if (shop()) { busy = tune.shopSeconds; continue; }
    // 5. fish off the pier
    if (s.fishing.phase === 'idle') castLine(s, rng);
  }
  if (log) log(logbook.join('\n'));
  return { rankMinutes, minutes: s.clock / 60, state: s };
}

export { RANK_NAMES };
