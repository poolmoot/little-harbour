import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Figure, mat } from './figures';
import { townLook } from './people';
import { angleDiff } from './motion';
import type { World } from './world';

/**
 * Pooled townspeople for the market queue, the terrace and the pier crowd. Every one is a shared-rig Figure inside a root
 * group that is used to fade them in and out (so nobody pops). Nothing here is allocated while the game runs.
 */

export type Item = 'none' | 'parcel' | 'basket';

const RADIUS = 0.3;
let parcelGeo: THREE.BufferGeometry | null = null;
let basketGeo: THREE.BufferGeometry | null = null;
const PARCEL_MAT = mat(0xc9a06a);
const BASKET_MAT = mat(0xb88a4a);

function parcel(): THREE.Mesh {
  parcelGeo ??= new THREE.BoxGeometry(0.34, 0.2, 0.26);
  const m = new THREE.Mesh(parcelGeo, PARCEL_MAT);
  m.castShadow = true;
  return m;
}
function basket(): THREE.Mesh {
  if (!basketGeo) {
    const bowl = new THREE.CylinderGeometry(0.19, 0.14, 0.17, 10, 1, false);
    const handle = new THREE.TorusGeometry(0.16, 0.018, 5, 10, Math.PI);
    handle.translate(0, 0.08, 0);
    basketGeo = mergeGeometries([bowl, handle].map((g) => (g.index ? g.toNonIndexed() : g)));
  }
  const m = new THREE.Mesh(basketGeo as THREE.BufferGeometry, BASKET_MAT);
  m.castShadow = true;
  return m;
}

export class Citizen {
  readonly root = new THREE.Group();
  readonly fig: Figure;
  x = 0;
  z = 0;
  heading = 0;
  speed = 0;
  active = false;
  /** True once the current goal is reached (or when there is none). */
  arrived = true;
  /** Free-use fields for whoever owns this citizen (what it is doing, a timer, a place in a line or at a table). */
  tag = 0;
  state = 0;
  timer = 0;
  slot = -1;
  /** A fixed number per citizen, used to vary their habits. */
  readonly id: number;
  private fade = 0;
  private fadeDir = 0;
  private gx = 0;
  private gz = 0;
  private hasGoal = false;
  private pace = 1.4;
  private faceAfter: number | null = null;
  private stuck = 0;
  private sitting = false;
  private sx = 0;
  private sz = 0;
  private sh = 0;
  private props: Record<'parcel' | 'basket', THREE.Mesh>;
  /** Where the head should look relative to the body (radians), or null to glance about on its own. */
  lookYaw: number | null = null;

  constructor(scene: THREE.Scene, index: number) {
    this.id = index;
    this.fig = new Figure(townLook(index));
    this.root.add(this.fig.group);
    // background people leave out the shadow pass: it would double their draw calls
    this.fig.group.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
    this.props = { parcel: parcel(), basket: basket() };
    this.props.parcel.position.set(0, 1.12, 0.46);
    this.props.basket.position.set(0, 1.04, 0.44);
    for (const p of Object.values(this.props)) { p.visible = false; this.fig.group.add(p); }
    this.root.visible = false;
    scene.add(this.root);
  }

  setItem(item: Item): void {
    this.props.parcel.visible = item === 'parcel';
    this.props.basket.visible = item === 'basket';
    this.fig.pose.carry = item === 'none' ? 0 : 1;
    this.fig.pose.load = item === 'none' ? 0 : 1;
  }

  spawn(x: number, z: number, heading: number): void {
    this.x = x; this.z = z; this.heading = heading;
    this.active = true;
    this.fade = 0; this.fadeDir = 1;
    this.arrived = true; this.hasGoal = false; this.sitting = false; this.speed = 0; this.stuck = 0;
    this.faceAfter = null; this.lookYaw = null;
    this.tag = 0; this.state = 0; this.timer = 0; this.slot = -1;
    this.fig.pose.wave = false; this.fig.pose.clap = false; this.fig.pose.sit = false;
    this.setItem('none');
    this.root.visible = true;
    this.root.scale.setScalar(0.001);
    this.place();
  }

