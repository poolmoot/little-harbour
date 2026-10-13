import { MAX_BOATS, RANK_NAMES, RANK_THRESHOLDS } from './config';
import type { Ev, GameState } from './state';

export function rankIndex(lifetime: number): number {
  let r = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) if (lifetime >= RANK_THRESHOLDS[i]) r = i;
  return r;
}

export const rankOf = (state: GameState): number => rankIndex(state.lifetime);
export const rankName = (state: GameState): string => RANK_NAMES[rankOf(state)];

/** Progress to the next rank: fraction 0..1, plus what is needed. Null at the top rank. */
export function rankProgress(state: GameState): { frac: number; next: string; need: number; have: number } | null {
  const r = rankOf(state);
  if (r >= RANK_NAMES.length - 1) return null;
  const lo = RANK_THRESHOLDS[r], hi = RANK_THRESHOLDS[r + 1];
  return { frac: Math.max(0, Math.min(1, (state.lifetime - lo) / (hi - lo))), next: RANK_NAMES[r + 1], need: hi, have: Math.floor(state.lifetime) };
}

/** How many boats may be owned at this rank. */
export const maxBoats = (rank: number): number => Math.min(MAX_BOATS, rank + 1);
/** Highest hull tier that may be bought at this rank. */
export const maxHullTier = (rank: number): number => Math.min(3, rank);
export const dockhandsUnlocked = (rank: number): boolean => rank >= 1;
export const captainsUnlocked = (rank: number): boolean => rank >= 2;

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
