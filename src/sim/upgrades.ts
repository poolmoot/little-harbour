import { UPGRADES } from './config';
import type { UpgradeId } from './config';
import { spend } from './ledger';
import { rankOf } from './rank';
import type { Check, Ev, GameState } from './state';

export function canBuy(state: GameState, id: UpgradeId): Check {
  const u = UPGRADES[id];
  if (state.upgrades[id]) return { ok: false, reason: 'Owned' };
  if (rankOf(state) < u.rank) return { ok: false, reason: 'Rank too low', needRank: u.rank };
  if (u.requires && !state.upgrades[u.requires]) return { ok: false, reason: 'Buy the smaller one first' };
  if (state.money < u.cost) return { ok: false, reason: 'Not enough money' };
  return { ok: true };
}

/** Harbour-wide purchases: handcart, market stall. Boats are bought through fleet.ts. */
export function buyUpgrade(state: GameState, id: UpgradeId): Ev[] {
  const check = canBuy(state, id);
  if (!check.ok) return [{ type: 'denied', reason: check.reason ?? 'You cannot buy that.', needRank: check.needRank }];
  spend(state, UPGRADES[id].cost);
  state.upgrades[id] = true;
  return [{ type: 'upgradeBought', id }];
}
