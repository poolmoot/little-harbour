// A greedy scripted player that drives the pure simulation. Used by the pacing test and for tuning costs.
import { Rng } from './rng';
import type { Track } from './config';
import { dispatchBoat, unloadBoat } from './boats';
import { buyBuilding, canBuyBuilding, collectSmoked, readySmoked, rackRoom, restaurantWants, sellToRestaurant, setSmokeList, smokeCrate } from './buildings';
import { acceptContract } from './contracts';
import { deliverKingFish } from './ending';
import { canRepair, repairBoat } from './storm';
import { cancelCast, castLine, hook } from './fishing';
import { bestZone, buyBoat, buyBoatUpgrade, canBuyBoat, canUpgradeBoat, reachableZones, tripCostFor } from './fleet';
import { carryCapacity, dockCrates, handCrates, pickUp } from './crates';
import { crateValue, sellAll } from './market';
import { canHireCaptain, canHireDockhand, dailyUpkeep, dailyWages, hireCaptain, hireDockhand, setBoatTarget } from './staff';
import { captainWage } from './captains';
import { buyProject, canBuyProject } from './town';
import { canUpgradeRest, upgradeRest } from './restaurant';
import { initialState } from './state';
import type { GameState } from './state';
import { startGame, step } from './sim';
import { buyUpgrade, canBuy } from './upgrades';
import { BUILDINGS, BUILDING_IDS, GOALS, PROJECT_IDS, PROJECTS, REST_TRACKS, SPECIES, UPGRADES, UPGRADE_IDS } from './config';
import type { BuildingId } from './config';

export interface BotResult {
  rankMinutes: (number | null)[];
  /** Minutes when the King Fish was caught and when it was carried to the inn. */
  kingMinutes: number | null;
  deliveredMinutes: number | null;
  /** Minutes when each goal was finished. */
  goalMinutes: (number | null)[];
  /** Longest stretch (minutes) without buying, hiring or building anything, finishing a goal, or finishing a contract. */
  longestGap: number;
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
  const goalMinutes: (number | null)[] = GOALS.map(() => null);
  let kingMinutes: number | null = null;
  let deliveredMinutes: number | null = null;
  let lastBuy = 0, longestGap = 0;
  const gaps: string[] = [];
  const bought = () => { if (s.buildings.lighthouse > 0) return; const g = (s.clock - lastBuy) / 60; if (g > 3) gaps.push(`${(lastBuy / 60).toFixed(1)}->${(s.clock / 60).toFixed(1)}`); longestGap = Math.max(longestGap, g); lastBuy = s.clock; };
  let lastGoal = 0, lastContracts = 0;
  let busy = 0;
  const logbook: string[] = [];

  /** Money kept back so every boat can afford its next trip. */
  const reserve = () => s.boats.reduce((a, b) => a + tripCostFor(bestZone(b), b), 0);

