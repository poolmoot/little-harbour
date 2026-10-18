import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { barrel, bx, cy, doorAt, flat, gableRoof, put, tBox, windowAt } from './kit';
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
  barrel(g, 1.9, 1.6);
  w.box({ cx: T.x, cz: T.z, hx: 1.5, hz: 1.5, a: 0 });
}

function planter(g: THREE.Object3D, x: number, z: number, w: Build): void {
  bx(1.5, 0.5, 0.6, w.M.dark, x, 0.25, z, g);
  const cols = [0xf2c14e, 0xe8587a, 0xf6f0e0, 0xc27ad8, 0xff9a3c];
  for (let i = 0; i < 7; i++) put(new THREE.SphereGeometry(0.17, 6, 5), flat(i % 2 ? cols[i % 5] : 0x4f9a4a, 0.85), x - 0.6 + i * 0.2, 0.62, z + (i % 2 ? 0.08 : -0.08), g);
}

export function buildSquare(w: Build): void {
  const M = w.M, s = w.stat;
  const SQ = { x: 0, z: 8.7 };
  // paved square with a pale inner disc, set into the quay
  for (const [r, mat, y] of [[5.4, M.lip, 0.025], [3.1, flat(0xd9cdb0, 0.95), 0.032]] as const) {
    const geo = new THREE.CircleGeometry(r, 40);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv as THREE.BufferAttribute, p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.4, p.getZ(i) / 2.4);
    const m = put(geo, mat, SQ.x, y, SQ.z, s);
    m.castShadow = false;
  }
  // fountain (east side of the square, clear of the worker lane in the middle)
  const F = { x: 5.0, z: 8.7 }, stone = flat(0xa7aebd, 0.9), water = flat(0x77c6dc, 0.25);
  cy(1.7, 1.8, 0.55, stone, F.x, 0.3, F.z, s, 20);
  cy(1.45, 1.45, 0.05, water, F.x, 0.58, F.z, s, 20).castShadow = false;
  cy(0.22, 0.34, 1.2, stone, F.x, 0.9, F.z, s, 10);
  cy(0.8, 0.35, 0.22, stone, F.x, 1.5, F.z, s, 14);
  cy(0.62, 0.62, 0.04, water, F.x, 1.62, F.z, s, 14).castShadow = false;
  cy(0.05, 0.1, 0.8, flat(0xcfeaf5, 0.2), F.x, 2.0, F.z, s, 6);
  put(new THREE.SphereGeometry(0.16, 8, 6), flat(0xcfeaf5, 0.2), F.x, 2.45, F.z, s);
  w.disc({ cx: F.x, cz: F.z, r: 1.85 });
  // well (west side)
  const W = { x: -5.0, z: 8.7 };
  const wg = new THREE.Group();
  wg.position.set(W.x, 0, W.z);
  s.add(wg);
  cy(0.95, 1.0, 0.95, M.wall, 0, 0.48, 0, wg, 14);
  cy(0.72, 0.72, 0.04, flat(0x20323f, 0.2), 0, 0.92, 0, wg, 14).castShadow = false;
  for (const sx of [-1, 1]) bx(0.14, 2.0, 0.14, M.trim, sx * 0.85, 1.9, 0, wg);
  gableRoof(wg, 2.2, 1.5, 2.9, 0.75, M.redRoof, M.dark, 0.3);
  cy(0.05, 0.05, 1.0, M.rope, 0, 2.4, 0, wg, 5);
  cy(0.16, 0.12, 0.25, flat(0xb08a4a, 0.9), 0, 1.75, 0, wg, 8);
  w.disc({ cx: W.x, cz: W.z, r: 1.15 });
  // benches and flower tubs round the edge
  for (const sx of [-1, 1]) {
    const bxp = sx * 2.9, bz = 12.0;
    bx(1.6, 0.1, 0.45, M.crate, bxp, 0.5, bz, s);
    bx(1.6, 0.4, 0.08, M.crate, bxp, 0.8, bz + 0.2, s);
    for (const dx of [-0.65, 0.65]) bx(0.1, 0.5, 0.4, M.dark, bxp + dx, 0.25, bz, s);
    w.box({ cx: bxp, cz: bz, hx: 0.85, hz: 0.3, a: 0 });
    planter(s, sx * 6.7, 6.4, w);
    w.box({ cx: sx * 6.7, cz: 6.4, hx: 0.8, hz: 0.35, a: 0 });
  }
}

const PASTELS = [0xf3c9c0, 0xf6e3b4, 0xc9e2d0, 0xc4d8ee, 0xe8cfe6, 0xf2d6b0, 0xd5e6b8];

