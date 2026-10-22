import { BIG_HULL_RANK, MAX_BOATS, RANK_THRESHOLDS, TOP_RANK, TRACK_MAX } from './config';
import type { Ev, GameState } from './state';

export function rankIndex(lifetime: number): number {
  let r = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) if (lifetime >= RANK_THRESHOLDS[i]) r = i;
  return r;
}

export const rankOf = (state: GameState): number => rankIndex(state.lifetime);

/** Progress to the next rank: fraction 0..1, plus what is needed. Null at the top rank. */
export function rankProgress(state: GameState): { frac: number; next: number; need: number; have: number } | null {
  const r = rankOf(state);
  if (r >= TOP_RANK) return null;
  const lo = RANK_THRESHOLDS[r], hi = RANK_THRESHOLDS[r + 1];
  return { frac: Math.max(0, Math.min(1, (state.lifetime - lo) / (hi - lo))), next: r + 1, need: hi, have: Math.floor(state.lifetime) };
}

/** How many boats may be owned at this rank. */
export const maxBoats = (rank: number): number => Math.min(MAX_BOATS, rank + 1);
/** Highest hull tier that may be bought at this rank. */
export const maxHullTier = (rank: number): number => (rank >= BIG_HULL_RANK ? TRACK_MAX.hull : Math.min(3, rank));
/** The rank a Boat size level needs. */
export const hullRank = (level: number): number => (level > 3 ? BIG_HULL_RANK : level);
export const DOCKHANDS_RANK = 1;
export const CAPTAINS_RANK = 1;
export const dockhandsUnlocked = (rank: number): boolean => rank >= DOCKHANDS_RANK;
export const captainsUnlocked = (rank: number): boolean => rank >= CAPTAINS_RANK;

/** Announce rank-ups (called every step; the rank is derived from lifetime earnings). */
export function stepRank(state: GameState): Ev[] {
  const r = rankOf(state);
  if (r <= state.rank) return [];
  const evs: Ev[] = [];
  while (state.rank < r) {
    state.rank += 1;
    evs.push({ type: 'rankUp', rank: state.rank });
  }
  return evs;
}
