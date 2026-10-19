import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { bx, cy, doorAt, flat, gableRoof, put, tBox, windowAt } from './kit';
import { BENCHES, PLANTERS } from '../sim/layoutBoxes';
import type { Build } from './worldParts';

/** The landmark clock tower, the small square with its fountain and well, the hillside behind the town, and the rocky ends of the quay. */

/** Same little random run every time, so the town looks the same on each start. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BRASS = () => flat(0xd8a640, 0.35);

function clockFace(g: THREE.Object3D, x: number, y: number, z: number, ry: number, w: Build): void {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.rotation.y = ry;
  cy(0.78, 0.78, 0.1, w.M.trim, 0, 0, 0, f, 20).rotation.x = Math.PI / 2;
  const face = cy(0.64, 0.64, 0.12, flat(0xf6efe0, 0.5), 0, 0, 0.01, f, 20);
  face.rotation.x = Math.PI / 2;
  face.castShadow = false;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    bx(0.06, i % 3 === 0 ? 0.16 : 0.09, 0.03, w.M.iron, Math.sin(a) * 0.52, Math.cos(a) * 0.52, 0.08, f).rotation.z = -a;
  }
  const hand = (len: number, rz: number, wd: number) => {
    const h = bx(wd, len, 0.03, w.M.iron, Math.sin(rz) * len * 0.5, Math.cos(rz) * len * 0.5, 0.1, f);
    h.rotation.z = -rz;
  };
  hand(0.36, 0.9, 0.07);
  hand(0.52, -0.7, 0.045);
  g.add(f);
}

export function buildTower(w: Build): void {
  const T = LAYOUT.bellTower, M = w.M;
  const g = new THREE.Group();
  g.position.set(T.x, 0, T.z);
  g.rotation.y = T.rot;
  w.stat.add(g);
  bx(3.3, 0.3, 3.3, M.lip, 0, 0.15, 0, g);
  tBox(2.8, 4.0, 2.8, M.wall, 1.8, 0, 2.3, 0, g);
  tBox(2.4, 4.6, 2.4, M.cream, 2, 0, 6.6, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.26, 8.6, 0.26, M.trim, sx * 1.22, 4.6, sz * 1.22, g);
  bx(2.9, 0.22, 2.9, M.trim, 0, 8.95, 0, g);
  // belfry: four posts, a gallery rail and the bell
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.28, 2.2, 0.28, M.trim, sx * 1.1, 10.1, sz * 1.1, g);
  bx(2.6, 0.14, 2.6, M.dark, 0, 9.12, 0, g);
  for (const a of [0, Math.PI / 2]) bx(2.2, 0.12, 0.12, M.dark, 0, 10.6, 0, g).rotation.y = a;
  cy(0.18, 0.5, 0.8, BRASS(), 0, 10.0, 0, g, 12);
  put(new THREE.SphereGeometry(0.12, 8, 6), BRASS(), 0, 9.55, 0, g);
  bx(2.9, 0.18, 2.9, M.trim, 0, 11.3, 0, g);
  const roof = put(new THREE.ConeGeometry(2.3, 3.1, 4), M.redRoof, 0, 13.0, 0, g);
  roof.rotation.y = Math.PI / 4;
  cy(0.04, 0.06, 1.0, M.iron, 0, 15.0, 0, g, 5);
  put(new THREE.SphereGeometry(0.14, 8, 6), BRASS(), 0, 15.55, 0, g);
  // clock faces on all four sides (the one towards the camera matters most), a door and flower boxes at the foot
  clockFace(g, 0, 6.7, 1.26, 0, w);
  clockFace(g, 0, 6.7, -1.26, Math.PI, w);
  clockFace(g, 1.26, 6.7, 0, Math.PI / 2, w);
  clockFace(g, -1.26, 6.7, 0, -Math.PI / 2, w);
  doorAt(g, 0, 1.4, 1.1, 2.0);
  windowAt(g, 0, 3.4, 1.42, 0.55, 0.85, { shutter: 0x2f6f8f, flowers: true });
  windowAt(g, 1.42, 3.2, 0, 0.55, 0.8, { ry: Math.PI / 2 });
  windowAt(g, -1.42, 3.2, 0, 0.55, 0.8, { ry: -Math.PI / 2 });
}

function planter(g: THREE.Object3D, x: number, z: number, w: Build): void {
  bx(1.5, 0.5, 0.6, w.M.dark, x, 0.25, z, g);
  const cols = [0xf2c14e, 0xe8587a, 0xf6f0e0, 0xc27ad8, 0xff9a3c];
  for (let i = 0; i < 7; i++) put(new THREE.SphereGeometry(0.17, 6, 5), flat(i % 2 ? cols[i % 5] : 0x4f9a4a, 0.85), x - 0.6 + i * 0.2, 0.62, z + (i % 2 ? 0.08 : -0.08), g);
}

/** The few props on the camera side of the street: benches that face the street and flower tubs. Their footprints are in layoutBoxes.ts. */
export function buildSquare(w: Build): void {
  const M = w.M, s = w.stat;
  for (const [bxp, bz] of BENCHES) {
    bx(1.6, 0.1, 0.45, M.crate, bxp, 0.5, bz, s);
    bx(1.6, 0.4, 0.08, M.crate, bxp, 0.8, bz + 0.2, s);
    for (const dx of [-0.65, 0.65]) bx(0.1, 0.5, 0.4, M.dark, bxp + dx, 0.25, bz, s);
  }
  for (const [px, pz] of PLANTERS) planter(s, px, pz, w);
}

