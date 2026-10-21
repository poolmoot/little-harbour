import {
  DEMAND_DROPS, DEMAND_MIN, DEMAND_RECOVER, DEMAND_RECOVER_EVERY, FISH_PRICE, GOLDEN_MULT, ORDER_CRATE_MULT, SMOKED_MULT, SPECIES,
} from './config';
import type { Species } from './config';
import { freshnessMultiplier, handCrates, isSpoiled, removeCrate } from './crates';
import type { Crate, Ev, GameState } from './state';
import { crateSize, crateWorth, sizeMult } from './fishbook';
import { earnSale } from './ledger';
import { creditOrder, matchingOrder } from './orders';
import { creditContract } from './contracts';
import { marketMult } from './weather';
import { demandRecoverMult, saleTownMult } from './town';

export function unitPrice(state: GameState, species: Species, freshness: number): number {
  return FISH_PRICE[species] * freshnessMultiplier(freshness) * state.demand[species] * marketMult(state) * saleTownMult(state);
}

/** Smoked fish: a higher price that ignores freshness. */
export function smokedPrice(state: GameState, species: Species): number {
  return FISH_PRICE[species] * SMOKED_MULT * state.demand[species] * marketMult(state) * saleTownMult(state);
}

/** What a crate would fetch right now (including the double for a matching order). */
export function crateValue(state: GameState, c: Crate): number {
  if (isSpoiled(c)) return 0;
  if (c.king) return 0;
  const base = (c.smoked ? smokedPrice(state, c.species) : unitPrice(state, c.species, c.freshness)) * crateWorth(c);
  return Math.round(matchingOrder(state, c.species) ? base * ORDER_CRATE_MULT : base);
}

/** One line of a price, in money: what changed it and by how much. */
export type PriceKind = 'base' | 'smoked' | 'fresh' | 'size' | 'golden' | 'demand' | 'marketDay' | 'town' | 'order';
export interface PricePart { kind: PriceKind; amount: number }

/**
 * A crate's price as plain money steps, for the market window: the normal price, then each thing that moves it up or down.
 * Each step is rounded on its own; the last step takes any rounding left over, so the steps always add up to crateValue.
 */
export function priceParts(state: GameState, c: Crate): PricePart[] {
  const base = FISH_PRICE[c.species];
  const steps: [PriceKind, number][] = [
    c.smoked ? ['smoked', SMOKED_MULT] : ['fresh', freshnessMultiplier(c.freshness)],
    ['size', sizeMult(c.species, crateSize(c))],
    ['golden', c.golden ? GOLDEN_MULT : 1],
    ['demand', state.demand[c.species]],
    ['marketDay', marketMult(state)],
    ['town', saleTownMult(state)],
    ['order', matchingOrder(state, c.species) ? ORDER_CRATE_MULT : 1],
  ];
  const parts: PricePart[] = [{ kind: 'base', amount: base }];
  let value = base, shown = base;
  for (const [kind, mult] of steps) {
    value *= mult;
    const amount = Math.round(value) - shown;
    shown += amount;
    if (amount !== 0) parts.push({ kind, amount });
  }
  const total = crateValue(state, c);
  if (total !== shown) parts[parts.length - 1].amount += total - shown;
  return parts;
}

/** How much the price of a fish is down right now because a lot of it was sold (money, for a full-fresh crate). */
export const demandLoss = (state: GameState, species: Species): number =>
  Math.round(FISH_PRICE[species] * marketMult(state) * saleTownMult(state)) - Math.round(unitPrice(state, species, 100));

export function recoverDemand(state: GameState, dt: number): void {
  state.demandTimer += dt;
  while (state.demandTimer >= DEMAND_RECOVER_EVERY) {
    state.demandTimer -= DEMAND_RECOVER_EVERY;
    for (const s of SPECIES) state.demand[s] = Math.min(1, state.demand[s] + DEMAND_RECOVER * demandRecoverMult(state));
  }
}

export const stallLevel = (state: GameState): number => (state.upgrades.stall2 ? 2 : state.upgrades.stall1 ? 1 : 0);

/** Sell a crate wherever it is (hand or in a dockhand's arms). */
export function sellCrateObj(state: GameState, c: Crate, staff: boolean): Ev[] {
  const evs: Ev[] = [];
  if (c.king) return [{ type: 'denied', reason: 'The King Fish is not for sale. Take it to the inn.' }];
  if (isSpoiled(c)) {
    removeCrate(state, c.id);
    evs.push({ type: 'crateDiscarded', species: c.species });
    return evs;
  }
  const price = crateValue(state, c);
  const matched = matchingOrder(state, c.species) !== null;
  earnSale(state, c.species, price);
  state.stats.sold += 1;
  state.tally.sold += 1;
  const rec = state.book[c.species];
  rec.bestSale = Math.max(rec.bestSale, price);
  state.demand[c.species] = Math.max(DEMAND_MIN, state.demand[c.species] - DEMAND_DROPS[stallLevel(state)]);
  removeCrate(state, c.id);
  evs.push({ type: 'crateSold', species: c.species, price, freshness: c.freshness, orderBonus: matched, staff });
  evs.push(...creditContract(state, c));
  if (matched) evs.push(...creditOrder(state, c.species));
  return evs;
}

export function sellCrate(state: GameState, crateId: number): Ev[] {
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'hand');
  if (!c) return [{ type: 'denied', reason: 'You are not carrying that.' }];
  return sellCrateObj(state, c, false);
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
