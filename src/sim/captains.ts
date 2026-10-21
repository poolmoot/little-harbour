// Captain experience and pay. See docs/superpowers/specs/2026-10-21-money-depth-design.md.
import {
  CAPTAIN_LEVEL_CATCH, CAPTAIN_LEVEL_SPEED, CAPTAIN_LEVEL_TRIPS, CAPTAIN_LEVEL_WAGE, CAPTAIN_MAX_LEVEL, CAPTAIN_WAGE_BY_HULL,
  THRIFTY_MULT,
} from './config';
import type { Captain, Ev, GameState } from './state';
import { captainLearnMult } from './town';

/** Level 1..5 from the trips finished. */
export function captainLevel(c: Pick<Captain, 'trips'>): number {
  const t = c.trips ?? 0;
  let lvl = 1;
  for (let i = 1; i < CAPTAIN_MAX_LEVEL; i++) if (t >= CAPTAIN_LEVEL_TRIPS[i]) lvl = i + 1;
  return lvl;
}

/** Trips still needed for the next level, or null at the top. */
export function tripsToNextLevel(c: Pick<Captain, 'trips'>): number | null {
  const lvl = captainLevel(c);
  return lvl >= CAPTAIN_MAX_LEVEL ? null : CAPTAIN_LEVEL_TRIPS[lvl] - (c.trips ?? 0);
}

/** Pay a day for this captain on a boat with this hull. */
export function captainWage(c: Pick<Captain, 'trips' | 'trait'>, hull: number): number {
  const lvl = captainLevel(c);
  const base = CAPTAIN_WAGE_BY_HULL[Math.max(0, Math.min(CAPTAIN_WAGE_BY_HULL.length - 1, hull))];
  return Math.round(base * (1 + CAPTAIN_LEVEL_WAGE * (lvl - 1)) * (c.trait === 'thrifty' ? THRIFTY_MULT : 1));
}

/** Better fish from experience (multiplies Nets and Lucky). */
export const levelCatchMult = (c: Pick<Captain, 'trips'>): number => 1 + CAPTAIN_LEVEL_CATCH * (captainLevel(c) - 1);
/** Shorter trips from experience. */
export const levelSpeedMult = (c: Pick<Captain, 'trips'>): number => 1 - CAPTAIN_LEVEL_SPEED * (captainLevel(c) - 1);

/** A captain finished a trip: count it, and say so when they reach a new level. */
export function noteCaptainTrip(state: GameState, boatId: number): Ev[] {
  const b = state.boats.find((x) => x.id === boatId);
  const c = b?.captain;
  if (!b || !c || c.unpaid) return [];
  const before = captainLevel(c);
  c.trips = (c.trips ?? 0) + captainLearnMult(state);
  const after = captainLevel(c);
  return after > before ? [{ type: 'captainLevelUp', boatId, name: c.name, level: after }] : [];
}
