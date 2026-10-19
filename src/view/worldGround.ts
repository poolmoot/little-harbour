import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { barrel, bollard, bx, crateBox, cy, flat, net, put, ropeCoil, tBox } from './kit';
import { landPatch } from './nature';
import { lampHead } from './worldLamps';
import type { Build } from './worldParts';
import { BEDS } from './worldParts';

const DEG = Math.PI / 180;
/** The half-angle of the water that comes up to the square at the top, between the first building on each side. */
export const NOTCH_DEG = 6;

/**
 * A slab shaped like a ring sector (or a whole disc when the angles run all the way round) round the square's centre: from radius r0 to r1,
 * between two angles measured from straight up (east positive), with its top at `topY` and `depth` below it. Texture tiles `tile` units wide.
 * `mats` is [top, side].
 */
export function sectorSlab(r0: number, r1: number, a0: number, a1: number, depth: number, topY: number, tile: number, mats: THREE.Material[]): THREE.Mesh {
  const shape = new THREE.Shape();
  const full = a1 - a0 >= 359.9, n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 3));
  const pt = (deg: number, r: number): [number, number] => [r * Math.sin(deg * DEG), r * Math.cos(deg * DEG)];   // shape y is minus world z; the centre is added below
  if (full) {
    shape.absarc(0, 0, r1, 0, Math.PI * 2, false);
    if (r0 > 0) { const hole = new THREE.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); shape.holes.push(hole); }
  } else {
    // shape y = -world z, so "up the page" (towards the sea, -z) is +y: a point at angle a is (r sin a, r cos a) in shape space
    if (r0 > 0) {
      const [sx, sy] = pt(a0, r0);
      shape.moveTo(sx, sy);
      for (let i = 1; i <= n; i++) { const [x, y] = pt(a0 + ((a1 - a0) * i) / n, r0); shape.lineTo(x, y); }
    } else { const [sx, sy] = pt(a1, r1); shape.moveTo(sx, sy); }
    for (let i = n; i >= 0; i--) { const [x, y] = pt(a0 + ((a1 - a0) * i) / n, r1); shape.lineTo(x, y); }
    shape.closePath();
  }
  return extrude(shape, depth, topY, tile, mats);
}

/** Extrude a shape drawn round the square's centre (x east, y = minus world z) into a slab. */
function extrude(shape: THREE.Shape, depth: number, topY: number, tile: number, mats: THREE.Material[]): THREE.Mesh {
  const L = LAYOUT.ring;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 72 });
  g.rotateX(-Math.PI / 2);                       // shape (x, y, depth) -> world (x, depth, -y)
  g.translate(L.cx, topY - depth, L.cz);          // the centre of the square sits at world z = L.cz
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  const m = new THREE.Mesh(g, mats);
  m.receiveShadow = true;
  return m;
}

/**
 * The ground behind the buildings on one side (sg = -1 west, 1 east): from the rim of the square to the water's edge at radius `rOut`,
 * and from the east or west end round to the pier. Its edge towards the pier is a slanting line, so the water beside the pier stays open for the boats.
 */
export function backGround(sg: number, rOut: number, depth: number, topY: number, tile: number, mats: THREE.Material[]): THREE.Mesh {
  const L = LAYOUT.ring, rIn = L.front - 0.05, pts: [number, number][] = [];
  const at = (deg: number, r: number): [number, number] => [sg * r * Math.sin(deg * DEG), r * Math.cos(deg * DEG)];
  for (let d = 90; d >= NOTCH_DEG; d -= 3) pts.push(at(d, rIn));
  pts.push(at(NOTCH_DEG, rIn));
  // the slanting edge: from the rim beside the pier out to the first corner and then the outer arc
  const c1 = [sg * 3.0, -(-3.2 - L.cz)] as [number, number];
  const outDeg = 12.7;
  pts.push(c1, at(outDeg, rOut));
  for (let d = outDeg; d <= 90; d += 3) pts.push(at(d, rOut));
  pts.push(at(90, rOut));
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return extrude(shape, depth, topY, tile, mats);
}

