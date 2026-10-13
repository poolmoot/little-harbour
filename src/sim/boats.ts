import type { Species, ZoneId } from './config';
import { rollCatch } from './catch';
import { addCrate } from './crates';
import { holdSize, rareMult, tripCostFor, tripTimeFor, zoneUnlockedFor } from './fleet';
import { spendOnTrip } from './ledger';
import type { Rng } from './rng';
import type { Boat, Ev, GameState } from './state';
import { isNight, phaseOf } from './time';

export { zoneUnlockedFor };
/** Does any owned boat's hull reach this zone? */
export function zoneUnlocked(state: GameState, zone: ZoneId): boolean {
  return state.boats.some((b) => zoneUnlockedFor(b, zone));
}

export function dispatchBoat(state: GameState, boatId: number, zone?: ZoneId, auto = false): Ev[] {
  const boat = state.boats.find((b) => b.id === boatId);
  if (!boat) return [{ type: 'denied', reason: 'No such boat.' }];
  const z = zone ?? boat.target;
  if (boat.status === 'out') return [{ type: 'denied', reason: 'That boat is already out at sea.' }];
  if (boat.status === 'returned') return [{ type: 'denied', reason: 'Unload the boat first.' }];
  if (isNight(state)) return [{ type: 'denied', reason: 'It is too dark to go out. Wait for morning.' }];
  if (!zoneUnlockedFor(boat, z)) return [{ type: 'denied', reason: 'This boat is too small to go there.' }];
  const cost = tripCostFor(z);
  if (state.money < cost) return [{ type: 'denied', reason: `Not enough money for the trip. It costs $${cost}.` }];
  spendOnTrip(state, cost);
  boat.status = 'out';
  boat.zone = z;
  boat.target = z;
  boat.progress = 0;
  boat.tripTime = tripTimeFor(boat, z);
  boat.catch = [];
  return [{ type: 'boatDispatched', boatId, zone: z, cost, auto }];
}

export function recordCaught(state: GameState, species: Species): void {
  state.book[species].caught += 1;
}

export function rollBoatCatch(state: GameState, boat: Boat, rng: Rng): Species[] {
  return rollCatch(boat.zone ?? 'shallows', phaseOf(state.dayTime), holdSize(boat), rng, rareMult(boat));
}

function returnBoat(state: GameState, boat: Boat, rng: Rng): Ev[] {
  boat.status = 'returned';
  boat.progress = boat.tripTime;
  boat.catch = rollBoatCatch(state, boat, rng);
  for (const s of boat.catch) recordCaught(state, s);
  return [{ type: 'boatReturned', boatId: boat.id, count: boat.catch.length, auto: !!boat.captain && !boat.captain.unpaid }];
}

export function stepBoats(state: GameState, dt: number, rng: Rng): Ev[] {
  const evs: Ev[] = [];
  for (const b of state.boats) {
    if (b.status !== 'out') continue;
    b.progress += dt;
    if (b.progress >= b.tripTime) evs.push(...returnBoat(state, b, rng));
  }
  return evs;
}

export function unloadBoat(state: GameState, boatId: number, auto = false): Ev[] {
  const boat = state.boats.find((b) => b.id === boatId);
  if (!boat || boat.status !== 'returned') return [{ type: 'denied', reason: 'Nothing to unload.' }];
  const n = boat.catch.length;
  for (const s of boat.catch) addCrate(state, s, 'dock', boat.berth);
  boat.catch = [];
  boat.status = 'docked';
  boat.zone = null;
  boat.progress = 0;
  return [{ type: 'boatUnloaded', boatId, count: n, auto }];
}

