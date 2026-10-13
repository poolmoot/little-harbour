/** One wave field, shared by the water vertex shader and by TypeScript (boats, float, crates bob in sync). */
interface RawWave { dx: number; dz: number; len: number; amp: number; q: number }
const RAW: RawWave[] = [
  { dx: 0.8, dz: 0.6, len: 16, amp: 0.11, q: 0.35 },
  { dx: -0.5, dz: 0.85, len: 9, amp: 0.07, q: 0.35 },
  { dx: 0.3, dz: -0.95, len: 5.5, amp: 0.045, q: 0.4 },
  { dx: -0.9, dz: -0.4, len: 3.2, amp: 0.025, q: 0.4 },
];

export const SEA_Y = -0.7;

export const WAVES = RAW.map((w) => {
  const l = Math.hypot(w.dx, w.dz);
  const k = (2 * Math.PI) / w.len;
  return { dx: w.dx / l, dz: w.dz / l, k, w: Math.sqrt(9.8 * k) * 0.55, amp: w.amp, q: w.q };
});

export interface WaveSample { h: number; sx: number; sz: number }

/** Surface height (relative to SEA_Y) and slope at a world point. */
export function waveAt(x: number, z: number, t: number, out: WaveSample = { h: 0, sx: 0, sz: 0 }): WaveSample {
  let h = 0, sx = 0, sz = 0;
  for (const w of WAVES) {
    const th = w.k * (w.dx * x + w.dz * z) - w.w * t;
    h += w.amp * Math.sin(th);
    const c = w.amp * w.k * Math.cos(th);
    sx += c * w.dx;
    sz += c * w.dz;
  }
  out.h = h; out.sx = sx; out.sz = sz;
  return out;
}

const f = (n: number) => n.toFixed(5);
export const WAVE_GLSL = `
const int NW = ${WAVES.length};
const vec4 W_DIR[NW] = vec4[NW](${WAVES.map((w) => `vec4(${f(w.dx)},${f(w.dz)},${f(w.k)},${f(w.w)})`).join(',')});
const vec2 W_AQ[NW] = vec2[NW](${WAVES.map((w) => `vec2(${f(w.amp)},${f(w.q)})`).join(',')});
void waves(vec2 p, float t, out float h, out vec2 grad, out vec2 off) {
  h = 0.0; grad = vec2(0.0); off = vec2(0.0);
  for (int i = 0; i < NW; i++) {
    vec2 d = W_DIR[i].xy;
    float th = W_DIR[i].z * dot(d, p) - W_DIR[i].w * t;
    float s = sin(th), c = cos(th);
    float A = W_AQ[i].x;
    h += A * s;
    grad += A * W_DIR[i].z * d * c;
    off += W_AQ[i].y * A * d * c;
  }
}
`;
