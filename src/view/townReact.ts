import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { wetnessStep } from '../audio/town';
import type { SkyState } from './scene';
import { brushImpulse, puddleSize, wetLook } from './townRules';
import type { World } from './world';

/** Small things that answer the player and the weather: dust and splashes, wet cobbles and puddles, swaying signs. */

// ---- particles ---------------------------------------------------------------------------

/** A fixed pool of tiny puffs and droplets drawn as one instanced mesh. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private n: number;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private life: Float32Array; private maxLife: Float32Array; private size: Float32Array; private grow: Float32Array; private grav: Float32Array;
  private next = 0;
  private dummy = new THREE.Object3D();
  private alive = 0;
  private color = new THREE.Color();

  constructor(scene: THREE.Scene, private capacity: number) {
    this.n = capacity;
    const mk = () => new Float32Array(capacity);
    this.px = mk(); this.py = mk(); this.pz = mk(); this.vx = mk(); this.vy = mk(); this.vz = mk();
    this.life = mk(); this.maxLife = mk(); this.size = mk(); this.grow = mk(); this.grav = mk();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.count = 0;
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, this.color.setHex(0xffffff));
    scene.add(this.mesh);
  }

  /** Lower or raise the number of particles that may be alive (a lower picture quality uses fewer). */
  setCapacity(n: number): void { this.n = Math.min(this.capacity, n); }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, grow: number, grav: number, life: number, color: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.size[i] = size; this.grow[i] = grow; this.grav[i] = grav; this.life[i] = life; this.maxLife[i] = life;
    this.mesh.setColorAt(i, this.color.setHex(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** A little cloud kicked up by a boot on dry stone. */
  dust(x: number, z: number): void {
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x + Math.cos(a) * 0.1, 0.06, z + Math.sin(a) * 0.1, Math.cos(a) * 0.25, 0.35 + Math.random() * 0.25, Math.sin(a) * 0.25, 0.04 + Math.random() * 0.03, 0.09, 0, 0.55 + Math.random() * 0.25, 0xd8ccb2);
    }
  }

  /** Droplets thrown up from a puddle. */
  splash(x: number, z: number): void {
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 0.9;
      this.spawn(x, 0.1, z, Math.cos(a) * s, 1.6 + Math.random() * 1.2, Math.sin(a) * s, 0.035 + Math.random() * 0.02, 0, -7.5, 0.55, 0xd4ebf8);
    }
  }

  update(dt: number): void {
    let any = false;
    const d = this.dummy;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        if (this.size[i] !== 0) { this.size[i] = 0; d.position.set(0, -5, 0); d.scale.setScalar(0.0001); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); any = true; }
        continue;
      }
      any = true;
      this.life[i] -= dt;
      this.vy[i] += this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.04 && this.grav[i] < 0) { this.life[i] = 0; this.py[i] = 0.04; }
      this.vx[i] *= 1 - Math.min(1, dt * 2);
      this.vz[i] *= 1 - Math.min(1, dt * 2);
      const age = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const s = (this.size[i] + this.grow[i] * age) * (1 - age * age);
      d.position.set(this.px[i], this.py[i], this.pz[i]);
      d.scale.setScalar(Math.max(0.0001, s));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.alive = any ? this.n : 0;
    this.mesh.count = this.alive;
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---- wet cobbles and puddles -------------------------------------------------------------

interface Puddle { x: number; z: number; r: number; threshold: number; aspect: number; rot: number }
/** Puddle places as shares of the quay's width and depth (kept off buildings by a walkable check), so they follow the layout. */
const PUDDLES: Puddle[] = [
  [0.36, 0.52, 0.95, 0.12, 0.7, 0.3], [0.46, 0.42, 0.8, 0.3, 0.65, -0.5], [0.52, 0.6, 1.15, 0.08, 0.75, 0.9], [0.65, 0.5, 0.85, 0.4, 0.6, 0.1],
  [0.22, 0.55, 0.9, 0.2, 0.7, 1.2], [0.8, 0.48, 0.8, 0.5, 0.65, -0.2], [0.49, 0.2, 0.7, 0.35, 0.7, 0.6], [0.58, 0.76, 1.0, 0.18, 0.7, -0.9],
].map(([fx, fz, r, threshold, aspect, rot]) => ({
  x: LAYOUT.quayMinX + fx * (LAYOUT.quayMaxX - LAYOUT.quayMinX), z: fz * LAYOUT.quayMaxZ, r, threshold, aspect, rot,
}));

