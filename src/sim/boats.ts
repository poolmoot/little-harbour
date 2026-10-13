import { ZONES } from './config';
import type { ZoneId } from './config';
import { rollCatch } from './catch';
import { addCrate } from './crates';
import type { Rng } from './rng';
import { holdSize } from './state';
import type { Boat, Ev, GameState } from './state';
import { isNight, phaseOf } from './time';

export function zoneUnlocked(state: GameState, zone: ZoneId): boolean {
  return !ZONES[zone].needsHull || state.upgrades.hull;
}

export function dispatchBoat(state: GameState, boatId: number, zone: ZoneId): Ev[] {
  const boat = state.boats.find((b) => b.id === boatId);
  if (!boat) return [{ type: 'denied', reason: 'No such boat.' }];
  if (boat.status === 'out') return [{ type: 'denied', reason: 'That boat is already at sea.' }];
  if (boat.status === 'returned') return [{ type: 'denied', reason: 'Unload the boat first.' }];
  if (isNight(state)) return [{ type: 'denied', reason: 'Too dark to sail. Wait for dawn.' }];
  if (!zoneUnlocked(state, zone)) return [{ type: 'denied', reason: 'You need the reinforced hull for that zone.' }];
  boat.status = 'out';
  boat.zone = zone;
  boat.progress = 0;
  boat.tripTime = ZONES[zone].trip;
  boat.catch = [];
  return [{ type: 'boatDispatched', boatId, zone }];
}

export function recordCaught(state: GameState, species: import('./config').Species): void {
  state.book[species].caught += 1;
}

function returnBoat(state: GameState, boat: Boat, rng: Rng): Ev[] {
  boat.status = 'returned';
  boat.progress = boat.tripTime;
  boat.catch = rollCatch(boat.zone ?? 'shallows', phaseOf(state.dayTime), holdSize(state), rng);
  for (const s of boat.catch) recordCaught(state, s);
  return [{ type: 'boatReturned', boatId: boat.id, count: boat.catch.length }];
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

export function unloadBoat(state: GameState, boatId: number): Ev[] {
  const boat = state.boats.find((b) => b.id === boatId);
  if (!boat || boat.status !== 'returned') return [{ type: 'denied', reason: 'Nothing to unload.' }];
  const n = boat.catch.length;
  for (const s of boat.catch) addCrate(state, s, 'dock', boat.berth);
  boat.catch = [];
  boat.status = 'docked';
  boat.zone = null;
  boat.progress = 0;
  return [{ type: 'boatUnloaded', boatId, count: n }];
}
