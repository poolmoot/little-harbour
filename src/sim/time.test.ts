import { describe, expect, it } from 'vitest';
import { initialState } from './state';
import { advanceClock, formatClock, hourOf, phaseOf } from './time';

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
  it('rolls the day over at 06:00 with a summary and fresh stats', () => {
    const s = initialState();
    s.dayTime = 359;
    s.lastPhase = 'night';
    s.stats.earned = 77;
    const evs = advanceClock(s, 2);
    const end = evs.find((e) => e.type === 'dayEnded');
    expect(end && end.type === 'dayEnded' && end.stats.earned).toBe(77);
    expect(s.day).toBe(2);
    expect(s.dayTime).toBeCloseTo(1);
    expect(s.stats.earned).toBe(0);
    expect(evs.some((e) => e.type === 'phaseChanged')).toBe(true);
  });
});
