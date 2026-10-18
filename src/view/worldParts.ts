import type * as THREE from 'three';
import type { Smoke } from './fx';
import type { mats } from './kit';
import type { Disc, Obb } from './collide';

/** Planted beds on the quay as [x0, x1, z0, z1]: lawns with a tree, kept out of the worker corridor (z 12.2) and the queue and table space. */
export const BEDS: [number, number, number, number][] = [[-23.6, -15.4, 9.8, 13.2], [18.6, 23.6, 6.6, 13.2], [-10.4, -6.0, 9.8, 11.6], [6.2, 9.2, 9.8, 11.6]];

export interface Rect {
  x0: number; x1: number; z0: number; z1: number;
}

export interface Lamp { light: THREE.PointLight | null; halo: THREE.Sprite; phase: number }

/** What the world-building functions need from the World that owns them. */
export interface Build {
  readonly group: THREE.Group;
  readonly stat: THREE.Group;
  readonly M: ReturnType<typeof mats>;
  readonly lamps: Lamp[];
  readonly signs: { m: THREE.Object3D; phase: number; /** extra swing (radians) from the player brushing past */ kick?: number }[];
  readonly smokes: Smoke[];
  readonly stallWings: THREE.Group[];
  stallSolid: Rect;
  vane: THREE.Group;
  vaneArrow: THREE.Group;
  flag: THREE.Mesh;
  solid(r: Rect): void;
  /** A solid box turned by `a` radians (same turn as Three.js rotation.y), or a round post. */
  box(o: Obb): void;
  disc(d: Disc): void;
  /** Static (baked) and live (not baked: signs, flags) groups sharing one placement, for a building that is turned. */
  place(x: number, z: number, rot: number): { s: THREE.Group; live: THREE.Group };
}
