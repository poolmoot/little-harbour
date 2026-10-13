import { DAY_SECONDS, HOUR_SECONDS, PHASE_HOURS, START_HOUR } from './config';
import type { Phase } from './config';
import type { Ev, GameState } from './state';
import { emptyStats } from './state';

/** Hour of day 0..24 (fractional) for a dayTime value in seconds since 06:00. */
export function hourOf(dayTime: number): number {
  return (START_HOUR + dayTime / HOUR_SECONDS) % 24;
}

function phaseOfHour(h: number): Phase {
  const p = PHASE_HOURS;
  if (h >= p.dawnStart && h < p.dayStart) return 'dawn';
  if (h >= p.dayStart && h < p.duskStart) return 'day';
  if (h >= p.duskStart && h < p.nightStart) return 'dusk';
  return 'night';
}

export function phaseOf(dayTime: number): Phase {
  return phaseOfHour(hourOf(dayTime));
}

export function isNight(state: GameState): boolean {
  return phaseOf(state.dayTime) === 'night';
}

export function formatClock(dayTime: number): string {
  const h = hourOf(dayTime);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Advance the clock; handles the 06:00 rollover (summary event + stats reset). Spoiled crate cleanup is done by caller via the dayEnded event. */
export function advanceClock(state: GameState, dt: number): Ev[] {
  const evs: Ev[] = [];
  state.clock += dt;
  state.dayTime += dt;
  while (state.dayTime >= DAY_SECONDS) {
    state.dayTime -= DAY_SECONDS;
    evs.push({ type: 'dayEnded', day: state.day, stats: { ...state.stats } });
    state.day += 1;
    state.stats = emptyStats();
  }
  const phase = phaseOf(state.dayTime);
  if (phase !== state.lastPhase) {
    state.lastPhase = phase;
    evs.push({ type: 'phaseChanged', phase });
  }
  return evs;
}
