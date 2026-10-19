import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { flat, put } from './kit';
import type { Build } from './worldParts';

/**
 * Ground dressing for the round square: a compass rose set into the middle of it. Flat and walkable, so none of it belongs in the layout data.
 * (The kerbs, worn stones and flower verge of the long street were dropped with it; the graphics chat re-dresses the round square.)
 */

const SQUARE_CENTRE = { x: LAYOUT.ring.cx, z: LAYOUT.ring.cz };
const ROSE_R = 5.5;
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

export function buildPaving(w: Build): void {
  compassRose(w);
}