/** How wet the town is: darkens and glosses the stone, grows puddles in the rain and dries them out again. */
export class Wetness {
  value = 0;
  private stone: THREE.MeshStandardMaterial[];
  private base: THREE.Color[];
  private shown = -1;
  private puddles: Puddle[] = [];
  private mesh: THREE.InstancedMesh;
  private mat: THREE.MeshBasicMaterial;
  private dummy = new THREE.Object3D();
  private tint = new THREE.Color();

  constructor(scene: THREE.Scene, world: World) {
    this.stone = [world.M.cobble, world.M.lip];
    this.base = this.stone.map((m) => m.color.clone());
    this.puddles = PUDDLES.filter((p) => world.walkable(p.x, p.z, p.r * 0.8));
    this.mat = new THREE.MeshBasicMaterial({ color: 0x9fc4dc, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new THREE.CircleGeometry(1, 22);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, this.mat, Math.max(1, this.puddles.length));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** The nearest puddle the player is standing in, or null. */
  puddleAt(x: number, z: number): Puddle | null {
    if (this.value < 0.12) return null;
    for (const p of this.puddles) {
      const s = puddleSize(this.value, p.threshold) * p.r;
      if (s > 0.25 && (x - p.x) ** 2 + (z - p.z) ** 2 < s * s) return p;
    }
    return null;
  }

  update(dt: number, rain: number, sky: SkyState): void {
    this.value = wetnessStep(this.value, rain, dt);
    const w = this.value;
    if (Math.abs(w - this.shown) > 0.004 || (w === 0 && this.shown !== 0)) {
      this.shown = w;
      const look = wetLook(w);
      this.stone.forEach((m, i) => {
        m.color.setRGB(this.base[i].r * look.tint[0], this.base[i].g * look.tint[1], this.base[i].b * look.tint[2]);
        m.roughness = look.rough;
      });
      let any = false;
      this.puddles.forEach((p, i) => {
        const s = puddleSize(w, p.threshold);
        if (s > 0.01) any = true;
        this.dummy.position.set(p.x, 0.082, p.z);
        this.dummy.rotation.set(0, p.rot, 0);
        this.dummy.scale.set(Math.max(0.0001, s * p.r), 1, Math.max(0.0001, s * p.r * p.aspect));
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
      });
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.visible = any;
    }
    if (this.mesh.visible) {
      // puddles mirror the sky: its horizon colour, dimmer at night
      this.tint.copy(sky.sky).lerp(sky.zenith, 0.35).multiplyScalar(0.55 + 0.45 * sky.light);
      this.mat.color.copy(this.tint);
    }
  }
}

// ---- swaying signs, nets and the flag -----------------------------------------------------

interface Swinger { m: { x: number; z: number }; ang: number; vel: number }

/** Springs for the world's hanging signs and nets: brush past one and it swings, then settles. */
export class Sway {
  private items: Swinger[] = [];
  private flag = { x: 0, z: 0 };
  private gust = 0;

  constructor(private world: World) {
    world.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const s of world.signs) {
      s.m.getWorldPosition(v);
      this.items.push({ m: { x: v.x, z: v.z }, ang: 0, vel: 0 });
    }
    world.flag.getWorldPosition(v);
    this.flag.x = v.x; this.flag.z = v.z;
  }

  update(dt: number, px: number, pz: number, speed: number): void {
    const signs = this.world.signs;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const dx = it.m.x - px, dz = it.m.z - pz;
      const push = brushImpulse(Math.hypot(dx, dz), 2.0, speed);
      if (push > 0) it.vel += push * dt * 14 * (dx >= 0 ? 1 : -1);
      it.vel += (-55 * it.ang - 2.6 * it.vel) * dt;
      it.ang += it.vel * dt;
      if (it.ang > 0.45) it.ang = 0.45; else if (it.ang < -0.45) it.ang = -0.45;
      signs[i].kick = it.ang;
    }
    const near = brushImpulse(Math.hypot(this.flag.x - px, this.flag.z - pz), 5, speed);
    this.gust = Math.max(near * 1.6, this.gust * Math.max(0, 1 - dt * 0.8));
    this.world.gust = this.gust;
  }
}
