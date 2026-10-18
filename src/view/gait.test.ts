import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FOOT_R, L1, L2, REST_HIPS, advance, gaitFor, footPath, moveBlend, runBlend, solveLeg, type Foot, type Gait, type LegAngles } from './gait';
import { Figure } from './figures';

const G = (speed: number, cadence = 1, heft = 0): Gait => gaitFor(speed, cadence, heft, { run: 0, stepLen: 0, duty: 0, lift: 0, crouch: 0, walkBob: 0, runBob: 0 });

describe('gait maths', () => {
  it('blends smoothly from standing to walking to running', () => {
    expect(moveBlend(0)).toBe(0);
    expect(moveBlend(1)).toBe(1);
    expect(runBlend(1.5)).toBe(0);
    expect(runBlend(5)).toBe(1);
    let last = -1;
    for (let s = 0; s <= 6; s += 0.1) { const r = runBlend(s); expect(r).toBeGreaterThanOrEqual(last); last = r; }
  });

  it('takes longer steps when faster and shorter ones when heavily loaded', () => {
    expect(G(3.5).stepLen).toBeGreaterThan(G(1.2).stepLen);
    expect(G(1.5, 1, 1).stepLen).toBeLessThan(G(1.5, 1, 0).stepLen);
    expect(G(1.5, 1.1).stepLen).toBeLessThan(G(1.5, 0.9).stepLen); // a quicker person takes shorter, faster steps
  });

  it('advances the cycle with distance: faster speed or shorter steps mean a quicker cadence', () => {
    const g = G(1.5);
    const oneStride = advance(0, 2 * g.stepLen, 1, g.stepLen); // covering two steps' distance
    expect(oneStride).toBeCloseTo(0, 6); // wraps back to the start of the cycle
    expect(advance(0.2, 1.5, 0.1, g.stepLen)).toBeGreaterThan(0.2);
  });

  it('keeps the foot on the ground, moving back at body speed, for the whole stance', () => {
    for (const speed of [0.8, 1.6, 3, 5]) {
      const g = G(speed), f: Foot = { z: 0, y: 0 }, f2: Foot = { z: 0, y: 0 };
      const du = 1e-4;
      for (let u = 0.01; u < g.duty - 0.01; u += 0.05) {
        footPath(u, g, f);
        footPath(u + du, g, f2);
        expect(f.y).toBeCloseTo(FOOT_R, 9);
        const vz = (f2.z - f.z) / (du * (2 * g.stepLen / speed)); // body-frame speed, per second
        expect(vz).toBeCloseTo(-speed, 3);
      }
    }
  });

  it('lands the swing foot exactly where the stance began, and lifts it in between', () => {
    const g = G(1.6), a: Foot = { z: 0, y: 0 }, b: Foot = { z: 0, y: 0 }, m: Foot = { z: 0, y: 0 };
    footPath(g.duty - 1e-9, g, a);
    footPath(g.duty + 1e-9, g, b);
    expect(Math.abs(a.z - b.z)).toBeLessThan(1e-6);
    footPath(0.999999, g, a);
    footPath(0, g, b);
    expect(Math.abs(a.z - b.z)).toBeLessThan(1e-3);
    footPath((1 + g.duty) / 2, g, m);
    expect(m.y).toBeGreaterThan(FOOT_R + g.lift * 0.9);
  });

  it('solves the leg so the foot is where it was asked to be, and folds the knee backwards', () => {
    const out: LegAngles = { hip: 0, knee: 0 };
    for (const [tz, ty] of [[0, -0.6], [0.25, -0.58], [-0.3, -0.55], [0.1, -0.4]]) {
      solveLeg(tz, ty, out);
      const kz = -L1 * Math.sin(out.hip), ky = -L1 * Math.cos(out.hip);
      const fz = kz - L2 * Math.sin(out.hip + out.knee), fy = ky - L2 * Math.cos(out.hip + out.knee);
      expect(fz).toBeCloseTo(tz, 6);
      expect(fy).toBeCloseTo(ty, 6);
      expect(out.knee).toBeGreaterThanOrEqual(0);
    }
    solveLeg(0, -(L1 + L2), out); // a straight leg
    expect(out.knee).toBeLessThan(0.1);
  });
});

/** Walk a real figure along the ground and check the planted boots stay put in the world. */
function slideOf(speed: number, scale: number): { worst: number; planted: number; kneeMax: number; yRange: number } {
  const fig = new Figure({ shirt: 0xffffff, pants: 0x335577, scale });
  const dt = 1 / 60, v = new THREE.Vector3();
  let worst = 0, planted = 0, kneeMax = 0, minY = 9, maxY = -9;
  const start: (THREE.Vector3 | null)[] = [null, null];
  for (let frame = 0; frame < 60 * 6; frame++) {
    fig.group.position.z += speed * dt;
    fig.update(dt, speed);
    fig.group.updateMatrixWorld(true);
    if (frame < 90) continue; // let the blend settle
    for (const i of [0, 1] as const) {
      fig.footWorld(i, v);
      const onGround = v.y < (FOOT_R + 0.007) * scale;
      if (onGround) {
        planted++;
        const s0 = start[i] ?? (start[i] = v.clone());
        worst = Math.max(worst, Math.hypot(v.x - s0.x, v.z - s0.z));
      } else start[i] = null;
    }
    const h = (fig as unknown as { hips: THREE.Object3D }).hips.position.y;
    minY = Math.min(minY, h); maxY = Math.max(maxY, h);
    kneeMax = Math.max(kneeMax, (fig as unknown as { knee: THREE.Object3D[] }).knee[0].rotation.x);
  }
  return { worst, planted, kneeMax, yRange: maxY - minY };
}

describe('the walking figure', () => {
  it.each([[1.0, 1], [1.6, 1], [1.6, 0.8], [3, 1], [5.2, 1]])('does not slide its boots at %f m/s (scale %f)', (speed, scale) => {
    const r = slideOf(speed, scale);
    expect(r.planted).toBeGreaterThan(100);
    expect(r.worst).toBeLessThan(0.03 * scale);
  });

  it('bobs gently, bends the knee on the swing, and keeps the boots at ground height when standing', () => {
    const w = slideOf(1.6, 1);
    expect(w.yRange).toBeGreaterThan(0.02);
    expect(w.yRange).toBeLessThan(0.14);
    expect(w.kneeMax).toBeGreaterThan(0.6);
    const fig = new Figure({ shirt: 1, pants: 2 });
    for (let i = 0; i < 120; i++) fig.update(1 / 60, 0);
    fig.group.updateMatrixWorld(true);
    const p = fig.footWorld(0, new THREE.Vector3());
    expect(p.y).toBeCloseTo(FOOT_R, 1);
    expect(REST_HIPS).toBeCloseTo(0.814, 3);
  });
});
