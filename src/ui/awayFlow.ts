/** Pure rules for what the player sees when they come back to a saved harbour. */
import { AWAY_MAX_SECONDS } from '../sim/config';
import { captainsUnlocked, rankOf } from '../sim/rank';
import type { GameState } from '../sim/state';
import type { AwayResult } from '../sim/away';

/** Away longer than this (10 minutes) with nothing earned is worth a one-time tip about captains. */
export const TIP_MIN_SECONDS = 600;
/** How long the welcome-back money counter takes to count up. */
export const COUNT_SECONDS = 1.6;

export type AwayPlan = 'welcome' | 'tip' | 'none';

/** The welcome-back window when money was earned; a one-time tip when it was not because nobody has a captain; otherwise nothing. */
export function awayPlan(result: AwayResult | null, s: GameState, tipSeen: boolean): AwayPlan {
  if (!result) return 'none';
  if (result.earned > 0) return 'welcome';
  if (result.seconds > TIP_MIN_SECONDS && !tipSeen && !s.boats.some((b) => b.captain) && captainsUnlocked(rankOf(s))) return 'tip';
  return 'none';
}

/** The number shown while the counter ticks up: eases out, then stays on the total. */
export function countedUp(total: number, age: number): number {
  const t = Math.min(1, Math.max(0, age / COUNT_SECONDS));
  return Math.round(total * (1 - (1 - t) ** 3));
}

/** True when the time away was cut off at the 8 hour limit. */
export const wasCapped = (seconds: number): boolean => seconds >= AWAY_MAX_SECONDS;
