import * as THREE from 'three';
import { LAYOUT } from '../sim/config';

import { barrel, bollard, bx, crateBox, cy, flat, net, put, ropeCoil, tBox } from './kit';
import { landPatch } from './nature';
import { lampHead } from './worldLamps';
import type { Build } from './worldParts';
import { BEDS } from './worldParts';

export function buildGround(w: Build): void {
  const L = LAYOUT, M = w.M, s = w.stat;
  tBox(L.quayMaxX - L.quayMinX, 1.4, L.quayMaxZ, M.cobble, 2.4, 0, -0.7, L.quayMaxZ / 2, s).castShadow = false;
  tBox(L.quayMaxX - L.quayMinX + 0.2, 0.16, 0.6, M.lip, 2, 0, 0.0, 0.3, s).castShadow = false;
  // flagstone avenue from the pier to the green, and a worn forecourt in front of each building
  tBox(5.2, 0.03, 14, M.lip, 2, 0, 0.012, 7, s).castShadow = false;
  for (const [bx0, bz0, bw, bd] of [[-8, 4.6, 6, 3.2], [-15, 3.6, 8, 5], [10.5, 3.6, 8.4, 5.4]] as const) tBox(bw, 0.02, bd, M.lip, 2, bx0, 0.01, bz0 + 1.5, s).castShadow = false;
  // planted beds on the quay: a stone surround, a lawn, and a tree trunk to walk around
  for (const [x0, x1, z0, z1] of BEDS) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    tBox(x1 - x0 + 0.5, 0.05, z1 - z0 + 0.5, M.lip, 2, cx, 0.02, cz, s).castShadow = false;
    tBox(x1 - x0, 0.05, z1 - z0, M.grass, 3, cx, 0.045, cz, s).castShadow = false;
    w.solid({ x0: cx - 0.3, x1: cx + 0.3, z0: cz - 0.3, z1: cz + 0.3 });
  }
  // retaining wall between quay and the green verge
  tBox(L.quayMaxX - L.quayMinX, 0.5, 0.35, M.wall, 1.6, 0, 0.1, L.quayMaxZ + 0.15, s);
  tBox(L.quayMaxX - L.quayMinX + 0.3, 0.1, 0.55, M.lip, 2, 0, 0.38, L.quayMaxZ + 0.15, s);
  const gtex = M.grass.map as THREE.Texture;
  w.group.add(landPatch(gtex, -100, -22, -8, 110), landPatch(gtex, 22, 100, -8, 110), landPatch(gtex, -22, 22, 14, 110));
  // stone skirts where the land meets the water
  tBox(78, 1.5, 0.4, M.wall, 1.8, 61, -0.78, -8.2, s);
  tBox(78, 1.5, 0.4, M.wall, 1.8, -61, -0.78, -8.2, s);
  tBox(0.4, 1.5, 8.2, M.wall, 1.8, 22.2, -0.78, -4, s);
  tBox(0.4, 1.5, 8.2, M.wall, 1.8, -22.2, -0.78, -4, s);
  // quay end steps down to the rocks
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) tBox(1.6, 0.18, 6 - i, M.lip, 2, sx * (21.2 - i * 0.2), -0.1 - i * 0.18, 3.5, s).castShadow = false;
}

export function buildPier(w: Build): void {
  const L = LAYOUT, M = w.M, s = w.stat;
  const len = -L.pierEndZ, pw = L.pierHalfWidth * 2;
  tBox(pw, 0.35, len, M.pier, 2, 0, -0.12, -len / 2, s);
  for (const sx of [-1, 1]) bx(0.2, 0.34, len, M.dark, sx * (L.pierHalfWidth - 0.1), -0.4, -len / 2, s);
  for (let z = -1; z > L.pierEndZ; z -= 3) bx(pw + 0.2, 0.14, 0.22, M.dark, 0, -0.34, z, s);
  // piles with caps and rope rails
  const zs: number[] = [];
  for (let z = -1; z >= L.pierEndZ + 0.5; z -= 3) zs.push(z);
  for (const sx of [-1, 1]) {
    for (const z of zs) {
      const x = sx * (L.pierHalfWidth - 0.05);
      cy(0.17, 0.2, 2.4, M.dark, x, -0.55, z, s, 8);
      cy(0.2, 0.17, 0.08, M.trim, x, 0.62, z, s, 8);
    }
    for (let i = 0; i < zs.length - 1; i++) {
      const x = sx * (L.pierHalfWidth - 0.05);
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.55, zs[i]), new THREE.Vector3(x, 0.4, (zs[i] + zs[i + 1]) / 2), new THREE.Vector3(x, 0.55, zs[i + 1])]);
      put(new THREE.TubeGeometry(c, 8, 0.025, 5, false), M.rope, 0, 0, 0, s);
    }
  }
  for (const b of L.berths) {
    bollard(s, b.edgeX * 1.05, 0.055, b.edgeZ + 1.2);
    bollard(s, b.edgeX * 1.05, 0.055, b.edgeZ - 1.2);
  }
  // fishing spot: painted pad, bucket, rod rack, stool, rope, nets
  bx(0.7, 0.012, 0.7, flat(0xe2b640, 0.8), 0, 0.066, L.fishingSpot.z, s).castShadow = false;
  const bz = L.pierEndZ + 0.9;
  cy(0.25, 0.2, 0.4, flat(0x4a6fa5, 0.6), 1.3, 0.25, bz, s);
  cy(0.22, 0.22, 0.02, flat(0x2f4f78), 1.3, 0.45, bz, s, 12);
  for (const dx of [-0.2, 0.2]) cy(0.05, 0.05, 1.3, M.trim, -1.4 + dx, 0.7, bz - 0.1, s, 6);
  for (let i = 0; i < 3; i++) {
    const rod = cy(0.012, 0.025, 2.0, M.trim, -1.4, 1.2, bz - 0.1 + (i - 1) * 0.05, s, 5);
    rod.rotation.z = 0.12 * (i - 1) + 0.1;
  }
  cy(0.22, 0.2, 0.34, M.dark, -1.2, 0.22, bz + 0.5, s, 8);
  ropeCoil(s, 1.0, 0.055, bz + 1.4, 1.1);
  barrel(s, -1.35, L.pierEndZ + 1.8, 0.055, 0.9);
  crateBox(s, 1.4, 0.055, L.pierEndZ + 2.2, 0.55, 0.3);
  net(w.group, 1.4, 0.9, 1.1, 0.35, bz + 0.45, 0.4);
  // end-of-pier lantern post
  cy(0.07, 0.09, 2.6, M.iron, -1.75, 1.3, L.pierEndZ + 0.3, s, 6);
  lampHead(w, -1.75, 2.7, L.pierEndZ + 0.3, false);
}

export function buildQuayDetail(w: Build): void {
  const s = w.stat;
  for (let x = -20; x <= 20; x += 5) if (Math.abs(x) > 3) bollard(s, x, 0.08, 0.75);
  barrel(s, 14.6, 5.2 + 0.6, 0, 1, true);
  ropeCoil(s, -6.3, 0, 1.4, 1.2);
  ropeCoil(s, 6.5, 0, 1.2, 1);
  crateBox(s, 8.8, 0, 1.3, 0.7, 0.4);
  crateBox(s, -17.5, 0, 9.2, 0.8, 0.1);
  crateBox(s, -16.5, 0, 9.4, 0.6, 0.7);
  barrel(s, 17.8, 7.5);
  barrel(s, 18.5, 7.1);
  net(w.group, 1.4, 0.8, -2.5, 0.5, 0.9, 0.1);
}
