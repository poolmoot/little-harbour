import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { BENCHES, LAWNS, PLANTERS, STREET_LAMPS } from '../sim/layoutBoxes';
import { flat, put, tBox } from './kit';
import type { Build } from './worldParts';

/**
 * Ground dressing for the open street and square: a compass rose set into the square, kerbs and drain grates along the
 * street, worn patches of different stone, and a grass verge with flowers on the camera side. Everything here is flat
 * or ankle-high and can be walked over, so none of it belongs in the layout data.
 */

const SQUARE_CENTRE = { x: 0, z: 6.6 };
const ROSE_R = 3.2;
/** Stone tones for the worn patches, close to the paving so they read as wear and repair, not as clutter. */
const STONE = [0xd2c6aa, 0xcbbd9f, 0xdbd0b8, 0xc4b597, 0xd6c9ad];
const PATCHES = 520;
const VERGE_Z0 = 15.45, VERGE_Z1 = 16.25;
const FLOWER_COLOURS = [0xf2c14e, 0xe8587a, 0xf6f0e0, 0xc27ad8, 0xff9a3c, 0x6fb7ff];

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** A star-shaped compass rose inlaid in the square: four long points, four short ones, a gold boss in the middle. */
function compassRose(w: Build): void {
  const s = w.stat, { x, z } = SQUARE_CENTRE;
  put(new THREE.CircleGeometry(ROSE_R, 48).rotateX(-Math.PI / 2), flat(0xe8dcc0, 0.95), x, 0.036, z, s).castShadow = false;
  put(new THREE.RingGeometry(ROSE_R, ROSE_R + 0.32, 48).rotateX(-Math.PI / 2), w.M.wall, x, 0.038, z, s).castShadow = false;
  put(new THREE.RingGeometry(ROSE_R * 0.86, ROSE_R * 0.9, 48).rotateX(-Math.PI / 2), flat(0x8a6a4a, 0.9), x, 0.039, z, s).castShadow = false;
  const point = (len: number, half: number, angle: number, colour: number, y: number) => {
    // each point is two triangles, a light side and a dark side, like a carved stone star
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(side * half, half);
      shape.lineTo(0, len);
      shape.closePath();
      const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).rotateY(angle);
      put(g, flat(side < 0 ? colour : new THREE.Color(colour).multiplyScalar(0.72).getHex(), 0.9), x, y, z, s).castShadow = false;
    }
  };
  for (let i = 0; i < 4; i++) point(ROSE_R * 0.42, 0.34, i * Math.PI / 2 + Math.PI / 4, 0xb5a07c, 0.04);
  for (let i = 0; i < 4; i++) point(ROSE_R * 0.8, 0.5, i * Math.PI / 2, i === 0 ? 0xd6453a : 0x2f5f9a, 0.041);
  put(new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2), flat(0xe0b040, 0.5), x, 0.043, z, s).castShadow = false;
}

/** Kerbs on both edges of the street lane, with iron drain grates set into the camera-side gutter. */
function kerbs(w: Build): void {
  const L = LAYOUT, s = w.stat, width = L.quayMaxX - L.quayMinX - 1;
  const kerb = flat(0x9f9482, 0.95), iron = flat(0x3a3f46, 0.6);
  tBox(width, 0.06, 0.28, kerb, 4, 0, 0.03, L.street.z1 + 0.14, s).castShadow = false;
  tBox(width, 0.02, 0.5, flat(0xb3a68c, 0.95), 4, 0, 0.022, L.street.z1 - 0.3, s).castShadow = false;
  for (let gx = L.quayMinX + 6; gx < L.quayMaxX - 4; gx += 9) {
    if (Math.abs(gx) < 7) continue; // keep the square clean
    put(new THREE.BoxGeometry(0.7, 0.02, 0.36), iron, gx, 0.036, L.street.z1 - 0.3, s).castShadow = false;
    for (let i = -2; i <= 2; i++) put(new THREE.BoxGeometry(0.04, 0.025, 0.3), flat(0x1f2328, 0.6), gx + i * 0.13, 0.04, L.street.z1 - 0.3, s).castShadow = false;
  }
}

/** Worn and repaired stones scattered over the paving, so the long street is not one flat colour. */
function patches(w: Build): void {
  const L = LAYOUT, r = seeded(91);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.004, 1), new THREE.MeshStandardMaterial({ roughness: 0.95 }), PATCHES);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < PATCHES; i++) {
    const x = L.quayMinX + 1 + r() * (L.quayMaxX - L.quayMinX - 2);
    const z = 0.8 + r() * (L.street.z1 - 0.8);
    const size = 0.28 + r() * 0.36;
    m.compose(p.set(x, 0.046, z), q.setFromEuler(e.set(0, r() * Math.PI, 0)), sc.set(size, 1, size * (0.6 + r() * 0.6)));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(STONE[Math.floor(r() * STONE.length)]));
  }
  mesh.receiveShadow = true;
  mesh.userData.keep = true;
  w.group.add(mesh);
}

/** Grass verge with flowers along the camera side of the street, broken where the benches, tubs, lawns and lamps stand. */
function verge(w: Build): void {
  const L = LAYOUT, s = w.stat, r = seeded(17);
  const gaps: [number, number][] = [
    ...BENCHES.map(([x]) => [x - 1.2, x + 1.2] as [number, number]),
    ...PLANTERS.map(([x]) => [x - 1.1, x + 1.1] as [number, number]),
    ...LAWNS.map(([x0, x1]) => [x0, x1] as [number, number]),
    ...STREET_LAMPS.map(([x]) => [x - 0.5, x + 0.5] as [number, number]),
    [-7, 7] as [number, number], // the square stays open to the street
  ].sort((a, b) => a[0] - b[0]);
  const runs: [number, number][] = [];
  let from = L.quayMinX + 1;
  for (const [g0, g1] of gaps) {
    if (g0 > from + 1) runs.push([from, g0]);
    from = Math.max(from, g1);
  }
  if (L.quayMaxX - 1 > from + 1) runs.push([from, L.quayMaxX - 1]);
  const flowers: [number, number, number][] = [];
  for (const [x0, x1] of runs) {
    tBox(x1 - x0, 0.05, VERGE_Z1 - VERGE_Z0, w.M.grass, 3, (x0 + x1) / 2, 0.04, (VERGE_Z0 + VERGE_Z1) / 2, s).castShadow = false;
    for (let fx = x0 + 0.4; fx < x1 - 0.3; fx += 0.55 + r() * 0.6) flowers.push([fx, VERGE_Z0 + 0.15 + r() * (VERGE_Z1 - VERGE_Z0 - 0.3), Math.floor(r() * FLOWER_COLOURS.length)]);
  }
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.8 }), flowers.length);
  const leaf = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 4), flat(0x4f9a4a, 1), flowers.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  flowers.forEach(([fx, fz, k], i) => {
    head.setMatrixAt(i, m.makeTranslation(fx, 0.26, fz));
    head.setColorAt(i, c.set(FLOWER_COLOURS[k]));
    leaf.setMatrixAt(i, m.makeTranslation(fx, 0.13, fz));
  });
  for (const im of [head, leaf]) { im.castShadow = true; im.userData.keep = true; w.group.add(im); }
}

export function buildPaving(w: Build): void {
  compassRose(w);
  kerbs(w);
  patches(w);
  verge(w);
}
