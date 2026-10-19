import * as THREE from 'three';

import { PIER_LAMPS, STREET_LAMPS } from '../sim/layoutBoxes';
import { haloSprite } from './fx';

import { bx, cy, lampMat, put } from './kit';
import type { Build } from './worldParts';

export function lampHead(w: Build, x: number, y: number, z: number, withLight: boolean, noPole = false): void {
  const M = w.M;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  w.stat.add(g);
  bx(0.28, 0.05, 0.28, M.iron, 0, -0.13, 0, g);
  put(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 8), lampMat, 0, 0.03, 0, g).castShadow = false;
  put(new THREE.ConeGeometry(0.22, 0.2, 8), M.iron, 0, 0.28, 0, g);
  cy(0.03, 0.03, 0.06, M.iron, 0, 0.42, 0, g, 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.025, 0.3, 0.025, M.iron, sx * 0.13, 0.03, sz * 0.13, g);
  if (noPole) bx(0.04, 0.5, 0.04, M.iron, 0, 0.55, 0, g);
  const halo = haloSprite(0xffc060, 2.8);
  halo.position.set(x, y + 0.03, z);
  w.group.add(halo);
  let light: THREE.PointLight | null = null;
  if (withLight) {
    light = new THREE.PointLight(0xffc070, 0, 16, 2);
    light.position.set(x, y + 0.1, z);
    w.group.add(light);
  }
  w.lamps.push({ light, halo, phase: Math.random() * 10 });
}

export function buildLanterns(w: Build): void {
  // Lamp posts in the gaps between the buildings and along the low wall, and on the pier, from the layout data. Only a few cast real light.
  const spots: [number, number, boolean][] = [...PIER_LAMPS, ...STREET_LAMPS.map(([x, z], i) => [x, z, i % 3 === 0] as [number, number, boolean])];
  for (const [x, z, lit] of spots) {
    const base = z < -2 ? 0.055 : 0;
    cy(0.14, 0.17, 0.3, w.M.iron, x, base + 0.15, z, w.stat, 8);
    cy(0.05, 0.07, 2.2, w.M.iron, x, base + 1.3, z, w.stat, 6);
    bx(0.06, 0.06, 0.4, w.M.iron, x, base + 2.3, z, w.stat);
    lampHead(w, x, base + 2.55, z, lit);
  }
}
