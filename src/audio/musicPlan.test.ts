import { describe, expect, it } from 'vitest';
import { MusicPlanner, PENTATONIC } from './musicPlan';
import type { MusicMode } from './musicPlan';

function run(seed: number, n: number, mode: MusicMode = 'day') {
  const p = new MusicPlanner(seed);
  return Array.from({ length: n }, () => p.next(mode));
}

describe('music planner', () => {
  it('gives the same music for the same seed, and different music for another', () => {
    expect(run(7, 40)).toEqual(run(7, 40));
    expect(run(7, 40)).not.toEqual(run(8, 40));
  });

  it('keeps every melody note in the pentatonic scale, in range, inside the bar', () => {
    for (const mode of ['day', 'night'] as const) {
      for (const bar of run(3, 300, mode)) {
        for (const n of bar.melody) {
          expect(PENTATONIC).toContain(n.midi % 12);
          expect(n.midi).toBeGreaterThanOrEqual(mode === 'day' ? 69 : 60);
          expect(n.midi).toBeLessThanOrEqual(mode === 'day' ? 88 : 79);
          expect(n.at).toBeGreaterThanOrEqual(0);
          expect(n.at).toBeLessThan(bar.barSeconds);
          expect(n.vel).toBeGreaterThan(0);
          expect(n.vel).toBeLessThanOrEqual(1);
        }
        expect(bar.melody.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('leaves silences, but never goes silent for long', () => {
    for (const seed of [1, 2, 3, 99]) {
      const bars = run(seed, 400);
      const silent = bars.filter((b) => b.melody.length === 0).length;
      expect(silent / bars.length).toBeGreaterThan(0.1);
      expect(silent / bars.length).toBeLessThan(0.5);
      let longest = 0, cur = 0;
      for (const b of bars) {
        cur = b.melody.length === 0 ? cur + 1 : 0;
        longest = Math.max(longest, cur);
      }
      expect(longest).toBeLessThanOrEqual(4);
    }
  });

  it('night is slower and sparser than day', () => {
    const day = run(5, 300, 'day'), night = run(5, 300, 'night');
    expect(night[0].barSeconds).toBeGreaterThan(day[0].barSeconds);
    const count = (bs: typeof day) => bs.reduce((a, b) => a + b.melody.length, 0) / (bs.length * bs[0].barSeconds);
    expect(count(night)).toBeLessThan(count(day));
  });

  it('plays triads of notes in the key, four chords per progression', () => {
    const bars = run(11, 16);
    for (const b of bars) {
      expect(b.chord).toHaveLength(3);
      for (const m of b.chord) expect([0, 2, 4, 5, 7, 9, 11]).toContain(m % 12);
      if (b.bass !== null) expect(b.bass).toBeLessThan(b.chord[0]);
    }
  });

  it('varies over a long session (does not loop a fixed tune)', () => {
    const bars = run(21, 450); // an hour of day music
    const tunes = new Set(bars.map((b) => b.melody.map((n) => n.midi).join(',')));
    expect(tunes.size).toBeGreaterThan(30);
  });
});
