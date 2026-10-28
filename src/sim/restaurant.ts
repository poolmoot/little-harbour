// Restaurant upgrades: tables, kitchen, waiters, decoration. See docs/superpowers/specs/2026-10-28-restaurant-and-big-ships-design.md.
import {
  REST_COST, REST_DECOR_INCOME, REST_KITCHEN_MULT, REST_MAX, REST_TABLES_EXTRA, REST_WAITERS_MIN_FRESH,
} from './config';
import type { RestTrack } from './config';
import { earnDrinks, spend } from './ledger';
import type { Check, Ev, GameState } from './state';

/** Price of the next level of a restaurant upgrade, or null when it is at the top. */
export function restCost(state: GameState, track: RestTrack): number | null {
  const lvl = state.restaurantUp[track];
  return lvl >= REST_MAX ? null : REST_COST[track][lvl + 1];
}

export function canUpgradeRest(state: GameState, track: RestTrack): Check {
  if (!state.buildings.restaurant) return { ok: false, reason: 'Build the restaurant first' };
  const cost = restCost(state, track);
  if (cost === null) return { ok: false, reason: 'Maxed' };
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost };
  return { ok: true, cost };
}

export function upgradeRest(state: GameState, track: RestTrack): Ev[] {
  const chk = canUpgradeRest(state, track);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot upgrade that.' }];
  spend(state, chk.cost!);
  state.restaurantUp[track] += 1;
  return [{ type: 'restUpgraded', track, level: state.restaurantUp[track] }];
}

/** Extra crates bought each day (Tables). */
export const restTablesExtra = (s: GameState): number => REST_TABLES_EXTRA[s.restaurantUp.tables];
/** The kitchen's price multiplier (Kitchen). */
export const restKitchenMult = (s: GameState): number => REST_KITCHEN_MULT[s.restaurantUp.kitchen];
/** The least fresh a fish may be to be bought (Waiters). */
export const restaurantMinFresh = (s: GameState): number => REST_WAITERS_MIN_FRESH[s.restaurantUp.waiters];
/** Drinks money each morning (Decoration). */
export const restDrinks = (s: GameState): number => (s.buildings.restaurant ? REST_DECOR_INCOME[s.restaurantUp.decor] : 0);

/** 06:00: guests' drinks money from the decoration. */
export function payDrinks(state: GameState): Ev[] {
  const amount = restDrinks(state);
  if (amount <= 0) return [];
  earnDrinks(state, amount);
  return [{ type: 'drinksPaid', amount }];
}