  const shop = (): boolean => {
    type Opt = { cost: number; go: () => void; pay?: boolean; later?: boolean };
    const opts: Opt[] = [];
    for (const id of UPGRADE_IDS) {
      if (canBuy(s, id).ok) opts.push({ cost: UPGRADES[id].cost, go: () => { buyUpgrade(s, id); logbook.push(`${(s.clock / 60).toFixed(1)}m ${id}`); } });
    }
    for (const b of s.boats) {
      for (const t of ['hull', 'hold', 'gear', 'sails'] as Track[]) {
        const c = canUpgradeBoat(s, b.id, t);
        if (c.ok) opts.push({ cost: c.cost!, go: () => { buyBoatUpgrade(s, b.id, t); if (t === 'hull') { b.target = bestZone(b); } logbook.push(`${(s.clock / 60).toFixed(1)}m ${b.name} ${t}${b[t]}`); } });
      }
    }
    for (const id of BUILDING_IDS) {
      // The lighthouse is the road to the King Fish: only once the fleet is worth night trips.
      if (id === 'lighthouse' && s.boats.filter((b) => b.hull >= 3).length < 2) continue;
      const c = canBuyBuilding(s, id);
      if (c.ok) opts.push({ cost: c.cost!, pay: id === 'smokehouse' || id === 'restaurant' || id === 'lighthouse', go: () => { buyBuilding(s, id as BuildingId); if (id === 'smokehouse') for (const sp of SPECIES) setSmokeList(s, sp, true); logbook.push(`${(s.clock / 60).toFixed(1)}m ${id}${s.buildings[id]}`); } });
    }
    // Restaurant upgrades: they earn money, so they are bought like anything else once the restaurant stands.
    for (const t of REST_TRACKS) {
      const c = canUpgradeRest(s, t);
      if (c.ok) opts.push({ cost: c.cost!, go: () => { upgradeRest(s, t); logbook.push(`${(s.clock / 60).toFixed(1)}m restaurant ${t}${s.restaurantUp[t]}`); } });
    }
    // Town projects: only once nothing else is left to buy, so they fill the late game.
    for (const id of PROJECT_IDS) {
      if (canBuyProject(s, id).reason === 'Done' || canBuyProject(s, id).needRank) continue;
      opts.push({ cost: PROJECTS[id].cost, later: true, go: () => { buyProject(s, id); logbook.push(`${(s.clock / 60).toFixed(1)}m town ${id}`); } });
    }
    const bb = canBuyBoat(s);
    if (bb.ok) opts.push({ cost: bb.cost!, go: () => { buyBoat(s); logbook.push(`${(s.clock / 60).toFixed(1)}m boat`); } });
    // Save up for the first restaurant once it is open, as a player with that goal would.
    const target = (['restaurant'] as BuildingId[]).find((id) => s.buildings[id] === 0 && !canBuyBuilding(s, id).needRank && canBuyBuilding(s, id).reason !== 'Maxed');
    if (target && s.money < BUILDINGS[target].cost[1]) return false;
    const spare = s.money - reserve();
    // Buildings that earn money are bought as soon as they can be paid for; everything else cheapest first.
    opts.sort((a, b) => Number(!!a.later) - Number(!!b.later) || Number(!!b.pay) - Number(!!a.pay) || a.cost - b.cost);
    if (opts.length === 0 || opts[0].cost > spare) return false;
    // Greedy: the cheapest thing that raises income. Wait for it if it is not yet affordable? No: only buy what we can afford.
    opts[0].go();
    bought();
    return true;
  };

  const hires = () => {
    // Staff only once there is a cash cushion, so wages never starve the upgrade fund.
    const wageBill = dailyWages(s) + dailyUpkeep(s);
    const cushion = 150 + wageBill * 3;
    if (s.money < cushion) return;
    if (canHireCaptain(s, s.boats.find((b) => !b.captain)?.id ?? 0).ok && s.boats.some((b) => !b.captain) && s.candidates.length) {
      const boat = s.boats.filter((b) => !b.captain).sort((a, b) => b.hold + b.hull - (a.hold + a.hull))[0];
      const pick = [...s.candidates].sort((a, b) => captainWage(a, boat.hull) - captainWage(b, boat.hull))[0];
      hireCaptain(s, pick.id, boat.id);
      bought();
      logbook.push(`${(s.clock / 60).toFixed(1)}m captain ${boat.name}`);
      return;
    }
    if (canHireDockhand(s).ok && s.dockhands.length < s.boats.length + 1) {
      hireDockhand(s, rng);
      bought();
      logbook.push(`${(s.clock / 60).toFixed(1)}m dockhand`);
    }
  };

  /** Sell what is in hand: the restaurant for fresh fish, the smokehouse for fish on the list, otherwise the market. */
  const sellHand = () => {
    const wanted = s.contracts.active;
    for (const c of [...handCrates(s)].sort((a, b) => crateValue(s, b) - crateValue(s, a))) {
      if (c.king) continue;
      const forContract = wanted && wanted.species === c.species;
      if (forContract && wanted!.smoked && !c.smoked && rackRoom(s) > 0 && s.buildings.smokehouse) { smokeCrate(s, c.id); continue; }
      if (forContract && !wanted!.smoked) continue; // sold at the market below, so it counts
      if (!c.smoked && restaurantWants(s, c)) { sellToRestaurant(s, c.id); continue; }
      if (!c.smoked && !forContract && s.buildings.smokehouse && rackRoom(s) > 0 && s.smokeList.includes(c.species)) smokeCrate(s, c.id);
    }
    if (handCrates(s).some((c) => !c.king)) sellAll(s);
  };

