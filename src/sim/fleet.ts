import {
  BOAT_COST, BOAT_NAMES, GEAR_MULT, HOLD_SIZES, HULL_NAMES, LUCKY_MULT, MAX_BOATS, SAILS_MULT, SWIFT_MULT, TIER_COST_MULT,
  TRACK_COST, TRACK_MAX, TRACK_NAMES, ZONES, ZONE_IDS,
} from './config';
import type { Track, ZoneId } from './config';
import { spend } from './ledger';
import { maxBoats, maxHullTier, rankOf } from './rank';
import { newBoat, nextId } from './state';
import type { Boat, Captain, Ev, GameState } from './state';

/** The captain, if one is aboard and was paid today. */
export const activeCaptain = (b: Boat): Captain | null => (b.captain && !b.captain.unpaid ? b.captain : null);
export const holdSize = (b: Boat): number => HOLD_SIZES[b.hold] + (activeCaptain(b)?.trait === 'careful' ? 1 : 0);
export const rareMult = (b: Boat): number => GEAR_MULT[b.gear] * (activeCaptain(b)?.trait === 'lucky' ? LUCKY_MULT : 1);
export const tripTimeFor = (b: Boat, zone: ZoneId): number =>
  ZONES[zone].trip * SAILS_MULT[b.sails] * (activeCaptain(b)?.trait === 'swift' ? SWIFT_MULT : 1);
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

/** Plain-language effect of moving a track from its current level to the next. */
export function trackNote(b: Boat, track: Track): string {
  const l = b[track];
  if (l >= TRACK_MAX[track]) return 'Fully upgraded';
  switch (track) {
    case 'hull': return `${HULL_NAMES[l + 1]}: a bigger boat that can reach ${ZONES[ZONE_IDS[l + 1]].name}`;
    case 'hold': return `Carries ${HOLD_SIZES[l + 1]} crates instead of ${HOLD_SIZES[l]}`;
    case 'gear': return `Rare fish ×${GEAR_MULT[l + 1]} (now ×${GEAR_MULT[l]}); nets on the rail`;
    case 'sails': return `Trips ×${SAILS_MULT[l + 1]} the time (now ×${SAILS_MULT[l]}); ${l === 0 ? 'a bigger sail' : 'a second sail and pennant'}`;
  }
}

export function canUpgradeBoat(state: GameState, boatId: number, track: Track): { ok: boolean; reason?: string; cost?: number } {
  const b = state.boats.find((x) => x.id === boatId);
  if (!b) return { ok: false, reason: 'No such boat' };
  const cost = trackCost(b, track);
  if (cost === null) return { ok: false, reason: 'Maxed' };
  if (b.status !== 'docked') return { ok: false, reason: 'Boat must be in harbour', cost };
  if (track === 'hull' && b.hull + 1 > maxHullTier(rankOf(state))) {
    return { ok: false, reason: `Needs rank: ${['', 'Boat Owner', 'Skipper & Co', 'Fleet Master'][b.hull + 1]}`, cost };
  }
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost };
  return { ok: true, cost };
}

export function buyBoatUpgrade(state: GameState, boatId: number, track: Track): Ev[] {
  const chk = canUpgradeBoat(state, boatId, track);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'Cannot upgrade that.' }];
  const b = state.boats.find((x) => x.id === boatId)!;
  spend(state, chk.cost!);
  b[track] += 1;
  return [{ type: 'boatUpgraded', boatId, track, level: b[track] }];
}

export function nextBoatCost(state: GameState): number | null {
  return state.boats.length >= MAX_BOATS ? null : BOAT_COST[state.boats.length];
}

export function canBuyBoat(state: GameState): { ok: boolean; reason?: string; cost: number | null } {
  const cost = nextBoatCost(state);
  if (cost === null) return { ok: false, reason: 'Fleet is full', cost };
  if (state.boats.length >= maxBoats(rankOf(state))) {
    return { ok: false, reason: `Needs rank: ${['', 'Boat Owner', 'Skipper & Co', 'Fleet Master'][state.boats.length]}`, cost };
  }
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost };
  return { ok: true, cost };
}

export function buyBoat(state: GameState): Ev[] {
  const chk = canBuyBoat(state);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'Cannot buy a boat.' }];
  spend(state, chk.cost!);
  let berth = 0;
  while (state.boats.some((b) => b.berth === berth)) berth++;
  const used = new Set(state.boats.map((b) => b.name));
  const name = BOAT_NAMES.find((n) => !used.has(n)) ?? `Boat ${berth + 1}`;
  const boat = newBoat(nextId(state), berth, name);
  state.boats.push(boat);
  return [{ type: 'boatBought', boatId: boat.id }];
}

export { TRACK_NAMES };
