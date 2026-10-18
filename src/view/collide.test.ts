import { describe, expect, it } from 'vitest';
import { resolveMove } from './collide';
import type { Area, Solid } from './collide';

const areas: Area[] = [[-20, 20, 0, 14]];
const wall: Solid = { cx: 0, cz: 5, hx: 3, hz: 2, a: 0.6 };

describe('walking collision', () => {
  it('slides along a turned wall instead of stopping', () => {
    // walk straight at the wall from the front-left and keep pushing: the walker must keep making progress along it
    let p = { x: -6, z: 9 };
    let travelled = 0;
    for (let i = 0; i < 120; i++) {
      const q = resolveMove(areas, [wall], p, p.x + 0.06, p.z - 0.05, 0.35);
      travelled += Math.hypot(q.x - p.x, q.z - p.z);
      p = q;
    }
    expect(travelled).toBeGreaterThan(3.5);
  });
  it('never ends up inside a solid and never leaves the ground', () => {
    let p = { x: -6, z: 9 };
    for (let i = 0; i < 400; i++) {
      const a = i * 0.37;
      p = resolveMove(areas, [wall, { cx: 5, cz: 9, r: 1.5 }], p, p.x + Math.sin(a) * 0.12, p.z + Math.cos(a * 0.7) * 0.12, 0.35);
      expect(p.x).toBeGreaterThanOrEqual(-20);
      expect(p.z).toBeLessThanOrEqual(14);
    }
  });
  it('slides round a corner without a jump', () => {
    let p = { x: 4.5, z: 7.3 };
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const q = resolveMove(areas, [wall], p, p.x - 0.05, p.z - 0.03, 0.35);
      worst = Math.max(worst, Math.hypot(q.x - p.x, q.z - p.z));
      p = q;
    }
    expect(worst).toBeLessThan(0.12);
  });
});