export function buildGround(w: Build): void {
  const L = LAYOUT, M = w.M, s = w.stat, Rf = L.ring.front, Rb = L.quayMaxX;
  const slab = (r0: number, r1: number, a0: number, a1: number, depth: number, topY: number, tile: number, top: THREE.Material, side: THREE.Material, shadow = false) => {
    const m = sectorSlab(r0, r1, a0, a1, depth, topY, tile, [top, side]);
    m.castShadow = shadow;
    s.add(m);
    return m;
  };
  // the round square: paved to the edge of the water, with a stone lip round its rim
  const C = L.ring.south, ca = 180 - Math.acos(C / Rf) / DEG;    // the angle where the straight front wall meets the circle
  slab(0, Rf, -ca, ca, 1.4, 0, 2.4, M.cobble, M.wall);
  slab(Rf - 0.6, Rf, -ca, ca, 0.2, 0.012, 2, M.lip, M.lip);
  const wz = L.ring.cz + C;
  tBox(2 * Rf * Math.sin(ca * DEG), 0.2, 0.6, M.lip, 2, 0, 0.012, wz - 0.3, s).castShadow = false;
  // the ground behind the buildings, on each side, from the water's notch round to the east and west ends
  for (const sg of [-1, 1]) {
    const m = backGround(sg, Rb, 1.4, 0, 3, [M.grass, M.wall]);
    m.castShadow = false;
    s.add(m);
  }
  // planted beds outside the low wall on the camera side: a stone surround and a lawn, with a tree trunk (solid, from the layout data)
  for (const [x0, x1, z0, z1] of BEDS) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    tBox(x1 - x0 + 0.5, 0.05, z1 - z0 + 0.5, M.lip, 2, cx, 0.02, cz, s).castShadow = false;
    tBox(x1 - x0, 0.05, z1 - z0, M.grass, 3, cx, 0.045, cz, s).castShadow = false;
  }
  // the low wall on the camera side of the square, with a stair-gap in the middle and a gate at the east end
  const g = L.gate, stair = 3;
  const wall = (a0: number, a1: number) => {
    slab(Rf + 0.05, Rf + 0.55, a0, a1, 0.7, 0.45, 1.6, M.wall, M.wall, true);
    slab(Rf, Rf + 0.65, a0, a1, 0.12, 0.55, 2, M.lip, M.lip);
  };
  wall(90, g.from);
  wall(g.to, ca);
  wall(-ca, -90);
  // and the straight front: a long low wall with a gap for the steps up to the hillside in the middle
  for (const [x0, x1] of [[-Rf * Math.sin(ca * DEG), -stair], [stair, Rf * Math.sin(ca * DEG)]]) {
    tBox(x1 - x0, 0.7, 0.5, M.wall, 1.6, (x0 + x1) / 2, 0.1, wz + 0.25, s);
    tBox(x1 - x0 + 0.1, 0.12, 0.65, M.lip, 2, (x0 + x1) / 2, 0.49, wz + 0.25, s);
  }
  // the land behind the town: grass round the whole camera side, rising into hills (the ground height is shaped in nature.ts)
  const gtex = M.grass.map as THREE.Texture;
  w.group.add(landPatch(gtex, -100, 100, L.ring.cz, 110));
  // the causeway to the lighthouse point, through the gate in the wall
  const cw = L.causeway;
  tBox(cw.x1 - cw.x0, 1.4, cw.z1 - cw.z0, M.cobble, 2.4, (cw.x0 + cw.x1) / 2, -0.7, (cw.z0 + cw.z1) / 2, s).castShadow = false;
  tBox(cw.x1 - cw.x0, 0.1, 0.3, M.lip, 2, (cw.x0 + cw.x1) / 2, 0.0, cw.z0 + 0.15, s).castShadow = false;
  tBox(cw.x1 - cw.x0, 0.1, 0.3, M.lip, 2, (cw.x0 + cw.x1) / 2, 0.0, cw.z1 - 0.15, s).castShadow = false;
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
