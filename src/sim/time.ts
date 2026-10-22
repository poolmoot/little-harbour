import { DAY_SECONDS, HOUR_SECONDS, NIGHT_SPEED, NIGHT_START_TIME, PHASE_HOURS, START_HOUR } from './config';
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

/** How many in-game clock seconds pass in `real` real seconds, starting at `dayTime`. The night runs NIGHT_SPEED times faster. */
export function gameSecondsFor(dayTime: number, real: number): number {
  let t = ((dayTime % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS, left = real, game = 0;
  while (left > 1e-9) {
    const night = t >= NIGHT_START_TIME;
    const rate = night ? NIGHT_SPEED : 1;
    const end = night ? DAY_SECONDS : NIGHT_START_TIME;
    const roomReal = (end - t) / rate;
    if (left < roomReal) { game += left * rate; t += left * rate; left = 0; }
    else { game += end - t; left -= roomReal; t = end >= DAY_SECONDS ? 0 : end; }
  }
  return game;
}

/** How many real seconds it takes for `game` in-game clock seconds to pass, starting at `dayTime` (the other way round). */
export function realSecondsFor(dayTime: number, game: number): number {
  let t = ((dayTime % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS, left = game, real = 0;
  while (left > 1e-9) {
    const night = t >= NIGHT_START_TIME;
    const rate = night ? NIGHT_SPEED : 1;
    const end = night ? DAY_SECONDS : NIGHT_START_TIME;
    if (left < end - t) { real += left / rate; t += left; left = 0; }
    else { real += (end - t) / rate; left -= end - t; t = end >= DAY_SECONDS ? 0 : end; }
  }
  return real;
}

/** Advance the clock; handles the 06:00 rollover (summary event + stats reset). The night runs faster than real time; `clock` stays in real seconds. Spoiled crate cleanup is done by caller via the dayEnded event. */
export function advanceClock(state: GameState, dt: number): Ev[] {
  const evs: Ev[] = [];
  state.clock += dt;
  state.dayTime += gameSecondsFor(state.dayTime, dt);
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
