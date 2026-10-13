import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { SPECIES_COLOUR } from '../palette';

import { barrel, bx, crateBox, cy, fishGeo, flat, put, signMesh, tBox } from './kit';
import { lampHead } from './worldLamps';
import type { Build } from './worldParts';

export function buildMarket(w: Build): void {
  const { x, z } = LAYOUT.market, M = w.M, s = w.stat;
  tBox(4.2, 1.0, 2.0, M.wood, 1.6, x, 0.5, z, s);
  tBox(4.5, 0.1, 2.3, M.crate, 1.4, x, 1.05, z, s);
  for (const dx of [-2.05, 2.05]) for (const dz of [-0.95, 0.95]) cy(0.07, 0.08, 2.9, M.dark, x + dx, 1.45, z + dz, s, 6);
  const stripe = [0xd24a3a, 0xf6efe0];
  for (let i = 0; i < 7; i++) {
    const sl = bx(0.64, 0.07, 2.9, flat(stripe[i % 2], 0.95), x - 1.92 + i * 0.64, 2.9, z + 0.1, s);
    sl.rotation.x = 0.18;
    const v = bx(0.64, 0.3, 0.04, flat(stripe[i % 2], 0.95), x - 1.92 + i * 0.64, 2.64, z + 1.5, s);
    v.rotation.x = 0.1;
    put(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 8, 1, false, 0, Math.PI), flat(stripe[i % 2], 0.95), x - 1.92 + i * 0.64, 2.5, z + 1.52, s).rotation.set(Math.PI / 2, Math.PI / 2, 0);
  }
  bx(4.4, 0.12, 0.12, M.trim, x, 2.76, z + 1.45, s);
  // fish on ice trays
  const species = ['herring', 'mackerel', 'flounder', 'seabass', 'snapper', 'lobster'] as const;
  for (let i = 0; i < 4; i++) {
    const tx = x - 1.45 + i * 0.97;
    bx(0.8, 0.12, 0.56, flat(0xdde9f0, 0.5), tx, 1.17, z + 0.3, s);
    bx(0.7, 0.06, 0.46, flat(0xb9d8e8, 0.3), tx, 1.23, z + 0.3, s);
    for (let k = 0; k < 3; k++) {
      const f = put(fishGeo(), flat(SPECIES_COLOUR[species[(i + k) % 6]], 0.45), tx - 0.16 + k * 0.17, 1.33, z + 0.3 + (k % 2 ? 0.1 : -0.1), s);
      f.scale.setScalar(0.42);
      f.rotation.set(0, Math.PI / 2 + (k - 1) * 0.2, k * 0.1);
    }
  }
  // hanging fish string and scale
  bx(3.6, 0.03, 0.03, M.rope, x, 2.45, z + 1.3, s);
  for (let i = 0; i < 6; i++) {
    const f = put(fishGeo(), flat(SPECIES_COLOUR[species[i % 4]], 0.45), x - 1.5 + i * 0.6, 2.2, z + 1.3, s);
    f.scale.setScalar(0.5);
    f.rotation.set(0, 0, Math.PI / 2);
  }
  const sign = signMesh('FISH MARKET', 2.6, 0.5, '#2f6f8f');
  sign.position.set(x, 1.9, z + 1.1);
  w.group.add(sign);
  w.signs.push({ m: sign, phase: 0 });
  lampHead(w, x + 1.7, 2.5, z + 0.6, false, true);
  // scale + baskets on the counter
  cy(0.2, 0.2, 0.04, flat(0xb89a5a, 0.4), x + 1.2, 1.14, z - 0.5, s, 10);
  for (const dx of [-0.6, 0, 0.6]) put(new THREE.CylinderGeometry(0.2, 0.15, 0.2, 8), flat(0xb08a4a, 0.95), x + dx, 1.2, z - 0.55, s);
  w.solid({ x0: x - 2.2, x1: x + 2.2, z0: z - 1.1, z1: z + 1.1 });
  w.stallSolid = { x0: x - 2.2, x1: x + 2.2, z0: z - 1.1, z1: z + 1.1 };
  w.solid(w.stallSolid);
  buildStallWings(w);
}

