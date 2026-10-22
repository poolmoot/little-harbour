import {
  CONTRACT_COOLDOWN_DAYS, CONTRACT_DAYS, CONTRACT_MAX_QTY, CONTRACT_MIN_QTY, CONTRACT_OFFERS, CONTRACT_RANK, CONTRACT_REWARD_MULT,
  CONTRACT_SAIL_HOURS, CONTRACT_SHARE, CONTRACT_TURNAROUND, DAY_REAL_SECONDS, DAY_SECONDS, FISH_PRICE, HOUR_SECONDS, SMOKED_MULT, ZONES, ZONE_IDS,
} from './config';
import type { Species, ZoneId } from './config';
import { holdSize, tripTimeFor, zoneUnlockedFor } from './fleet';
import { earnBonus } from './ledger';
import { rankOf } from './rank';
import type { Rng } from './rng';
import type { Contract, Crate, Ev, GameState } from './state';
import { nextId } from './state';

/** Crates per day (real seconds: the night passes faster) the fleet could bring from a zone if every boat that can reach it went there. */
export function zoneSupplyPerDay(state: GameState, zone: ZoneId): number {
  let n = 0;
  for (const b of state.boats) {
    if (!zoneUnlockedFor(b, zone)) continue;
    n += holdSize(b) * Math.floor(((CONTRACT_SAIL_HOURS * HOUR_SECONDS * DAY_REAL_SECONDS) / DAY_SECONDS) / (tripTimeFor(b, zone) + CONTRACT_TURNAROUND));
  }
  return n;
}

export function makeOffer(state: GameState, rng: Rng, avoid: Species[]): Contract | null {
  const options: { species: Species; share: number; zone: ZoneId }[] = [];
  for (const z of ZONE_IDS) {
    if (!state.boats.some((b) => zoneUnlockedFor(b, z))) continue;
    const table = ZONES[z].table;
    const total = Object.values(table).reduce((a, w) => a + (w ?? 0), 0);
    for (const sp of Object.keys(table) as Species[]) if (!avoid.includes(sp)) options.push({ species: sp, share: (table[sp] ?? 0) / total, zone: z });
  }
  if (options.length === 0) return null;
  const o = rng.pick(options);
  const days = rng.pick(CONTRACT_DAYS);
  const smoked = state.buildings.smokehouse > 0 && rng.next() < 0.5;
  const raw = zoneSupplyPerDay(state, o.zone) * o.share * days * CONTRACT_SHARE;
  const qty = Math.max(CONTRACT_MIN_QTY, Math.min(CONTRACT_MAX_QTY, Math.round(raw)));
  const baseValue = Math.round(qty * FISH_PRICE[o.species] * (smoked ? SMOKED_MULT : 1));
  return { id: nextId(state), species: o.species, smoked, qty, filled: 0, days, deadline: 0, reward: Math.round(baseValue * CONTRACT_REWARD_MULT), baseValue };
}

export const contractsUnlocked = (state: GameState): boolean => rankOf(state) >= CONTRACT_RANK;

/** Offer a fresh choice of two when the board is empty and no cool-down is running. Fail an active contract past its deadline. */
export function stepContracts(state: GameState, rng: Rng): Ev[] {
  const evs: Ev[] = [];
  const c = state.contracts;
  if (c.active && state.clock >= c.active.deadline) {
    evs.push({ type: 'contractFailed', contractId: c.active.id });
    c.active = null;
    c.coolUntil = state.clock + CONTRACT_COOLDOWN_DAYS * DAY_REAL_SECONDS;
  }
  if (!c.active && c.offers.length === 0 && contractsUnlocked(state) && state.clock >= c.coolUntil) {
    const avoid: Species[] = [];
    for (let i = 0; i < CONTRACT_OFFERS; i++) {
      const o = makeOffer(state, rng, avoid);
      if (!o) break;
      avoid.push(o.species);
      c.offers.push(o);
    }
    if (c.offers.length) evs.push({ type: 'contractOffered' });
  }
  return evs;
}

export function acceptContract(state: GameState, contractId: number): Ev[] {
  const c = state.contracts;
  if (c.active) return [{ type: 'denied', reason: 'You already have a contract.' }];
  const o = c.offers.find((x) => x.id === contractId);
  if (!o) return [{ type: 'denied', reason: 'That contract is gone.' }];
  o.deadline = state.clock + o.days * DAY_REAL_SECONDS;
  c.active = o;
  c.offers = [];
  return [{ type: 'contractAccepted', contractId }];
}

/** Count a crate sold at the market toward the active contract; pays the reward when it is finished. */
export function creditContract(state: GameState, crate: Crate): Ev[] {
  const a = state.contracts.active;
  if (!a || crate.species !== a.species || !!crate.smoked !== a.smoked || a.filled >= a.qty) return [];
  a.filled += 1;
  if (a.filled < a.qty) return [];
  earnBonus(state, a.reward);
  state.tally.contracts += 1;
  state.contracts.active = null;
  return [{ type: 'contractDone', contractId: a.id, reward: a.reward }];
}
