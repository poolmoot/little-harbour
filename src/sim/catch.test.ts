import { describe, expect, it } from 'vitest';
import { rollCatch, rollPier, zoneWeights } from './catch';
import { Rng } from './rng';

describe('catch tables', () => {
  it('triples flounder at dawn and dusk only', () => {
    expect(zoneWeights('shallows', 'day').flounder).toBe(20);
    expect(zoneWeights('shallows', 'dawn').flounder).toBe(60);
    expect(zoneWeights('shallows', 'dusk').flounder).toBe(60);
  });
  it('rolls only species that live in the zone', () => {
    const r = new Rng(3);
    const shallow = rollCatch('shallows', 'day', 300, r);
    expect(shallow.every((s) => ['herring', 'mackerel', 'flounder'].includes(s))).toBe(true);
    const reef = rollCatch('reef', 'day', 300, r);
    expect(reef.every((s) => ['seabass', 'snapper', 'lobster'].includes(s))).toBe(true);
    expect(reef.length).toBe(300);
  });
  it('flounder is far more common at dawn than midday', () => {
    const count = (p: 'day' | 'dawn') => rollCatch('shallows', p, 4000, new Rng(9)).filter((s) => s === 'flounder').length;
    expect(count('dawn')).toBeGreaterThan(count('day') * 1.8);
  });
  it('pier gives herring and mackerel only', () => {
    const r = new Rng(5);
    for (let i = 0; i < 100; i++) expect(['herring', 'mackerel']).toContain(rollPier(r));
  });
});
