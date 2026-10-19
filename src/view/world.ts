import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { BOXES, ROUNDS, STALL_REACH, WALK_RECTS } from '../sim/layoutBoxes';
import type { SkyState } from './scene';
import { Fireflies, windU } from './fx';
import { bake, lampMat, mats, windowMat } from './kit';
import { buildNature, groundH } from './nature';
import { BEDS } from './worldParts';
import type { Build, Lamp, Rect } from './worldParts';
import { buildGround, buildPier, buildQuayDetail } from './worldGround';
import { buildPaving } from './worldPaving';
import { buildMarket, buildVane } from './worldMarket';
import { buildBoardAndIce, buildInn, buildShipyard } from './worldBuildings';
import { buildLanterns } from './worldLamps';
import { buildBreakwaters, buildHillside, buildSquare, buildTower } from './worldTown';
import { inAreas, overlaps, pushOut, resolveMove } from './collide';
import type { Area, Disc, Obb, Solid } from './collide';

export type { Rect };

/** The harbour: builds the quay, pier and buildings once, then animates lamps, signs, smoke and flags. */
export class World implements Build {
  readonly group = new THREE.Group();
  /** Everything the walkers collide with: turned boxes and discs (plain rectangles are turned into boxes). */
  readonly solids: Solid[] = [];
  /** The ground you can walk on: the square, the pier and the breakwater. */
  readonly areas: Area[] = [...WALK_RECTS];
  private stallObb: Obb | null = null;
  readonly stat = new THREE.Group();
  readonly M = mats();
  readonly lamps: Lamp[] = [];
  readonly signs: Build['signs'] = [];
  /** Extra flag flutter (0 and up) when the player walks by; set by the town-life code. */
  gust = 0;
  readonly smokes: Build['smokes'] = [];
  private fireflies!: Fireflies;
  flag!: THREE.Mesh;
  readonly stallWings: THREE.Group[] = [];
  vane = new THREE.Group();
  vaneArrow = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.group.add(this.stat);
    buildGround(this);
    buildPaving(this);
    buildPier(this);
    buildMarket(this);
    buildShipyard(this);
    buildInn(this);
    buildBoardAndIce(this);
    buildTower(this);
    buildSquare(this);
    buildHillside(this);
    buildBreakwaters(this);
    buildQuayDetail(this);
    buildLanterns(this);
    buildVane(this);
    bake(this.stat);
    // Everything solid comes from the layout data, the same lists the layout tests walk through.
    for (const b of BOXES) {
      if (/^table /.test(b.name)) continue;   // the terrace adds its tables as they are put out
      const o: Obb = { cx: b.cx, cz: b.cz, hx: b.hx, hz: b.hz, a: b.a };
      this.solids.push(o);
      if (b.name === 'market') { o.hx = STALL_REACH[0]; this.stallObb = o; }
    }
    for (const r of ROUNDS) this.solids.push({ cx: r.cx, cz: r.cz, r: r.r });
    const south = LAYOUT.square.z1;
    const n = buildNature(this.group, (x, z) => {
      if (z < south + 1.2) return false;                                           // the town and the sea
      if (Math.abs(x) < LAYOUT.quayMaxX + 5 && z < south + 22) return false;      // the hillside terraces and houses
      return true;
    }, BEDS);
    this.fireflies = new Fireflies(this.group, [...n.fireflies, [-1.85, 0, -4], [1.85, 0, -10.5], [-14, 0, 17.6], [14, 0, 17.6]], 5);
  }

  box(o: Obb): void { this.solids.push(o); }
  disc(d: Disc): void { this.solids.push(d); }
  place(x: number, z: number, rot: number): { s: THREE.Group; live: THREE.Group } {
    const s = new THREE.Group(), live = new THREE.Group();
    for (const g of [s, live]) { g.position.set(x, 0, z); g.rotation.y = rot; }
    this.stat.add(s);
    this.group.add(live);
    return { s, live };
  }

  /** Market stall upgrades: a wing on each side per level (wings are built in worldMarket.ts). */
  setStall(level: number): void {
    this.stallWings.forEach((g, i) => (g.visible = i < level));
    if (this.stallObb) this.stallObb.hx = STALL_REACH[level] ?? STALL_REACH[0];
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
    for (const s of this.signs) s.m.rotation.z = Math.sin(t * 1.1 + s.phase) * 0.03 + (s.kick ?? 0);
    for (const sm of this.smokes) sm.update(t, pxScale, sky.light);
    this.fireflies.update(t, pxScale, Math.min(1, sky.night * 1.3 + n * 0.3));
    const p = this.flag.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const fx = p.getX(i);
      p.setZ(i, Math.sin(t * 5 - fx * 6) * 0.07 * fx * (1 + this.gust));
    }
    p.needsUpdate = true;
    if (this.vane.visible) this.vaneArrow.rotation.y = Math.sin(t * 0.35) * 1.2 + Math.sin(t * 0.9) * 0.2;
  }

  /** If a building has just gone up round the player, step them out to the nearest free spot. */
  stepOut(p: { x: number; z: number }, r = 0.45): void {
    for (const o of this.solids) if (!('r' in o)) pushOut(o, p, r);
  }

  /** Is the point (with a small radius) standing on the quay, the pier or the point, clear of every solid? */
  walkable(x: number, z: number, r: number): boolean {
    if (!inAreas(this.areas, x, z, r)) return false;
    for (const o of this.solids) if (overlaps(o, x, z, r)) return false;
    return true;
  }

  /** Move from (px,pz) toward (nx,nz): pushed out of walls, corners and posts and kept on the ground, so it slides and never snags. */
  resolve(px: number, pz: number, nx: number, nz: number, r: number): { x: number; z: number } {
    return resolveMove(this.areas, this.solids, { x: px, z: pz }, nx, nz, r);
  }
}
export { groundH };
