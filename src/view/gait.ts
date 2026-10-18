/**
 * Pure maths for the walk: no Three.js, no state, nothing allocated per call.
 * The walk is built from the feet backwards. Each foot follows a path that is planted on the ground while the body moves
 * over it (so there is no foot sliding), then swings forward. A two-bone solver then finds the hip and knee angles that put
 * the foot there, and the hips ride up and down on top. Everything is in the figure's own units (metres at scale 1).
 * Angles follow the rig: a positive x rotation swings a limb backwards.
 */

/** Thigh, shin, and the rounded boot's radius. They match the leg that `figures.ts` builds. */
export const L1 = 0.36, L2 = 0.34, FOOT_R = 0.094;
/** The hip joint hangs this far below the hips pivot. */
export const HIP_DROP = 0.02;
/** Hips height at which both legs are straight and the boots just touch the ground. */
export const REST_HIPS = L1 + L2 + FOOT_R + HIP_DROP;
/** Sideways distance of each hip joint from the middle. */
export const HIP_X = 0.13;

/** Speeds (m/s) between which the gait blends from a walk into a run. */
export const RUN_FROM = 2, RUN_FULL = 4.6;
/** Below this speed the legs relax into the standing pose; above FULL the full gait is on. */
export const MOVE_FROM = 0.12, MOVE_FULL = 0.55;

export const smooth = (x: number): number => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** 0 for a stroll, 1 for a full run. */
export function runBlend(speed: number): number {
  return smooth((speed - RUN_FROM) / (RUN_FULL - RUN_FROM));
}

/** 0 when standing, 1 when the legs should be doing the full gait. */
export function moveBlend(speed: number): number {
  return smooth((speed - MOVE_FROM) / (MOVE_FULL - MOVE_FROM));
}

export interface Gait {
  run: number;
  /** Distance covered between one foot landing and the other landing. */
  stepLen: number;
  /** Share of the stride cycle a foot is on the ground. Walking is over half, running under half. */
  duty: number;
  /** How high the foot rises on the swing. */
  lift: number;
  /** How far the hips sit lower than fully standing. */
  crouch: number;
  walkBob: number;
  runBob: number;
}

/**
 * Gait settings for a speed. `cadence` is a per-person factor (about 0.9 to 1.1: quicker or slower steps at the same speed)
 * and `heft` is 0 to 1 for a heavy load, which shortens the step and lowers the body.
 */
export function gaitFor(speed: number, cadence: number, heft: number, g: Gait): Gait {
  const run = runBlend(speed);
  const walkStep = clamp(0.36 + 0.17 * speed, 0.45, 0.64);
  g.run = run;
  g.stepLen = (lerp(walkStep, 1.1, run) * (1 - 0.12 * heft)) / cadence;
  g.duty = lerp(0.62, 0.36, run) + 0.04 * heft;
  g.lift = lerp(0.07, 0.2, run) * (1 - 0.3 * heft);
  g.crouch = lerp(0.035, 0.09, run) + 0.03 * heft;
  g.walkBob = 0.05;
  g.runBob = 0.05;
  return g;
}

/** Advance the stride cycle (one cycle is two steps). `speed` and `stepLen` are in the same units. */
export function advance(u: number, speed: number, dt: number, stepLen: number): number {
  const n = u + (speed * dt) / (2 * stepLen);
  return n - Math.floor(n);
}

export interface Foot { z: number; y: number }

/**
 * Where a foot's centre is, relative to the hips, at cycle position `u` (0 to 1, 0 = the foot has just landed in front).
 * On the ground it moves back at exactly the body's speed; in the swing it is carried forward and lifted, and it lands
 * already moving backwards at ground speed so the landing does not skid.
 */
export function footPath(u: number, g: Gait, out: Foot): Foot {
  const stride = 2 * g.stepLen, travel = stride * g.duty, front = travel * 0.5;
  if (u < g.duty) {
    out.z = front - travel * (u / g.duty);
    out.y = FOOT_R;
  } else {
    const s = (u - g.duty) / (1 - g.duty);
    const s2 = s * s, s3 = s2 * s;
    const m = -stride * (1 - g.duty);
    out.z = (2 * s3 - 3 * s2 + 1) * -front + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * front + (s3 - s2) * m;
    out.y = FOOT_R + g.lift * Math.sin(Math.PI * s);
  }
  return out;
}

export interface LegAngles { hip: number; knee: number }

/** Two-bone solver in the forward plane: hip and knee angles that put the foot at (tz, ty) from the hip joint. */
export function solveLeg(tz: number, ty: number, out: LegAngles): LegAngles {
  const dRaw = Math.sqrt(tz * tz + ty * ty);
  const d = clamp(dRaw, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  const kneeInner = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  const thighOff = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const dir = Math.atan2(-tz, -ty); // direction to the foot, measured like the rig: positive swings backwards
  out.hip = dir - thighOff;
  out.knee = Math.PI - kneeInner;
  return out;
}

/** Highest the hips can be while a foot still reaches its spot. */
export function reachLimit(f: Foot, hipZ: number, tzOffset = 0): number {
  const tz = f.z - hipZ - tzOffset;
  const r = (L1 + L2) * 0.995;
  const q = r * r - tz * tz;
  return HIP_DROP + f.y + (q > 0 ? Math.sqrt(q) : 0);
}

/**
 * Hips height for cycle position `u`. Walking rises over the planted leg (so it peaks mid-step, twice a cycle);
 * running sinks onto it like a spring.
 */
export function hipsHeight(u: number, g: Gait): number {
  const w = 0.5 * (1 + Math.cos(4 * Math.PI * (u - g.duty * 0.5))); // 1 when a foot is mid-stance
  return REST_HIPS - g.crouch + (g.walkBob * (w - 1)) * (1 - g.run) - g.runBob * w * g.run;
}

export const wrap01 = (u: number): number => u - Math.floor(u);
