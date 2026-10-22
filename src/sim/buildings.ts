import {
  BUILDINGS, FISH_PRICE, RESTAURANT_CAPACITY, RESTAURANT_MIN_FRESH, RESTAURANT_MULT, RESTAURANT_VARIETY_BONUS,
  SMOKE_RACKS, SMOKE_SECONDS, SPECIES,
} from './config';
import { restaurantTownMult, saleTownMult } from './town';
import type { BuildingId, Species } from './config';
import { handCrates, isSpoiled, removeCrate, smokeCrates } from './crates';
import { earnSale, spend } from './ledger';
import { rankOf } from './rank';
import type { Check, Crate, Ev, GameState } from './state';
import { carryCapacity } from './crates';

export const buildingLevel = (state: GameState, id: BuildingId): number => state.buildings[id];
export const buildingMaxLevel = (id: BuildingId): number => BUILDINGS[id].cost.length - 1;

/** Price of the next level, or null when there is no next level. */
export function nextBuildingCost(state: GameState, id: BuildingId): number | null {
  const lvl = state.buildings[id];
  return lvl >= buildingMaxLevel(id) ? null : BUILDINGS[id].cost[lvl + 1];
}

export function canBuyBuilding(state: GameState, id: BuildingId): Check {
  const cost = nextBuildingCost(state, id);
  if (cost === null) return { ok: false, reason: 'Maxed' };
  const need = BUILDINGS[id].rank;
  if (rankOf(state) < need) return { ok: false, reason: 'Rank too low', needRank: need, cost };
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost };
  return { ok: true, cost };
}

/** Build on the plot (level 0 to 1) or upgrade (level up by one). */
export function buyBuilding(state: GameState, id: BuildingId): Ev[] {
  const chk = canBuyBuilding(state, id);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot build that.', needRank: chk.needRank }];
  spend(state, chk.cost!);
  state.buildings[id] += 1;
  return [{ type: 'buildingBuilt', id, level: state.buildings[id] }];
}

// ---- Smokehouse ----------------------------------------------------------------

export const smokeRacks = (state: GameState): number => SMOKE_RACKS[state.buildings.smokehouse];
export const smokeSeconds = (state: GameState): number => SMOKE_SECONDS[state.buildings.smokehouse];
/** Free racks. A rack stays taken until the smoked crate is collected. */
export const rackRoom = (state: GameState): number => smokeRacks(state) - smokeCrates(state).length;
export const readySmoked = (state: GameState): Crate[] => smokeCrates(state).filter((c) => c.smoked);

export function smokeCrate(state: GameState, crateId: number): Ev[] {
  if (!state.buildings.smokehouse) return [{ type: 'denied', reason: 'You need a smokehouse first.' }];
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'hand');
  if (!c) return [{ type: 'denied', reason: 'You are not carrying that.' }];
  if (c.smoked) return [{ type: 'denied', reason: 'That is already smoked.' }];
  if (c.king) return [{ type: 'denied', reason: 'Not the King Fish!' }];
  if (c.golden) return [{ type: 'denied', reason: 'A golden fish is too special to smoke. Sell it at the market.' }];
  if (isSpoiled(c)) return [{ type: 'denied', reason: 'That fish has gone bad.' }];
  if (rackRoom(state) <= 0) return [{ type: 'denied', reason: 'All racks are full.' }];
  startSmoking(state, c);
  return [{ type: 'crateSmoking', crateId }];
}

export function startSmoking(state: GameState, c: Crate): void {
  c.loc = 'smoke';
  c.smokeLeft = smokeSeconds(state);
  c.carrier = undefined;
  c.x = c.z = c.layer = undefined;
}

export function collectSmoked(state: GameState, crateId: number): Ev[] {
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'smoke');
  if (!c) return [{ type: 'denied', reason: 'Nothing there.' }];
  if (!c.smoked) return [{ type: 'denied', reason: 'Not ready yet.' }];
  if (handCrates(state).length >= carryCapacity(state)) return [{ type: 'denied', reason: 'Your hands are full.' }];
  c.loc = 'hand';
  c.smokeLeft = undefined;
  return [{ type: 'crateTaken', crateId }];
}

export function stepSmokehouse(state: GameState, dt: number): Ev[] {
  const evs: Ev[] = [];
  for (const c of smokeCrates(state)) {
    if (c.smoked || c.smokeLeft === undefined) continue;
    c.smokeLeft -= dt;
    if (c.smokeLeft <= 0) {
      c.smokeLeft = 0;
      c.smoked = true;
      c.freshness = 100;
      evs.push({ type: 'crateSmoked', crateId: c.id });
    }
  }
  return evs;
}

/** The player's list of fish that workers put in the smokehouse. */
export function setSmokeList(state: GameState, species: Species, on: boolean): Ev[] {
  if (!SPECIES.includes(species)) return [];
  const has = state.smokeList.includes(species);
  if (on && !has) state.smokeList.push(species);
  if (!on && has) state.smokeList = state.smokeList.filter((s) => s !== species);
  return [];
}

// ---- Restaurant ------------------------------------------------------------------

export const restaurantCapacity = (state: GameState): number => RESTAURANT_CAPACITY[state.buildings.restaurant];
export const restaurantRoom = (state: GameState): number => restaurantCapacity(state) - state.restaurant.served;

/** What the restaurant pays for this crate right now (ignores the market price level). */
export function restaurantPrice(state: GameState, c: Crate): number {
  const kindsBefore = state.restaurant.kinds.filter((k) => k !== c.species).length;
  return Math.round(FISH_PRICE[c.species] * RESTAURANT_MULT * (1 + RESTAURANT_VARIETY_BONUS * kindsBefore) * restaurantTownMult(state) * saleTownMult(state));
}

/** Would the restaurant buy this crate today? */
export function restaurantWants(state: GameState, c: Crate): boolean {
  return state.buildings.restaurant > 0 && restaurantRoom(state) > 0 && !c.smoked && !c.king && !c.golden && c.freshness >= RESTAURANT_MIN_FRESH;
}

export function serveRestaurantCrate(state: GameState, c: Crate, staff: boolean): Ev[] {
  if (!restaurantWants(state, c)) return [{ type: 'denied', reason: 'The restaurant does not want that now.' }];
  const price = restaurantPrice(state, c);
  earnSale(state, c.species, price);
  state.stats.sold += 1;
  state.tally.sold += 1;
  const rec = state.book[c.species];
  rec.bestSale = Math.max(rec.bestSale, price);
  state.restaurant.served += 1;
  if (!state.restaurant.kinds.includes(c.species)) state.restaurant.kinds.push(c.species);
  removeCrate(state, c.id);
  return [{ type: 'restaurantServed', species: c.species, price, staff }];
}

export function sellToRestaurant(state: GameState, crateId: number): Ev[] {
  if (!state.buildings.restaurant) return [{ type: 'denied', reason: 'You need a restaurant first.' }];
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'hand');
  if (!c) return [{ type: 'denied', reason: 'You are not carrying that.' }];
  if (c.freshness < RESTAURANT_MIN_FRESH && !c.smoked) return [{ type: 'denied', reason: 'The restaurant wants fresher fish.' }];
  return serveRestaurantCrate(state, c, false);
}

/** New day: the restaurant starts serving again. */
export function resetRestaurant(state: GameState): void {
  state.restaurant = { served: 0, kinds: [] };
}
