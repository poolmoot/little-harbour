import { describe, expect, it } from 'vitest';
import { QUALITY_PRESETS, Quality } from './quality';
import type { QualityPreset } from './quality';

function setup(stored?: string) {
  const applied: QualityPreset[] = [];
  const store = new Map<string, string>(stored ? [['harbour-game-quality', stored]] : []);
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const q = new Quality({ applyQuality: (p) => applied.push(p) }, storage);
  return { q, applied, store };
}
const run = (q: Quality, ms: number, seconds: number) => { for (let t = 0; t < seconds; t += ms / 1000) q.sample(ms / 1000); };

describe('quality scaling', () => {
  it('starts on high and stays there while frames are fast', () => {
    const { q } = setup();
    run(q, 16, 20);
    expect(q.level).toBe('high');
  });
  it('steps down one level after 3 slow seconds, and never steps up', () => {
    const { q, applied } = setup();
    run(q, 30, 3.2);
    expect(q.level).toBe('medium');
    expect(applied.at(-1)).toBe(QUALITY_PRESETS.medium);
    run(q, 30, 3.2);
    expect(q.level).toBe('low');
    run(q, 10, 30);
    expect(q.level).toBe('low');
  });
  it('a short slow patch does not step down', () => {
    const { q } = setup();
    run(q, 40, 1);
    run(q, 10, 10);
    expect(q.level).toBe('high');
  });
  it('a manual level is kept, saved separately, and restored', () => {
    const { q, store } = setup();
    q.setMode('low');
    run(q, 50, 10);
    expect(q.level).toBe('low');
    expect(store.get('harbour-game-quality')).toBe('low');
    const again = setup('medium');
    expect(again.q.level).toBe('medium');
    run(again.q, 50, 10);
    expect(again.q.level).toBe('medium');
  });
});
