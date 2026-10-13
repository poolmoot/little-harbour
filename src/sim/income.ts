import { RATE_SAMPLE_SECONDS, RATE_WINDOW_SECONDS } from './config';
import type { GameState } from './state';

const MAX_SAMPLES = RATE_WINDOW_SECONDS / RATE_SAMPLE_SECONDS + 1;

/** Sample lifetime earnings every few seconds, keeping the last two minutes. */
export function stepIncome(state: GameState, dt: number): void {
  state.incomeTimer += dt;
  while (state.incomeTimer >= RATE_SAMPLE_SECONDS) {
    state.incomeTimer -= RATE_SAMPLE_SECONDS;
    state.incomeLog.push(state.lifetime);
    if (state.incomeLog.length > MAX_SAMPLES) state.incomeLog.shift();
  }
}

/** Money earned per minute, averaged over the last two minutes (less while the game is young). */
export function moneyPerMinute(state: GameState): number {
  const log = state.incomeLog;
  if (log.length < 2) return 0;
  const span = (log.length - 1) * RATE_SAMPLE_SECONDS;
  return ((log[log.length - 1] - log[0]) / span) * 60;
}
