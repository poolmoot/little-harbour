import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { SkyState } from './scene';
import { Fireflies, windU } from './fx';
import { bake, lampMat, mats, windowMat } from './kit';
import { buildNature, groundH } from './nature';
import { BEDS } from './worldParts';
import type { Build, Lamp, Rect } from './worldParts';
import { buildGround, buildPier, buildQuayDetail } from './worldGround';
import { buildMarket, buildVane } from './worldMarket';
import { buildBoardAndIce, buildInn, buildShipyard } from './worldBuildings';
import { buildLanterns } from './worldLamps';

export type { Rect };

/** The harbour: builds the quay, pier and buildings once, then animates lamps, signs, smoke and flags. */
export class World implements Build {
  readonly group = new THREE.Group();
  readonly obstacles: Rect[] = [];
  readonly stat = new THREE.Group();
  readonly M = mats();
  readonly lamps: Lamp[] = [];
  readonly signs: { m: THREE.Object3D; phase: number }[] = [];
  readonly smokes: Build['smokes'] = [];
  private fireflies!: Fireflies;
  flag!: THREE.Mesh;
  readonly stallWings: THREE.Group[] = [];
  stallSolid!: Rect;
  vane = new THREE.Group();
  vaneArrow = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.group.add(this.stat);
    buildGround(this);
    buildPier(this);
    buildMarket(this);
    buildShipyard(this);
    buildInn(this);
    buildBoardAndIce(this);
    buildQuayDetail(this);
    buildLanterns(this);
    buildVane(this);
    bake(this.stat);
    const n = buildNature(this.group, (x, z) => {
      if (z < -8) return false;
      if (Math.abs(x) < 22.2 && z < 14.2) return false;
      return true;
    }, BEDS);
    this.fireflies = new Fireflies(this.group, [...n.fireflies, [-1.85, 0, -4], [1.85, 0, -10.5], [-13, 0, 8.5], [13, 0, 9]], 5);
  }

  solid(r: Rect): void {
    this.obstacles.push(r);
  }

  /** Market stall upgrades: a wing on each side per level (wings are built in worldMarket.ts). */
  setStall(level: number): void {
    this.stallWings.forEach((g, i) => (g.visible = i < level));
    const reach = [2.2, 3.4, 4.4][level] ?? 2.2;
    this.stallSolid.x0 = LAYOUT.market.x - reach;
    this.stallSolid.x1 = LAYOUT.market.x + reach;
  }

  /** Golden weathervane on the inn (top rank). */
  setWeathervane(on: boolean): void {
    this.vane.visible = on;
  }

  update(t: number, sky: SkyState, pxScale: number): void {
    windU.value = t;
    const n = sky.lantern;
    windowMat.emissiveIntensity = n * 1.8;
    lampMat.emissiveIntensity = n * 3.2;
    for (const l of this.lamps) {
      const fl = 1 + Math.sin(t * 9 + l.phase) * 0.04 + Math.sin(t * 23 + l.phase * 3) * 0.03;
      if (l.light) l.light.intensity = n * 15 * fl;
      (l.halo.material as THREE.SpriteMaterial).opacity = n * 0.4 * fl;
    }
    for (const s of this.signs) s.m.rotation.z = Math.sin(t * 1.1 + s.phase) * 0.03;
    for (const sm of this.smokes) sm.update(t, pxScale, sky.light);
    this.fireflies.update(t, pxScale, Math.min(1, sky.night * 1.3 + n * 0.3));
    const p = this.flag.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const fx = p.getX(i);
      p.setZ(i, Math.sin(t * 5 - fx * 6) * 0.07 * fx);
    }
    p.needsUpdate = true;
    if (this.vane.visible) this.vaneArrow.rotation.y = Math.sin(t * 0.35) * 1.2 + Math.sin(t * 0.9) * 0.2;
  }

  /** Is the point (with a small radius) standing on the quay or the pier? */
  walkable(x: number, z: number, r: number): boolean {
    const L = LAYOUT;
    const inside = (px: number, pz: number) => {
      const quay = px >= L.quayMinX && px <= L.quayMaxX && pz >= 0 && pz <= L.quayMaxZ;
      const pier = Math.abs(px) <= L.pierHalfWidth && pz <= 0.05 && pz >= L.pierEndZ;
      return quay || pier;
    };
    if (!inside(x, z)) return false;
    if (!(inside(x + r, z) && inside(x - r, z) && inside(x, z + r) && inside(x, z - r))) return false;
    for (const o of this.obstacles) {
      const cx = Math.max(o.x0, Math.min(x, o.x1)), cz = Math.max(o.z0, Math.min(z, o.z1));
      if ((cx - x) ** 2 + (cz - z) ** 2 < r * r) return false;
    }
    return true;
  }

  /** Move from (px,pz) toward (nx,nz), sliding along obstacles and water edges. */
  resolve(px: number, pz: number, nx: number, nz: number, r: number): { x: number; z: number } {
    if (this.walkable(nx, nz, r)) return { x: nx, z: nz };
    if (this.walkable(nx, pz, r)) return { x: nx, z: pz };
    if (this.walkable(px, nz, r)) return { x: px, z: nz };
    return { x: px, z: pz };
  }

  addObstacle(r: Rect): void {
    this.obstacles.push(r);
  }
}
export { groundH };