/** Market stall upgrades: a wing on each side per level, shown by setStall(). */
function buildStallWings(w: Build): void {
  const build = w;
  const { x, z } = LAYOUT.market, M = w.M;
  const stripe = [0xd24a3a, 0xf6efe0];
  const species = ['cod', 'tuna', 'seabass', 'snapper'] as const;
  for (let lvl = 1; lvl <= 2; lvl++) {
    const g = new THREE.Group();
    g.visible = false;
    const w = lvl === 1 ? 1.0 : 0.8;
    const off = lvl === 1 ? 2.1 + w / 2 : 2.1 + 1.0 + w / 2;
    for (const side of [-1, 1]) {
      const cx = x + side * off;
      tBox(w, 1.0, 2.0, M.wood, 1.6, cx, 0.5, z, g);
      tBox(w + 0.1, 0.1, 2.3, M.crate, 1.4, cx, 1.05, z, g);
      for (const dz of [-0.95, 0.95]) cy(0.07, 0.08, 2.9, M.dark, cx + side * (w / 2 - 0.05), 1.45, z + dz, g, 6);
      for (let i = 0; i < 2; i++) {
        const sl = bx(w / 2, 0.07, 2.9, flat(stripe[(i + lvl) % 2], 0.95), cx - w / 4 + i * (w / 2), 2.9, z + 0.1, g);
        sl.rotation.x = 0.18;
        const v = bx(w / 2, 0.3, 0.04, flat(stripe[(i + lvl) % 2], 0.95), cx - w / 4 + i * (w / 2), 2.64, z + 1.5, g);
        v.rotation.x = 0.1;
      }
      bx(w - 0.1, 0.12, 0.56, flat(0xdde9f0, 0.5), cx, 1.17, z + 0.3, g);
      bx(w - 0.2, 0.06, 0.46, flat(0xb9d8e8, 0.3), cx, 1.23, z + 0.3, g);
      for (let k = 0; k < 3; k++) {
        const f = put(fishGeo(), flat(SPECIES_COLOUR[species[(k + lvl + (side > 0 ? 1 : 0)) % 4]], 0.45), cx - 0.22 + k * 0.22, 1.33, z + 0.3 + (k % 2 ? 0.1 : -0.1), g);
        f.scale.setScalar(0.4);
        f.rotation.set(0, Math.PI / 2 + (k - 1) * 0.2, k * 0.1);
      }
      // crates, barrel and a hanging catch behind the counter
      crateBox(g, cx, 0, z - 0.4, 0.55, 0.3 + side);
      if (lvl === 2) barrel(g, cx + side * (w / 2 + 0.35), z - 0.1);
      bx(w, 0.03, 0.03, M.rope, cx, 2.45, z + 1.3, g);
      const f = put(fishGeo(), flat(SPECIES_COLOUR[species[(lvl + side + 1) % 4]], 0.45), cx, 2.2, z + 1.3, g);
      f.scale.setScalar(0.5);
      f.rotation.set(0, 0, Math.PI / 2);
    }
    build.stallWings.push(g);
    build.group.add(g);
  }
}

export function buildVane(w: Build): void {
  const { x, z } = LAYOUT.inn;
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.28, metalness: 0.85, emissive: 0x6a4a00, emissiveIntensity: 0.35 });
  w.vane.position.set(x - 2.9, 7.1, z);
  w.vane.visible = false;
  put(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6), gold, 0, 0.75, 0, w.vane);
  put(new THREE.SphereGeometry(0.1, 10, 8), gold, 0, 1.5, 0, w.vane);
  // compass cross
  for (const r of [0, Math.PI / 2]) bx(0.9, 0.04, 0.04, gold, 0, 1.15, 0, w.vane).rotation.y = r;
  for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) put(new THREE.SphereGeometry(0.05, 6, 5), gold, dx, 1.15, dz, w.vane);
  // the vane itself: an arrow with a fish-shaped tail, pivoting on the pole
  w.vaneArrow.position.set(0, 1.5, 0);
  bx(1.2, 0.05, 0.05, gold, 0, 0, 0, w.vaneArrow);
  put(new THREE.ConeGeometry(0.1, 0.3, 6), gold, 0.7, 0, 0, w.vaneArrow).rotation.z = -Math.PI / 2;
  const fin = put(new THREE.ConeGeometry(0.25, 0.5, 4), gold, -0.75, 0, 0, w.vaneArrow);
  fin.rotation.set(0, 0, Math.PI / 2);
  fin.scale.set(1, 1, 0.12);
  w.vane.add(w.vaneArrow);
  w.vane.traverse((o) => { o.castShadow = true; });
  w.group.add(w.vane);
}