  for (let t = 0; t < maxMinutes * 60; t += DT) {
    step(s, DT, rng);
    for (let r = 1; r < 5; r++) if (rankMinutes[r] === null && s.rank >= r) rankMinutes[r] = s.clock / 60;
    for (let g = 0; g < GOALS.length; g++) if (goalMinutes[g] === null && s.goal > g) goalMinutes[g] = s.clock / 60;
    if (s.goal !== lastGoal || s.tally.contracts !== lastContracts) { lastGoal = s.goal; lastContracts = s.tally.contracts; bought(); }
    if (kingMinutes === null && s.king.found) kingMinutes = s.clock / 60;
    if (deliveredMinutes !== null) break;
    busy -= DT;
    // Fishing is a state machine we only keep while idle.
    if (s.fishing.phase === 'bite') { hook(s, rng); continue; }
    if (busy > 0) continue;
    // 0. the King Fish: straight to the inn
    if (handCrates(s).some((c) => c.king)) {
      if (deliverKingFish(s)[0].type === 'endingReached') { deliveredMinutes = s.clock / 60; busy = 10; }
      continue;
    }
    // 1. boats: fix broken ones, unload, send out; choose to sail in storms once a repair is affordable
    let acted = false;
    for (const b of s.boats) {
      b.stayInStorms = s.money < 400;
      if (b.damaged && b.status === 'docked' && canRepair(s, b.id).ok) { repairBoat(s, b.id); acted = true; busy = 1; }
    }
    for (const b of s.boats) {
      if (b.captain && !b.captain.unpaid) continue;
      if (b.status === 'returned') { cancelCast(s); unloadBoat(s, b.id); acted = true; busy = 1.5; }
      else if (b.status === 'docked' && !b.damaged) {
        // The best zone this boat can reach and the player can pay for.
        const zone = reachableZones(b).filter((z) => tripCostFor(z, b) <= s.money).pop();
        if (zone === undefined) continue;
        setBoatTarget(s, b.id, zone);
        if (dispatchBoat(s, b.id, zone)[0].type === 'boatDispatched') { cancelCast(s); acted = true; busy = 1.5; }
      }
    }
    if (acted) continue;
    // 1b. contracts: take the one that asks for fresh fish if there is a choice, then the smaller one
    if (!s.contracts.active && s.contracts.offers.length) {
      const pick = [...s.contracts.offers].sort((a, b) => Number(a.smoked) - Number(b.smoked) || a.qty - b.qty)[0];
      acceptContract(s, pick.id);
    }
    // 2. hands full of fish: sell
    const hand = handCrates(s);
    if (hand.length >= carryCapacity(s) || (hand.length > 0 && dockCrates(s).filter((c) => c.carrier === undefined).length === 0)) {
      sellHand();
      busy = tune.haulSeconds * 0.5;
      continue;
    }
    // 2b. smoked crates that are ready: collect and sell
    if (hand.length === 0 && readySmoked(s).length) {
      for (const c of readySmoked(s).slice(0, carryCapacity(s))) collectSmoked(s, c.id);
      sellAll(s);
      busy = tune.haulSeconds * 0.5;
      continue;
    }
    // 2c. shop & hire whenever something can be paid for (boats now sail all night too, so there is no quiet moment to wait for)
    hires();
    if (shop()) { busy = tune.shopSeconds; continue; }
    // 3. haul dock crates (best first)
    const free = dockCrates(s).filter((c) => c.carrier === undefined && c.freshness > 0);
    if (free.length) {
      cancelCast(s);
      free.sort((a, b) => (b.king ? 1e9 : crateValue(s, b)) - (a.king ? 1e9 : crateValue(s, a)));
      for (const c of free.slice(0, carryCapacity(s) - hand.length)) pickUp(s, c.id);
      busy = tune.haulSeconds * 0.5;
      continue;
    }
    // 5. fish off the pier
    if (s.fishing.phase === 'idle') castLine(s, rng);
  }
  if (log) log(logbook.join('\n') + '\nGAPS over 3 min: ' + gaps.join(', '));
  return { rankMinutes, kingMinutes, deliveredMinutes, goalMinutes, longestGap, minutes: s.clock / 60, state: s };
}
