import { UPGRADES } from './config';
import type { UpgradeId } from './config';
import { spend } from './ledger';
import { rankOf } from './rank';
import { RANK_NAMES } from './config';
import type { Ev, GameState } from './state';

export function canBuy(state: GameState, id: UpgradeId): { ok: boolean; reason?: string } {
  const u = UPGRADES[id];
  if (state.upgrades[id]) return { ok: false, reason: 'Owned' };
  if (rankOf(state) < u.rank) return { ok: false, reason: `Needs rank: ${RANK_NAMES[u.rank]}` };
  if (u.requires && !state.upgrades[u.requires]) return { ok: false, reason: `Needs ${UPGRADES[u.requires].name}` };
  if (state.money < u.cost) return { ok: false, reason: 'Not enough money' };
  return { ok: true };
}

/** Harbour-wide purchases: ice box, handcart, market stall. Boats are bought through fleet.ts. */
export function buyUpgrade(state: GameState, id: UpgradeId): Ev[] {
  const check = canBuy(state, id);
  if (!check.ok) return [{ type: 'denied', reason: check.reason ?? 'Cannot buy that.' }];
  spend(state, UPGRADES[id].cost);
  state.upgrades[id] = true;
  return [{ type: 'upgradeBought', id }];
}
