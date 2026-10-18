import { describe, expect, it } from 'vitest';
import { Damped, accelerate, angleDiff, turnToward, type Vec2 } from './motion';

describe('motion helpers', () => {
  it('finds the short way round an angle', () => {
    expect(angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2, 9);
    expect(angleDiff(-3, 3)).toBeCloseTo(2 * Math.PI - 6, 9);
  });

  it('turns smoothly: never snaps, never beyond the rate cap, and arrives', () => {
    let a = 0;
    const turns: number[] = [];
    for (let i = 0; i < 120; i++) { const n = turnToward(a, Math.PI * 0.99, 1 / 60); turns.push(Math.abs(n - a)); a = n; }
    expect(Math.max(...turns)).toBeLessThanOrEqual(15 / 60 + 1e-9);
    expect(turns[0]).toBeLessThan(Math.PI * 0.5); // a big turn is not instant
    expect(Math.abs(angleDiff(Math.PI * 0.99, a))).toBeLessThan(0.01);
  });

  it('reaches full speed in a short time and stops quickly, with no sliding afterwards', () => {
    const v: Vec2 = { x: 0, z: 0 };
    const want = { x: 0, z: -5.2 };
    let t = 0;
    while (Math.hypot(v.x, v.z) < 5.2 - 1e-6 && t < 2) { accelerate(v, want, 1 / 60, 30, 46); t += 1 / 60; }
    expect(t).toBeGreaterThan(0.1);
    expect(t).toBeLessThan(0.25);
    let slide = 0;
    t = 0;
    while (Math.hypot(v.x, v.z) > 0 && t < 2) { slide += Math.hypot(v.x, v.z) / 60; accelerate(v, { x: 0, z: 0 }, 1 / 60, 30, 46); t += 1 / 60; }
    expect(t).toBeLessThan(0.2);
    expect(slide).toBeLessThan(0.45);
  });

  it('is no faster on a diagonal', () => {
    const s = Math.SQRT1_2 * 5.2;
    const a: Vec2 = { x: 0, z: 0 }, b: Vec2 = { x: 0, z: 0 };
    for (let i = 0; i < 6; i++) { accelerate(a, { x: 5.2, z: 0 }, 1 / 60, 30, 46); accelerate(b, { x: s, z: s }, 1 / 60, 30, 46); }
    expect(Math.hypot(b.x, b.z)).toBeCloseTo(Math.hypot(a.x, a.z), 9);
  });

  it('follows with a damped spring: no overshoot, no jump in speed', () => {
    const d = new Damped(0);
    let last = 0, maxStepChange = 0, prevStep = 0;
    for (let i = 0; i < 240; i++) {
      const v = d.update(10, 0.25, 1 / 60);
      expect(v).toBeLessThanOrEqual(10 + 1e-6);
      const step = v - last;
      expect(step).toBeGreaterThanOrEqual(-1e-9); // never backs up
      maxStepChange = Math.max(maxStepChange, Math.abs(step - prevStep));
      prevStep = step; last = v;
    }
    expect(10 - last).toBeLessThan(0.01);
    expect(maxStepChange).toBeLessThan(0.2); // speed builds up gradually from rest
  });
});
