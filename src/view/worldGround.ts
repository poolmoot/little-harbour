import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { barrel, bollard, bx, crateBox, cy, flat, net, put, ropeCoil, tBox } from './kit';
import { landPatch } from './nature';
import { lampHead } from './worldLamps';
import type { Build } from './worldParts';
import { BEDS } from './worldParts';

/**
 * The ground: the paved square with the sea row's strip behind it, the grass behind the two side rows, the paved link and breakwater out to the
 * lighthouse, the low wall on the camera side (with a gap for the steps up to the hillside) and the planted beds outside it. Every slab is a flat
 * box (they merge into a handful of draw calls); the heights of the land behind the town are shaped in nature.ts.
 */
export function buildGround(w: Build): void {
  const L = LAYOUT, S = L.square, M = w.M, s = w.stat;
  const slab = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, tile: number) => {
    tBox(x1 - x0, 1.4, z1 - z0, mat, tile, (x0 + x1) / 2, -0.7, (z0 + z1) / 2, s).castShadow = false;
  };
  const zEnd = S.z1 + 0.2, pier = L.pierHalfWidth + 1, B = L.breakwater;
  // the square, and the sea row's strip behind it on each side of the pier gap
  slab(S.x0, S.x1, S.z0, zEnd, M.cobble, 2.4);
  slab(S.x0, -pier, L.shoreZ, S.z0, M.cobble, 2.4);
  slab(pier, S.x1, L.shoreZ, S.z0, M.cobble, 2.4);
  // a stone lip along the water's edge behind the sea row
  for (const [x0, x1] of [[S.x0, -pier], [pier, S.x1]]) tBox(x1 - x0, 0.16, 0.45, M.lip, 2, (x0 + x1) / 2, 0.0, L.shoreZ + 0.225, s).castShadow = false;
  // grass behind the two side rows (the shipyard reaches a little further out to the water)
  slab(L.quayMinX, S.x0, L.shipyardShoreZ, zEnd, M.grass, 3);
  slab(S.x1, L.quayMaxX, B.z1, zEnd, M.grass, 3);
  slab(B.x1, L.quayMaxX, L.shoreZ, B.z1, M.grass, 3);
  // the paved link from the square's top-right corner and the breakwater out to the lighthouse
  slab(S.x1, B.x1, B.z0, B.z1, M.cobble, 2.4);
  tBox(0.3, 0.16, B.z1 - B.z0, M.lip, 2, B.x1 - 0.15, 0.0, (B.z0 + B.z1) / 2, s).castShadow = false;
  tBox(B.x1 - S.x1, 0.16, 0.3, M.lip, 2, (S.x1 + B.x1) / 2, 0.0, B.z0 + 0.15, s).castShadow = false;
  // planted beds outside the low wall on the camera side: a stone surround and a lawn, with a tree trunk (solid, from the layout data)
  for (const [x0, x1, z0, z1] of BEDS) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    tBox(x1 - x0 + 0.5, 0.05, z1 - z0 + 0.5, M.lip, 2, cx, 0.02, cz, s).castShadow = false;
    tBox(x1 - x0, 0.05, z1 - z0, M.grass, 3, cx, 0.045, cz, s).castShadow = false;
  }
  // the low wall along the camera side of the square, with a gap in the middle for the steps up to the hillside
  const stair = 3, wz = zEnd + 0.25, half = L.quayMaxX;
  for (const [x0, x1] of [[-half, -stair], [stair, half]]) {
    tBox(x1 - x0, 0.7, 0.5, M.wall, 1.6, (x0 + x1) / 2, 0.1, wz, s);
    tBox(x1 - x0 + 0.1, 0.12, 0.65, M.lip, 2, (x0 + x1) / 2, 0.49, wz, s);
  }
  // the land behind the town: grass round the whole camera side, rising into hills (the ground height is shaped in nature.ts)
  w.group.add(landPatch(M.grass.map as THREE.Texture, -100, 100, zEnd, 110));
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
  w.signs.push({ m: net(w.group, 1.4, 0.9, 1.1, 0.35, bz + 0.45, 0.4), phase: 0.7 });
  // end-of-pier lantern post
  cy(0.07, 0.09, 2.6, M.iron, -1.75, 1.3, L.pierEndZ + 0.3, s, 6);
  lampHead(w, -1.75, 2.7, L.pierEndZ + 0.3, false);
}

export function buildQuayDetail(w: Build): void {
  // a fishing net drying by the pier mouth
  w.signs.push({ m: net(w.group, 1.4, 0.8, -2.9, 0.5, 1.6, 0.1), phase: 2.1 });
}
