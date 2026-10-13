import { UPGRADES } from './config';
import type { UpgradeId } from './config';
import type { Ev, GameState } from './state';
import { nextId } from './state';

export function canBuy(state: GameState, id: UpgradeId): { ok: boolean; reason?: string } {
  const u = UPGRADES[id];
  if (state.upgrades[id]) return { ok: false, reason: 'Owned' };
  if (u.requires && !state.upgrades[u.requires]) return { ok: false, reason: `Needs ${UPGRADES[u.requires].name}` };
  if (state.money < u.cost) return { ok: false, reason: 'Not enough money' };
  return { ok: true };
}

export function buyUpgrade(state: GameState, id: UpgradeId): Ev[] {
  const check = canBuy(state, id);
  if (!check.ok) return [{ type: 'denied', reason: check.reason ?? 'Cannot buy that.' }];
  state.money -= UPGRADES[id].cost;
  state.upgrades[id] = true;
  if (id === 'boat2') {
    state.boats.push({ id: nextId(state), berth: 1, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [] });
  }
  return [{ type: 'upgradeBought', id }];
}
