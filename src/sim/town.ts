// Town projects: big one-time purchases with a lasting bonus. See docs/superpowers/specs/2026-10-21-money-depth-design.md.
import {
  BANDSTAND_GOLDEN_MULT, FAIR_MARKET_DAY_MULT, HALL_RECOVER_MULT, HOUSES_RESTAURANT_MULT, PROJECTS, ROAD_SPEED_MULT,
  SCHOOL_TRIPS_MULT, STATUE_SALE_MULT, WALL_DAMAGE_MULT,
} from './config';
import type { ProjectId } from './config';
import { spend } from './ledger';
import { rankOf } from './rank';
import type { Check, Ev, GameState } from './state';

export const projectDone = (state: GameState, id: ProjectId): boolean => !!state.town[id];

export function canBuyProject(state: GameState, id: ProjectId): Check {
  const p = PROJECTS[id];
  if (projectDone(state, id)) return { ok: false, reason: 'Done' };
  if (rankOf(state) < p.rank) return { ok: false, reason: 'Rank too low', needRank: p.rank, cost: p.cost };
  if (state.money < p.cost) return { ok: false, reason: 'Not enough money', cost: p.cost };
  return { ok: true, cost: p.cost };
}

export function buyProject(state: GameState, id: ProjectId): Ev[] {
  const chk = canBuyProject(state, id);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot pay for that.', needRank: chk.needRank }];
  spend(state, chk.cost!);
  state.town[id] = true;
  return [{ type: 'projectDone', id }];
}

const bonus = (state: GameState, id: ProjectId, mult: number): number => (projectDone(state, id) ? mult : 1);

/** The lasting bonuses, read by the rules they change. */
export const workerSpeedMult = (s: GameState): number => bonus(s, 'road', ROAD_SPEED_MULT);
export const demandRecoverMult = (s: GameState): number => bonus(s, 'hall', HALL_RECOVER_MULT);
export const restaurantTownMult = (s: GameState): number => bonus(s, 'houses', HOUSES_RESTAURANT_MULT);
export const marketDayMult = (s: GameState): number => bonus(s, 'fair', FAIR_MARKET_DAY_MULT);
export const stormDamageMult = (s: GameState): number => bonus(s, 'wall', WALL_DAMAGE_MULT);
export const captainLearnMult = (s: GameState): number => bonus(s, 'school', SCHOOL_TRIPS_MULT);
export const goldenTownMult = (s: GameState): number => bonus(s, 'bandstand', BANDSTAND_GOLDEN_MULT);
export const saleTownMult = (s: GameState): number => bonus(s, 'statue', STATUE_SALE_MULT);
