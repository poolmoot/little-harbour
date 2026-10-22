import {
  BOAT_COST, BOAT_NAMES, GEAR_MULT, HOLD_SIZES, HULL_EXTRA_CRATES, LUCKY_MULT, MAX_BOATS, SAILS_MULT, SWIFT_MULT, TIER_COST_MULT,
  TRACK_COST, TRACK_LEVEL_HULL, TRACK_MAX, ZONES, ZONE_IDS,
} from './config';
import type { Track, ZoneId } from './config';
import { levelCatchMult, levelSpeedMult } from './captains';
import { spend } from './ledger';
import { hullRank, maxBoats, maxHullTier, rankOf } from './rank';
import { newBoat, nextId } from './state';
import type { Boat, Captain, Check, Ev, GameState } from './state';

/** The captain, if one is aboard and was paid today. */
export const activeCaptain = (b: Boat): Captain | null => (b.captain && !b.captain.unpaid ? b.captain : null);
export const holdSize = (b: Boat): number => HOLD_SIZES[b.hold] + HULL_EXTRA_CRATES[b.hull] + (activeCaptain(b)?.trait === 'careful' ? 1 : 0);
export const rareMult = (b: Boat): number => {
  const c = activeCaptain(b);
  return GEAR_MULT[b.gear] * (c?.trait === 'lucky' ? LUCKY_MULT : 1) * (c ? levelCatchMult(c) : 1);
};
export const tripTimeFor = (b: Boat, zone: ZoneId): number => {
  const c = activeCaptain(b);
  return ZONES[zone].trip * SAILS_MULT[b.sails] * (c?.trait === 'swift' ? SWIFT_MULT : 1) * (c ? levelSpeedMult(c) : 1);
};
/** Food, supplies and ice paid when a boat leaves for this zone: a fixed part plus a part for each crate it can carry. */
export const tripCostFor = (zone: ZoneId, b?: Boat): number =>
  Math.round(ZONES[zone].tripCost + ZONES[zone].crateCost * (b ? holdSize(b) : HOLD_SIZES[0]));
export const zoneUnlockedFor = (b: Boat, zone: ZoneId): boolean => b.hull >= ZONES[zone].needsHull;

/** Zones this boat's hull can reach, best last. */
export const reachableZones = (b: Boat): ZoneId[] => ZONE_IDS.filter((z) => zoneUnlockedFor(b, z));
export const bestZone = (b: Boat): ZoneId => {
  const z = reachableZones(b);
  return z[z.length - 1];
};
export const maxHullOwned = (state: GameState): number => state.boats.reduce((m, b) => Math.max(m, b.hull), 0);

/** Cost of the next level of a track, or null when maxed. */
export function trackCost(b: Boat, track: Track): number | null {
  const lvl = b[track];
  if (lvl >= TRACK_MAX[track]) return null;
  const base = TRACK_COST[track][lvl + 1];
  return track === 'hull' ? base : Math.round(base * TIER_COST_MULT[b.hull]);
}

/** The Boat size the next level of this track needs, or null when this boat is big enough (or the track is done). */
export function needsHullFor(b: Boat, track: Track): number | null {
  const need = TRACK_LEVEL_HULL[track][b[track] + 1];
  return need !== undefined && b.hull < need ? need : null;
}

export function canUpgradeBoat(state: GameState, boatId: number, track: Track): Check {
  const b = state.boats.find((x) => x.id === boatId);
  if (!b) return { ok: false, reason: 'No such boat' };
  const cost = trackCost(b, track);
  if (cost === null) return { ok: false, reason: 'Maxed' };
  if (track === 'hull' && b.hull + 1 > maxHullTier(rankOf(state))) {
    return { ok: false, reason: 'Rank too low', needRank: hullRank(b.hull + 1), cost };
  }
  const needHull = needsHullFor(b, track);
  if (needHull !== null) return { ok: false, reason: 'Boat too small', needHull, cost };
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost };
  return { ok: true, cost };
}

export function buyBoatUpgrade(state: GameState, boatId: number, track: Track): Ev[] {
  const chk = canUpgradeBoat(state, boatId, track);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot upgrade that.', needRank: chk.needRank }];
  const b = state.boats.find((x) => x.id === boatId)!;
  spend(state, chk.cost!);
  b[track] += 1;
  return [{ type: 'boatUpgraded', boatId, track, level: b[track] }];
}

export function nextBoatCost(state: GameState): number | null {
  return state.boats.length >= MAX_BOATS ? null : BOAT_COST[state.boats.length];
}

export function canBuyBoat(state: GameState): Omit<Check, 'cost'> & { cost: number | null } {
  const cost = nextBoatCost(state);
  if (cost === null) return { ok: false, reason: 'No room for more', cost };
  if (state.boats.length >= maxBoats(rankOf(state))) {
    return { ok: false, reason: 'Rank too low', needRank: state.boats.length, cost };
  }
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost };
  return { ok: true, cost };
}

export function buyBoat(state: GameState): Ev[] {
  const chk = canBuyBoat(state);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot buy a boat.', needRank: chk.needRank }];
  spend(state, chk.cost!);
  let berth = 0;
  while (state.boats.some((b) => b.berth === berth)) berth++;
  const used = new Set(state.boats.map((b) => b.name));
  const name = BOAT_NAMES.find((n) => !used.has(n)) ?? `Boat ${berth + 1}`;
  const boat = newBoat(nextId(state), berth, name);
  state.boats.push(boat);
  return [{ type: 'boatBought', boatId: boat.id }];
}
