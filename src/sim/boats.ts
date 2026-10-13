import { KING_CHANCE, STORM_CATCH_MULT, STORM_DAMAGE_CHANCE } from './config';
import type { Species, ZoneId } from './config';
import { rollCatch } from './catch';
import { addCrate } from './crates';
import { holdSize, rareMult, tripCostFor, tripTimeFor, zoneUnlockedFor } from './fleet';
import { spendOnTrip } from './ledger';
import type { Rng } from './rng';
import type { Boat, Ev, GameState } from './state';
import { isNight, phaseOf } from './time';
import { bigCatchExtra, isStorm, isStormZone, weatherTripMult } from './weather';

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
  if (boat.damaged) return [{ type: 'denied', reason: 'This boat is broken. Fix it at the shipyard.' }];
  if (isNight(state) && !state.buildings.lighthouse) return [{ type: 'denied', reason: 'It is too dark to go out. Wait for morning.' }];
  if (!zoneUnlockedFor(boat, z)) return [{ type: 'denied', reason: 'This boat is too small to go there.' }];
  if (isStorm(state) && boat.stayInStorms && isStormZone(z)) return [{ type: 'denied', reason: 'There is a storm. This boat stays home.' }];
  const cost = tripCostFor(z);
  if (state.money < cost) return [{ type: 'denied', reason: `Not enough money for the trip. It costs $${cost}.` }];
  spendOnTrip(state, cost);
  boat.status = 'out';
  boat.zone = z;
  boat.target = z;
  boat.progress = 0;
  boat.tripTime = tripTimeFor(boat, z) * weatherTripMult(state);
  boat.tripWeather = state.weather;
  boat.tripBonus = bigCatchExtra(state, z);
  boat.nightTrip = isNight(state);
  boat.catch = [];
  state.tally.dispatched += 1;
  state.tally.zoneSent[z] += 1;
  return [{ type: 'boatDispatched', boatId, zone: z, cost, auto }];
}

export function recordCaught(state: GameState, species: Species): void {
  state.book[species].caught += 1;
}

export function rollBoatCatch(state: GameState, boat: Boat, rng: Rng): Species[] {
  const zone = boat.zone ?? 'shallows';
  let n = holdSize(boat);
  if (boat.tripWeather === 'storm' && isStormZone(zone)) n = Math.round(n * STORM_CATCH_MULT);
  n += boat.tripBonus ?? 0;
  return rollCatch(zone, phaseOf(state.dayTime), n, rng, rareMult(boat));
}

function returnBoat(state: GameState, boat: Boat, rng: Rng): Ev[] {
  boat.status = 'returned';
  boat.progress = boat.tripTime;
  const evs: Ev[] = [];
  const zone = boat.zone ?? 'shallows';
  const stormTrip = boat.tripWeather === 'storm' && isStormZone(zone);
  if (stormTrip && rng.next() < STORM_DAMAGE_CHANCE) {
    boat.catch = [];
    boat.damaged = true;
    evs.push({ type: 'boatDamaged', boatId: boat.id });
  } else {
    boat.catch = rollBoatCatch(state, boat, rng);
    for (const s of boat.catch) recordCaught(state, s);
    if (stormTrip) state.tally.storm += 1;
    // The King Fish: a night trip to the Deep Sea with the lighthouse lit.
    if (zone === 'deep' && boat.nightTrip && state.buildings.lighthouse > 0 && !state.king.found && rng.next() < KING_CHANCE * rareMult(boat)) {
      boat.king = true;
      state.king.found = true;
      state.king.day = state.day;
      evs.push({ type: 'kingFishFound', boatId: boat.id });
    }
  }
  evs.unshift({ type: 'boatReturned', boatId: boat.id, count: boat.catch.length, auto: !!boat.captain && !boat.captain.unpaid });
  return evs;
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
  if (boat.king) {
    const k = addCrate(state, 'sturgeon', 'dock', boat.berth);
    k.king = true;
    boat.king = false;
  }
  boat.catch = [];
  if (n > 0) state.tally.unloaded += 1;
  boat.status = 'docked';
  boat.zone = null;
  boat.progress = 0;
  return [{ type: 'boatUnloaded', boatId, count: n, auto }];
}

