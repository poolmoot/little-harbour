/** Pure maths for how the soundscape follows the world (position, clock, weather). */

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 1 in full day, 0 at night, smooth through dawn (about 5:30 to 8:00) and dusk (18:00 to 20:30). */
export function dayness(hour: number): number {
  const up = smoothstep(5.5, 8, hour);
  const down = 1 - smoothstep(18, 20.5, hour);
  return Math.min(up, down);
}

/** 0 in town, 1 out on the pier. The quay edge is z = 0; the pier runs to about z = -18. */
export function pierness(z: number): number {
  return smoothstep(2, -7, z);
}

export interface AmbienceTargets {
  /** Sea wash level. */
  sea: number;
  /** Everyday wind level. */
  wind: number;
  /** Town murmur level. */
  murmur: number;
  /** How often gulls call, 0..1. */
  gulls: number;
  /** How loud crickets are, 0..1. */
  crickets: number;
}

export interface Weather {
  rain: number;
  storm: number;
  fog: number;
}

export const MARKET_POS = { x: -8, z: 4 };

export function ambienceTargets(x: number, z: number, hour: number, w: Weather): AmbienceTargets {
  const day = dayness(hour);
  const pier = pierness(z);
  const dm = Math.hypot(x - MARKET_POS.x, z - MARKET_POS.z);
  const marketNear = 1 - smoothstep(4, 17, dm);
  const calm = 1 - Math.max(w.storm, w.rain * 0.6);
  return {
    sea: (0.3 + 0.7 * pier) * (0.55 + 0.45 * day) * (1 + 0.5 * w.storm),
    wind: (0.25 + 0.35 * pier) * (0.7 + 0.3 * (1 - day)),
    murmur: day * marketNear * (1 - w.storm) * (1 - 0.5 * w.rain),
    gulls: day * calm * (1 - 0.7 * w.fog),
    crickets: (1 - day) * calm,
  };
}
