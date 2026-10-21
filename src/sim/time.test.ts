import { describe, expect, it } from 'vitest';
import { initialState } from './state';
import { DAY_REAL_SECONDS, DAY_SECONDS } from './config';
import { advanceClock, formatClock, gameSecondsFor, hourOf, phaseOf, realSecondsFor } from './time';

describe('time', () => {
  it('starts at 06:00 and maps seconds to hours (15 s per hour)', () => {
    expect(formatClock(0)).toBe('06:00');
    expect(hourOf(15)).toBe(7);
    expect(formatClock(7.5)).toBe('06:30');
  });
  it('reports phases at the boundaries', () => {
    expect(phaseOf(0)).toBe('dawn');
    expect(phaseOf(29)).toBe('dawn');
    expect(phaseOf(30)).toBe('day');
    expect(phaseOf(179)).toBe('day');
    expect(phaseOf(180)).toBe('dusk');
    expect(phaseOf(210)).toBe('night');
    expect(phaseOf(359)).toBe('night');
  });
  it('runs the night 2.5 times faster; a day is 270 real seconds', () => {
    expect(DAY_REAL_SECONDS).toBe(270);
    expect(gameSecondsFor(0, 100)).toBe(100);
    expect(gameSecondsFor(220, 10)).toBeCloseTo(25);
    expect(gameSecondsFor(205, 5)).toBeCloseTo(5); // 5 s of dusk reaches the night exactly
    expect(gameSecondsFor(205, 7)).toBeCloseTo(5 + 2 * 2.5);
    const s = initialState();
    s.dayTime = 210;
    advanceClock(s, 20);
    expect(s.dayTime).toBeCloseTo(260);
    let t = 0;
    const c = initialState();
    while (c.day === 1) { advanceClock(c, 0.25); t += 0.25; }
    expect(t).toBeCloseTo(270, 0);
  });
  it('turns in-game time into real seconds and back', () => {
    expect(realSecondsFor(0, DAY_SECONDS)).toBeCloseTo(270);
    expect(realSecondsFor(100, 100)).toBe(100);
    expect(realSecondsFor(215, 25)).toBeCloseTo(10);
    for (const t0 of [0, 150, 209, 215, 300]) expect(gameSecondsFor(t0, realSecondsFor(t0, 77))).toBeCloseTo(77);
  });
  it('rolls the day over at 06:00 with a summary and fresh stats', () => {
    const s = initialState();
    s.dayTime = 359;
    s.lastPhase = 'night';
    s.stats.earned = 77;
    const evs = advanceClock(s, 2);
    const end = evs.find((e) => e.type === 'dayEnded');
    expect(end && end.type === 'dayEnded' && end.stats.earned).toBe(77);
    expect(s.day).toBe(2);
    expect(s.dayTime).toBeCloseTo(1.6); // 0.4 s of night (2.5x) gets to 06:00, then 1.6 s of morning
    expect(s.stats.earned).toBe(0);
    expect(evs.some((e) => e.type === 'phaseChanged')).toBe(true);
  });
});