function house(w: Build, g: THREE.Object3D, x: number, y: number, z: number, wd: number, dp: number, ht: number, rot: number, k: number): void {
  const M = w.M;
  const h = new THREE.Group();
  h.position.set(x, y, z);
  h.rotation.y = rot;
  g.add(h);
  const wall = flat(PASTELS[k % PASTELS.length], 0.95);
  bx(wd, ht, dp, wall, 0, ht / 2, 0, h);
  const roofs = [M.redRoof, M.blueRoof, M.greenRoof];
  gableRoof(h, wd, dp, ht, 0.9 + (k % 3) * 0.35, roofs[k % 3], wall, 0.35);
  // the fronts look at the town (towards -z), where the windows and a door are
  doorAt(h, -wd * 0.2, -dp / 2 - 0.02, 0.9, 1.6, Math.PI);
  windowAt(h, wd * 0.25, ht * 0.55, -dp / 2 - 0.02, 0.7, 0.7, { ry: Math.PI, flowers: k % 2 === 0, shutter: k % 2 ? 0x3f6a86 : undefined });
  if (k % 3 === 0) bx(0.5, 1.2, 0.5, M.wall, wd * 0.3, ht + 0.9, dp * 0.2, h);
}

export function buildHillside(w: Build): void {
  const M = w.M, s = w.stat, r = seeded(7);
  const half = LAYOUT.quayMaxX + 3.5;
  const T1 = { z0: 15.4, z1: 22, y: 0.9 }, T2 = { z0: 24.2, z1: 31, y: 2.3 };
  for (const t of [T1, T2]) {
    const d = t.z1 - t.z0;
    tBox(half * 2, t.y + 0.8, 0.5, M.wall, 1.8, 0, (t.y - 0.8) / 2, t.z0, s);
    tBox(half * 2, 0.1, d, M.grass, 3, 0, t.y - 0.05, t.z0 + d / 2, s).castShadow = false;
    tBox(half * 2 + 0.3, 0.1, 0.7, M.lip, 2, 0, t.y + 0.01, t.z0 - 0.05, s);
    tBox(half * 2, t.y + 0.8, 0.5, M.wall, 1.8, 0, (t.y - 0.8) / 2, t.z1, s);
  }
  // stairs from the quay up to the first terrace
  const n = 6;
  for (let i = 0; i < n; i++) {
    const top = ((i + 1) * T1.y) / n;
    tBox(4.6, top + 0.5, 0.34, M.lip, 1.6, 0, (top - 0.5) / 2, LAYOUT.quayMaxZ + 0.55 + i * 0.3, s);
  }
  for (const sx of [-1, 1]) bx(0.3, 1.4, 2.2, M.wall, sx * 2.45, 0.5, LAYOUT.quayMaxZ + 1.5, s);
  // second stair, off to one side
  for (let i = 0; i < 5; i++) {
    const top = T1.y + ((i + 1) * (T2.y - T1.y)) / 5;
    tBox(3, top + 0.4, 0.34, M.lip, 1.6, 9, (top - 0.4) / 2, T1.z1 + 0.35 + i * 0.4, s);
  }
  let k = 0;
  for (const [t, xs, zc] of [[T1, [-23, -18.5, -13.5, -8.5, 8, 13.5, 18.5, 23], 18.7], [T2, [-22, -15.5, -8.5, -1, 6, 14, 21], 27.6]] as const) {
    for (const x of xs) {
      const wd = 3 + r() * 1.6, dp = 3 + r() * 1.0, ht = 2 + r() * 1.0;
      house(w, s, x + (r() - 0.5) * 1.2, t.y, zc + (r() - 0.5) * 1.6, wd, dp, ht, (r() - 0.5) * 0.3, k++);
    }
  }
  // garden walls and hedges between the houses and the stairs
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) put(new THREE.SphereGeometry(0.55 + (i % 2) * 0.15, 8, 6), flat([0x4aa84a, 0x5fb44e][i % 2], 1), sx * (4 + i * 0.9), T1.y + 0.35, 16.6, s);
}

/** Boulders in a line out into the sea at the ends of the quay, and the rocky point the lighthouse stands on. */
export function buildBreakwaters(w: Build): void {
  const L = LAYOUT, M = w.M, s = w.stat, r = seeded(21);
  const P = L.point, pw = P.x1 - P.x0, pd = P.z1 - P.z0;
  tBox(pw, 1.4, pd, M.cobble, 2.4, (P.x0 + P.x1) / 2, -0.7, (P.z0 + P.z1) / 2, s).castShadow = false;
  tBox(pw + 0.2, 0.16, 0.6, M.lip, 2, (P.x0 + P.x1) / 2, 0, P.z0 + 0.1, s).castShadow = false;
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
  // west breakwater: a curved line of boulders running out from the quay end
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    rock(L.quayMinX - 0.5 - Math.sin(t * 1.4) * 3.2 - r() * 0.8, -0.6 - t * 7.5 + (r() - 0.5) * 0.8, 1.5 - t * 0.5 + r() * 0.5);
  }
  // and round the lighthouse point
  for (let i = 0; i < 9; i++) rock(P.x0 - 0.4 - r() * 0.6, P.z0 + 0.4 + i * 0.55, 0.9 + r() * 0.5);
  for (let i = 0; i < 12; i++) rock(P.x0 - 0.2 + (i / 11) * (pw + 1.2), P.z0 - 0.5 - r() * 0.7, 0.9 + r() * 0.6);
  for (let i = 0; i < 6; i++) rock(P.x1 + 0.5 + r() * 0.6, P.z0 + i * 1.0 + 0.4, 1.0 + r() * 0.5);
}
