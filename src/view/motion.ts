/** Small pure helpers for how things ease: player speed, turning and the camera. No Three.js, nothing allocated. */

export interface Vec2 { x: number; z: number }

/** Shortest signed angle from `from` to `to`, in -PI..PI. */
export function angleDiff(to: number, from: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Turn `cur` towards `target`: quick when far off, gentle as it arrives, and never faster than `maxRate` rad/s.
 * Returns the new angle.
 */
export function turnToward(cur: number, target: number, dt: number, rate = 11, maxRate = 15): number {
  const d = angleDiff(target, cur);
  const want = d * (1 - Math.exp(-rate * dt));
  const cap = maxRate * dt;
  return cur + (want > cap ? cap : want < -cap ? -cap : want);
}

/**
 * Move `vel` towards `want` with a limited acceleration, in place. Speeding up uses `accel` (m/s^2), letting go uses
 * `decel`. The change is capped by length, so a diagonal speeds up exactly as fast as a straight line.
 */
export function accelerate(vel: Vec2, want: Vec2, dt: number, accel: number, decel: number): void {
  const dx = want.x - vel.x, dz = want.z - vel.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return;
  const stopping = want.x === 0 && want.z === 0;
  const step = (stopping ? decel : accel) * dt;
  if (dist <= step) { vel.x = want.x; vel.z = want.z; return; }
  vel.x += (dx / dist) * step;
  vel.z += (dz / dist) * step;
}

/** A critically damped follower: reaches its target smoothly with no overshoot and no sudden start. */
export class Damped {
  value: number;
  velocity = 0;
  constructor(start = 0) { this.value = start; }
  update(target: number, smoothTime: number, dt: number): number {
    const omega = 2 / Math.max(smoothTime, 1e-4);
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - target;
    const temp = (this.velocity + omega * change) * dt;
    this.velocity = (this.velocity - omega * temp) * e;
    this.value = target + (change + temp) * e;
    return this.value;
  }
  snap(v: number): void { this.value = v; this.velocity = 0; }
}
