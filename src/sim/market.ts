import {
  DEMAND_DROP, DEMAND_MIN, DEMAND_RECOVER, DEMAND_RECOVER_EVERY, FISH, ORDER_CRATE_MULT, SPECIES,
} from './config';
import type { Species } from './config';
import { freshnessMultiplier, handCrates, isSpoiled, removeCrate } from './crates';
import type { Crate, Ev, GameState } from './state';
import { creditOrder, matchingOrder } from './orders';

export function unitPrice(state: GameState, species: Species, freshness: number): number {
  return FISH[species].price * freshnessMultiplier(freshness) * state.demand[species];
}

/** What a crate would fetch right now (including the double for a matching order). */
export function crateValue(state: GameState, c: Crate): number {
  if (isSpoiled(c)) return 0;
  const base = unitPrice(state, c.species, c.freshness);
  return Math.round(matchingOrder(state, c.species) ? base * ORDER_CRATE_MULT : base);
}

export function recoverDemand(state: GameState, dt: number): void {
  state.demandTimer += dt;
  while (state.demandTimer >= DEMAND_RECOVER_EVERY) {
    state.demandTimer -= DEMAND_RECOVER_EVERY;
    for (const s of SPECIES) state.demand[s] = Math.min(1, state.demand[s] + DEMAND_RECOVER);
  }
}

export function sellCrate(state: GameState, crateId: number): Ev[] {
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'hand');
  if (!c) return [{ type: 'denied', reason: 'You are not carrying that.' }];
  const evs: Ev[] = [];
  if (isSpoiled(c)) {
    removeCrate(state, c.id);
    evs.push({ type: 'crateDiscarded', species: c.species });
    return evs;
  }
  const price = crateValue(state, c);
  const matched = matchingOrder(state, c.species) !== null;
  state.money += price;
  state.stats.earned += price;
  state.stats.sold += 1;
  const rec = state.book[c.species];
  rec.bestSale = Math.max(rec.bestSale, price);
  state.demand[c.species] = Math.max(DEMAND_MIN, state.demand[c.species] - DEMAND_DROP);
  removeCrate(state, c.id);
  evs.push({ type: 'crateSold', species: c.species, price, freshness: c.freshness, orderBonus: matched });
  if (matched) evs.push(...creditOrder(state, c.species));
  return evs;
}

export function sellAll(state: GameState): Ev[] {
  const crates = handCrates(state);
  if (crates.length === 0) return [{ type: 'denied', reason: 'You have nothing to sell.' }];
  const evs: Ev[] = [];
  // Most valuable first so matching-order doubles go to the best crates.
  const sorted = [...crates].sort((a, b) => crateValue(state, b) - crateValue(state, a));
  for (const c of sorted) evs.push(...sellCrate(state, c.id));
  return evs;
}