  /** Start fading out; the citizen frees itself when gone. */
  retire(): void {
    this.fadeDir = -1;
    this.hasGoal = false;
    this.sitting = false;
    this.fig.pose.sit = false;
  }

  goTo(x: number, z: number, pace = 1.4, faceAfter: number | null = null): void {
    this.gx = x; this.gz = z; this.pace = pace; this.faceAfter = faceAfter;
    this.hasGoal = true; this.arrived = false; this.stuck = 0;
    this.sitting = false; this.fig.pose.sit = false;
  }

  /** Settle into a chair at (x, z) facing `heading`. */
  sitAt(x: number, z: number, heading: number): void {
    this.sx = x; this.sz = z; this.sh = heading;
    this.sitting = true; this.hasGoal = false; this.arrived = true;
    this.fig.pose.sit = true;
  }
  standUp(): void { this.sitting = false; this.fig.pose.sit = false; }
  get isSitting(): boolean { return this.sitting; }
  get fading(): boolean { return this.fadeDir !== 0; }

  /** Distance from the current goal. */
  get goalDist(): number { return Math.hypot(this.gx - this.x, this.gz - this.z); }

  private place(): void {
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.heading;
  }

  update(dt: number, world: World): void {
    if (!this.active) return;
    if (this.fadeDir !== 0) {
      this.fade = Math.min(1, Math.max(0, this.fade + this.fadeDir * dt * 2.2));
      if (this.fadeDir > 0 && this.fade >= 1) this.fadeDir = 0;
      if (this.fadeDir < 0 && this.fade <= 0) { this.active = false; this.root.visible = false; this.fadeDir = 0; return; }
      const e = this.fade * this.fade * (3 - 2 * this.fade);
      this.root.scale.setScalar(Math.max(0.001, e));
    }
    let want = 0;
    if (this.sitting) {
      const k = Math.min(1, dt * 5);
      this.x += (this.sx - this.x) * k;
      this.z += (this.sz - this.z) * k;
      this.heading += angleDiff(this.sh, this.heading) * k;
      this.speed = 0;
    } else if (this.hasGoal) {
      const dx = this.gx - this.x, dz = this.gz - this.z, d = Math.hypot(dx, dz);
      if (d < 0.14) {
        this.hasGoal = false; this.arrived = true;
      } else {
        want = this.pace * Math.min(1, 0.4 + d / 0.9);
        this.heading += angleDiff(Math.atan2(dx, dz), this.heading) * Math.min(1, dt * 7);
      }
    } else if (this.faceAfter !== null) {
      this.heading += angleDiff(this.faceAfter, this.heading) * Math.min(1, dt * 4);
    }
    this.speed += (want - this.speed) * Math.min(1, dt * 6);
    if (this.speed > 0.05) {
      const step = this.speed * dt;
      const r = world.resolve(this.x, this.z, this.x + Math.sin(this.heading) * step, this.z + Math.cos(this.heading) * step, RADIUS);
      const moved = Math.hypot(r.x - this.x, r.z - this.z);
      this.x = r.x; this.z = r.z;
      this.stuck = moved < step * 0.35 ? this.stuck + dt : 0;
      if (this.stuck > 1.6) { this.x = this.gx; this.z = this.gz; this.stuck = 0; } // wedged against something: give up the walk and arrive
    }
    this.fig.look(this.lookYaw === null ? 0 : Math.max(-1, Math.min(1, this.lookYaw)), 0);
    this.fig.update(dt, this.speed);
    this.place();
  }
}

/** A fixed set of citizens made once at start-up, handed out and taken back. */
export class CitizenPool {
  readonly all: Citizen[] = [];
  constructor(scene: THREE.Scene, count: number, firstLook: number) {
    for (let i = 0; i < count; i++) this.all.push(new Citizen(scene, firstLook + i));
  }
  acquire(): Citizen | null {
    const free: Citizen[] = [];
    for (const c of this.all) if (!c.active) free.push(c);
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }
  update(dt: number, world: World): void {
    for (const c of this.all) c.update(dt, world);
  }
}
