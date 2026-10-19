import { describe, expect, it } from 'vitest';
import { findRoute, sampleRoute } from './guideTrail';

describe('guide trail route', () => {
  it('is a straight line when nothing is in the way', () => {
    const r = findRoute({ x: 0, z: 5 }, { x: 8, z: 5 }, () => true);
    expect(r).toHaveLength(2);
  });
  it('goes round a wall instead of through it', () => {
    const wall = (x: number, z: number) => !(x > 3 && x < 4 && z > 2 && z < 9);
    const r = findRoute({ x: 0, z: 5 }, { x: 8, z: 5 }, wall);
    expect(r.length).toBeGreaterThan(2);
    for (let i = 0; i + 1 < r.length; i++) {
      for (let t = 0; t <= 1; t += 0.05) expect(wall(r[i].x + (r[i + 1].x - r[i].x) * t, r[i].z + (r[i + 1].z - r[i].z) * t)).toBe(true);
    }
    expect(r[r.length - 1]).toEqual({ x: 8, z: 5 });
  });
  it('samples evenly spaced points along the route and respects the maximum', () => {
    const out = Array.from({ length: 5 }, () => ({ x: 0, z: 0, d: 0 }));
    expect(sampleRoute([{ x: 0, z: 0 }, { x: 10, z: 0 }], 1, 5, out)).toBe(5);
    expect(out[1].x - out[0].x).toBeCloseTo(1);
  });
});
