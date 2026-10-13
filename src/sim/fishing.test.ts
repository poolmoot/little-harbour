import { describe, expect, it } from 'vitest';
import { addCrate, handCrates } from './crates';
import { castLine, hook, stepFishing } from './fishing';
import { Rng } from './rng';
import { initialState } from './state';

describe('pier fishing', () => {
  it('bites after 2-6 s and landing within 0.7 s gives a fresh crate in hand', () => {
    const s = initialState();
    const rng = new Rng(8);
    castLine(s, rng);
    expect(s.fishing.timer).toBeGreaterThanOrEqual(2);
    expect(s.fishing.timer).toBeLessThanOrEqual(6);
    expect(stepFishing(s, 1.9)).toHaveLength(0);
    const bite = stepFishing(s, 4.2);
    expect(bite[0].type).toBe('biteStarted');
    stepFishing(s, 0.5);
    expect(hook(s, rng)[0].type).toBe('fishLanded');
    expect(handCrates(s)).toHaveLength(1);
    expect(handCrates(s)[0].freshness).toBe(100);
    expect(s.fishing.phase).toBe('idle');
  });
  it('too early loses the fish', () => {
    const s = initialState();
    const rng = new Rng(8);
    castLine(s, rng);
    expect(hook(s, rng)[0]).toEqual({ type: 'fishLost', reason: 'early' });
    expect(handCrates(s)).toHaveLength(0);
  });
  it('too late loses the fish', () => {
    const s = initialState();
    const rng = new Rng(8);
    castLine(s, rng);
    stepFishing(s, 7);
    expect(s.fishing.phase).toBe('bite');
    const evs = stepFishing(s, 0.8);
    expect(evs[0]).toEqual({ type: 'fishLost', reason: 'late' });
    expect(hook(s, rng)).toEqual([]);
  });
  it('needs a free carry slot', () => {
    const s = initialState();
    addCrate(s, 'herring', 'hand');
    addCrate(s, 'herring', 'hand');
    expect(castLine(s, new Rng(1))[0].type).toBe('denied');
  });
});
