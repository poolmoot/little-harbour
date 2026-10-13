import type * as THREE from 'three';
import type { Smoke } from './fx';
import type { mats } from './kit';

/** Planted beds on the quay as [x0, x1, z0, z1]. */
export const BEDS: [number, number, number, number][] = [[3.4, 9.4, 9.6, 13.4], [-9.4, -3.4, 9.6, 13.4]];

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
  readonly signs: { m: THREE.Object3D; phase: number }[];
  readonly smokes: Smoke[];
  readonly stallWings: THREE.Group[];
  stallSolid: Rect;
  vane: THREE.Group;
  vaneArrow: THREE.Group;
  flag: THREE.Mesh;
  solid(r: Rect): void;
}