const PASTELS = [0xe9d9d2, 0xefe6d0, 0xd6e1d8, 0xd5dfea, 0xe4d9e4, 0xecdec6, 0xdde6cd];
const SOFT_ROOFS = [0xc99086, 0x8fa8b8, 0x93ae95];

/** A hillside house: decoration only. Windows and shutters only, no door, soft colours, low. */
function house(g: THREE.Object3D, x: number, y: number, z: number, wd: number, dp: number, ht: number, k: number): void {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  g.add(h);
  const wall = flat(PASTELS[k % PASTELS.length], 0.97);
  bx(wd, ht, dp, wall, 0, ht / 2, 0, h);
  gableRoof(h, wd, dp, ht, 0.8 + (k % 3) * 0.25, flat(SOFT_ROOFS[k % 3], 0.95), wall, 0.35);
  windowAt(h, wd * 0.25, ht * 0.55, -dp / 2 - 0.02, 0.7, 0.7, { ry: Math.PI, flowers: k % 2 === 0, shutter: k % 2 ? 0xa9bfcc : undefined });
  windowAt(h, -wd * 0.25, ht * 0.55, -dp / 2 - 0.02, 0.7, 0.7, { ry: Math.PI });
}

export function buildHillside(w: Build): void {
  const M = w.M, s = w.stat, r = seeded(7), Q = LAYOUT.square;
  const half = LAYOUT.quayMaxX + 3.5, wallEnd = Q.z1 + 0.7;
  const T1 = { z0: wallEnd + 3.6, z1: wallEnd + 10.2, y: 0.9 }, T2 = { z0: wallEnd + 12.4, z1: wallEnd + 19.2, y: 2.3 };
  for (const t of [T1, T2]) {
    const d = t.z1 - t.z0;
    tBox(half * 2, t.y + 0.8, 0.5, M.wall, 1.8, 0, (t.y - 0.8) / 2, t.z0, s);
    tBox(half * 2, 0.1, d, M.grass, 3, 0, t.y - 0.05, t.z0 + d / 2, s).castShadow = false;
    tBox(half * 2 + 0.3, 0.1, 0.7, M.lip, 2, 0, t.y + 0.01, t.z0 - 0.05, s);
    tBox(half * 2, t.y + 0.8, 0.5, M.wall, 1.8, 0, (t.y - 0.8) / 2, t.z1, s);
  }
  // steps from the square, through the gap in the low wall, up to the first terrace
  const n = 6, stepD = (T1.z0 - wallEnd) / n;
  for (let i = 0; i < n; i++) {
    const top = ((i + 1) * T1.y) / n;
    tBox(4.6, top + 0.5, stepD, M.lip, 1.6, 0, (top - 0.5) / 2, wallEnd + stepD * (i + 0.5), s);
  }
  for (const sx of [-1, 1]) bx(0.3, 1.4, T1.z0 - wallEnd, M.wall, sx * 2.45, 0.5, (wallEnd + T1.z0) / 2, s);
  // second stair, off to one side
  for (let i = 0; i < 5; i++) {
    const top = T1.y + ((i + 1) * (T2.y - T1.y)) / 5;
    tBox(3, top + 0.4, 0.34, M.lip, 1.6, 9, (top - 0.4) / 2, T1.z1 + 0.35 + i * 0.4, s);
  }
  // low houses, spread evenly along each terrace (stairs and the gap above them left open)
  let k = 0;
  for (const [t, step, zc] of [[T1, 7.4, T1.z0 + 3.4], [T2, 9.4, T2.z0 + 3.4]] as const) {
    for (let x = -half + 3; x < half - 2; x += step) {
      if (Math.abs(x) < 5 || Math.abs(x - 9) < 3 && t === T2) continue;
      const wd = 3 + r() * 1.4, dp = 3 + r() * 0.8, ht = 1.8 + r() * 0.8;
      house(s, x + (r() - 0.5) * 0.8, t.y, zc + (r() - 0.5) * 1.2, wd, dp, ht, k++);
    }
  }
  // garden hedges beside the stairs
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) put(new THREE.SphereGeometry(0.55 + (i % 2) * 0.15, 8, 6), flat([0x4aa84a, 0x5fb44e][i % 2], 1), sx * (4 + i * 0.9), T1.y + 0.35, T1.z0 + 0.8, s);
}

