import type { Species } from './config';
import type { GameState } from './state';

/** Every coin earned goes through here so the day's ledger and lifetime earnings stay in step. */
export function earnSale(state: GameState, species: Species, price: number): void {
  state.money += price;
  state.lifetime += price;
  const st = state.stats;
  st.earned += price;
  st.income[species] += price;
  if (price > st.best.price) st.best = { species, price };
}

export function earnBonus(state: GameState, amount: number): void {
  state.money += amount;
  state.lifetime += amount;
  state.stats.earned += amount;
  state.stats.bonus += amount;
}

export function spend(state: GameState, amount: number): void {
  state.money -= amount;
  state.stats.spent += amount;
}

/** Food and supplies paid when a boat leaves. */
export function spendOnTrip(state: GameState, amount: number): void {
  state.money -= amount;
  state.stats.tripCosts += amount;
}

export function netProfit(st: { earned: number; wages: number; tripCosts: number; spent: number }): number {
  return st.earned - st.wages - st.tripCosts - st.spent;
}
