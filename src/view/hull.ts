import * as THREE from 'three';

/**
 * Parametric boat hulls. Bow at -z, keel line near y = 0, gunwale near y = H.
 * A station `u` runs 0 (bow) to 1 (stern); each cross-section is a quarter-circle-like curve from keel to gunwale.
 */
export interface HullShape {
  len: number;
  /** Half beam at the widest point. */
  hw: number;
  /** Gunwale height amidships. */
  H: number;
  /** Extra gunwale height at the bow and at the stern (the sheer). */
  sheerBow: number;
  sheerStern: number;
  /** Fraction of the length over which the bow widens to full beam, and how blunt it is (lower = blunter). */
  bowFrac: number;
  bowPow: number;
  /** How much the beam narrows towards the stern (0 = none). */
  sternTaper: number;
  /** How far the keel rises at the bow and at the stern. */
  keelBow: number;
  keelStern: number;
  /** Height of the waterline above the keel. */
  draft: number;
}

/** Paint scheme, bottom to top: below the waterline, the waterline stripe, the sides, the top plank. */
export interface HullPaint { bottom: number; stripe: number; side: number; sheer: number }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const widthAt = (s: HullShape, u: number) =>
  s.hw * (u < s.bowFrac ? Math.pow(Math.sin((u / s.bowFrac) * Math.PI / 2), s.bowPow) : 1 - s.sternTaper * Math.pow((u - s.bowFrac) / (1 - s.bowFrac), 2));
const topAt = (s: HullShape, u: number) => s.H + (u < 0.5 ? s.sheerBow * Math.pow(1 - u / 0.5, 2.4) : s.sheerStern * Math.pow((u - 0.5) / 0.5, 2.4));
const keelAt = (s: HullShape, u: number) => s.keelBow * Math.pow(Math.max(0, (0.38 - u) / 0.38), 2) + s.keelStern * Math.pow(Math.max(0, (u - 0.86) / 0.14), 2);
/** Section angle (0 at the keel, PI/2 at the gunwale) at which the hull side reaches height y. */
const angleAtY = (s: HullShape, u: number, y: number) => {
  const keel = keelAt(s, u), top = topAt(s, u);
  return Math.acos(1 - clamp01((y - keel) / (top - keel)));
};

export const stationZ = (s: HullShape, u: number): number => (u - 0.55) * s.len;
/** Half width of the hull at station u; at height y, or at the gunwale when y is omitted. */
export const halfWidthAt = (s: HullShape, u: number, y?: number): number => widthAt(s, u) * (y === undefined ? 1 : Math.sin(angleAtY(s, u, y)));
export const gunwaleY = (s: HullShape, u: number): number => topAt(s, u);

const STATIONS = 28;
const STRIPE_LOW = 0.02, STRIPE_HIGH = 0.11, SHEER_PLANK = 0.13;
/** Segments round the section for each paint band. */
const BAND_SEGS = [5, 1, 5, 1];

/** Painted outer hull with a transom. Colours are baked into the vertices so one material serves every boat. */
export function hullGeometry(s: HullShape, paint: HullPaint): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const colours = [paint.bottom, paint.stripe, paint.side, paint.sheer].map((c) => new THREE.Color(c));
  const point = (u: number, a: number, side: number) => {
    const keel = keelAt(s, u), top = topAt(s, u);
    pos.push(side * widthAt(s, u) * Math.sin(a), keel + (top - keel) * (1 - Math.cos(a)), stationZ(s, u));
  };
  // Angles where each paint band starts and ends at a station; bands close up where the keel rises above them.
  const bandEdges = (u: number): number[] => {
    const top = topAt(s, u);
    const e = [0, angleAtY(s, u, s.draft + STRIPE_LOW), angleAtY(s, u, s.draft + STRIPE_HIGH), angleAtY(s, u, top - SHEER_PLANK), Math.PI / 2];
    for (let i = 1; i < e.length; i++) e[i] = Math.max(e[i], e[i - 1]);
    return e;
  };
  for (const side of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      const segs = BAND_SEGS[b], base = pos.length / 3;
      for (let i = 0; i <= STATIONS; i++) {
        const u = i / STATIONS, e = bandEdges(u);
        for (let j = 0; j <= segs; j++) {
          point(u, e[b] + ((e[b + 1] - e[b]) * j) / segs, side);
          col.push(colours[b].r, colours[b].g, colours[b].b);
        }
      }
      for (let i = 0; i < STATIONS; i++) for (let j = 0; j < segs; j++) {
        const a = base + i * (segs + 1) + j, c = a + segs + 1;
        if (side > 0) idx.push(a, a + 1, c, a + 1, c + 1, c);
        else idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  // transom: a fan across the stern section
  const base = pos.length / 3, n = 16;
  for (let j = 0; j <= n; j++) {
    const a = (j / n - 0.5) * Math.PI;
    point(1, Math.abs(a), Math.sign(a) || 1);
    col.push(colours[2].r, colours[2].g, colours[2].b);
  }
  pos.push(0, topAt(s, 1), stationZ(s, 1));
  col.push(colours[2].r, colours[2].g, colours[2].b);
  for (let j = 0; j < n; j++) idx.push(base + j, base + j + 1, base + n + 1);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rail along the top edge on one side (side = -1 or 1). */
export function gunwale(s: HullShape, side: number, r = 0.05): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push(new THREE.Vector3(side * widthAt(s, u), topAt(s, u), stationZ(s, u)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 6, false);
}

/** Flat surface between the hull sides from station u0 to u1: at height y (a deck), or at the gunwale when y is omitted. */
export function deckGeometry(s: HullShape, u0: number, u1: number, y?: number, inset = 0.02): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const n = Math.max(2, Math.round((u1 - u0) * STATIONS));
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const w = Math.max(0, halfWidthAt(s, u, y) - inset), py = y ?? topAt(s, u), z = stationZ(s, u);
    pos.push(-w, py, z, w, py, z);
    uv.push(-w * 0.6, z * 0.6, w * 0.6, z * 0.6);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cap across the whole hull opening, gunwale to gunwale. Drawn depth-only so the sea is never painted inside the boat. */
export const hullLid = (s: HullShape): THREE.BufferGeometry => deckGeometry(s, 0, 1, undefined, 0);