/** Boulders along the water's edge round the town, and the stone-walled end of the breakwater the lighthouse stands on. */
export function buildBreakwaters(w: Build): void {
  const L = LAYOUT, M = w.M, s = w.stat, r = seeded(21), Q = L.square, B = L.breakwater;
  const rockG = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = rockG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.22 * Math.sin(x * 5 + y * 3) * Math.cos(z * 4 - y * 2);
      p.setXYZ(i, x * k, y * k * 0.7, z * k);
    }
    rockG.computeVertexNormals();
  }
  const greys = [0x8a9096, 0x7d8387, 0x9a9890, 0x6f767c].map((c) => flat(c, 0.95));
  const rock = (x: number, z: number, sz: number) => {
    const m = put(rockG, greys[Math.floor(r() * 4)], x, -0.1 + sz * 0.15, z, s);
    m.scale.set(sz * 1.25, sz, sz * 1.05);
    m.rotation.set(r() * 0.5, r() * 6, r() * 0.4);
    m.userData.noInk = true;
  };
  const run = (x0: number, z0: number, x1: number, z1: number, step: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) rock(x0 + ((x1 - x0) * i) / n + (r() - 0.5) * 0.4, z0 + ((z1 - z0) * i) / n + (r() - 0.5) * 0.4, 0.7 + r() * 0.7);
  };
  const sea = L.shoreZ - 0.5, yardSea = L.shipyardShoreZ - 0.5, side = L.quayMaxX + 0.5;
  // behind the sea row, either side of the pier gap
  run(Q.x0, sea, -3.7, sea, 1.9);
  run(3.7, sea, B.x0 - 0.3, sea, 1.9);
  // along the two outer shores, and behind the shipyard and the east grass
  run(-side, yardSea, -side, Q.z1 + 0.2, 2.2);
  run(side, sea, side, Q.z1 + 0.2, 2.2);
  run(-side + 0.5, yardSea, -17.2, yardSea, 1.9);
  run(-12.8, yardSea, Q.x0, yardSea, 1.9);
  run(B.x1 + 0.6, sea, side, sea, 1.9);
  // round the breakwater: both sides and the sea end
  run(B.x0 - 0.5, B.z0, B.x0 - 0.5, sea, 1.8);
  run(B.x1 + 0.5, B.z0, B.x1 + 0.5, sea, 1.8);
  run(B.x0 - 0.2, B.z0 - 0.5, B.x1 + 0.2, B.z0 - 0.5, 1.6);
  // the sea end of the breakwater has a stone lip too
  tBox(B.x1 - B.x0, 0.16, 0.6, M.lip, 2, (B.x0 + B.x1) / 2, 0, B.z0 + 0.1, s).castShadow = false;
}
