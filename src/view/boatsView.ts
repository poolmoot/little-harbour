import * as THREE from 'three';
import { LAYOUT, ZONE_IDS } from '../sim/config';
import type { Species, Trait } from '../sim/config';
import { activeCaptain, holdSize } from '../sim/fleet';
import type { Boat, GameState } from '../sim/state';
import { SPECIES_COLOUR } from '../palette';
import { bx, cy, flat, net, put, tex, windowMat } from './kit';
import { boards } from './textures';
import { Figure } from './figures';
import { gunwale, hullGeometry } from './hull';
import { SEA_Y, waveAt } from './waves';
import type { BoatFoam, Wake } from './water';

/** Hull tiers: rowboat, sloop, cutter, trawler. Scale is applied to the shared curved hull. */
const TIERS = [
  { sx: 1, sy: 1, sz: 1, mastH: 2.8, mastZ: -0.5, cap: [2, 4, 1.0, -0.5, 0.56] },
  { sx: 1.1, sy: 1.05, sz: 1.2, mastH: 4.0, mastZ: -0.6, cap: [2, 4, 1.45, -0.5, 0.6] },
  { sx: 1.3, sy: 1.2, sz: 1.5, mastH: 4.6, mastZ: -0.8, cap: [3, 4, 1.7, -0.5, 0.55] },
  { sx: 1.55, sy: 1.4, sz: 1.75, mastH: 3.9, mastZ: 0.4, cap: [3, 4, -0.5, -0.5, 0.6] },
] as const;
const HULL_KEYS = [['hullA', [158, 100, 66]], ['hullB', [78, 112, 148]], ['hullC', [86, 128, 98]], ['hullD', [150, 62, 54]]] as const;
const TRAIT_HAT: Record<Trait, number> = { swift: 0x4aa3d8, lucky: 0x4f9a5a, careful: 0xd9a53a, thrifty: 0x9a6ab0 };
const deckY = (t: number) => 0.28 * TIERS[t].sy;
const halfBeam = (t: number) => 0.8 * TIERS[t].sx;

let hullGeo: THREE.BufferGeometry | null = null;
let rimGeo: THREE.BufferGeometry[] = [];
const hullMat = (t: number) => {
  const m = tex(HULL_KEYS[t][0], boards(HULL_KEYS[t][0], [...HULL_KEYS[t][1]], 8, false), 0.8);
  m.side = THREE.DoubleSide;
  return m;
};
const crateBodyGeo = new THREE.BoxGeometry(0.5, 0.32, 0.4);
const crateTopGeo = new THREE.BoxGeometry(0.4, 0.05, 0.3);
const floatGeo = new THREE.SphereGeometry(0.09, 8, 6);
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();
const TARP = new THREE.Color(0x8b7a5a);

/** An animated sail: a gridded plane re-shaped each frame to bulge in the wind. dir +1 aft of the mast, -1 forward. */
class Sail {
  readonly mesh: THREE.Mesh;
  y0 = 1; h = 3; len = 1.7; z = -0.5; dir = 1;
  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 12), new THREE.MeshStandardMaterial({ color: 0xf6efdc, side: THREE.DoubleSide, roughness: 1 }));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }
  update(t: number): void {
    const p = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const nx = 8, ny = 12;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const px = i / nx, py = j / ny;
      const len = this.len * (1 - py * 0.92);
      const bulge = Math.sin(Math.PI * px) * 0.32 * (1 - py * 0.6);
      const flutter = Math.sin(t * 2.2 + py * 4 + px * 3) * 0.05 * px + Math.sin(t * 5 + px * 7) * 0.012;
      p.setXYZ(j * (nx + 1) + i, bulge + flutter + 0.03, this.y0 + py * this.h, this.z + this.dir * (0.08 + px * len));
    }
    p.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

class BoatModel {
  readonly group = new THREE.Group();
  private inner = new THREE.Group();
  private shells: THREE.Group[] = [];
  private fit: THREE.Group[] = []; // per-tier fittings (oars, cabin, winch)
  private oars: THREE.Group[] = [];
  private mast = new THREE.Group();
  private mastMesh: THREE.Mesh;
  private main = new Sail();
  private jib = new Sail();
  private flag: THREE.Mesh;
  private gearGroup = new THREE.Group();
  private bodies: THREE.InstancedMesh;
  private tops: THREE.InstancedMesh;
  private captain: Figure | null = null;
  private captainKey = '';
  private key = { hull: -1, sails: -1, gear: -1, load: '' };
  private row = Math.random() * 6;
  private rowAmt = 0;
  private wakeT = 0;
  tier = 0;
  heading = Math.PI;
  scale = 1;

  constructor() {
    this.group.add(this.inner);
    hullGeo ??= hullGeometry(0.8, 0.72);
    if (!rimGeo.length) rimGeo = [gunwale(0.8, 0.72, -1), gunwale(0.8, 0.72, 1)];
    const rim = flat(0xd9b27a, 0.7);
    const floor = tex('hullfloor', boards('hullfloor', [196, 160, 110], 5, true), 0.9);
    for (let t = 0; t < 4; t++) {
      const T = TIERS[t];
      const sh = new THREE.Group();
      sh.scale.set(T.sx, T.sy, T.sz);
      put(hullGeo, hullMat(t), 0, 0, 0, sh);
      for (const g of rimGeo) put(g, rim, 0, 0, 0, sh);
      bx(1.1, 0.04, 2.7, floor, 0, 0.2, 0.1, sh);
      for (const z of [-1.2, 1.55]) bx(1.5, 0.08, 0.3, flat(0xb98a55, 0.85), 0, 0.46, z, sh);
      this.inner.add(sh);
      this.shells.push(sh);
      const f = new THREE.Group();
      this.inner.add(f);
      this.fit.push(f);
    }
    // rowboat oars
    for (const s of [-1, 1]) {
      const lock = new THREE.Group();
      lock.position.set(s * 0.82, 0.72, -1.15);
      cy(0.025, 0.03, 0.14, flat(0x2d3236, 0.5), 0, 0, 0, lock, 5);
      const oar = new THREE.Group();
      cy(0.028, 0.028, 2.4, flat(0xc89c62, 0.7), s * 0.45, 0, 0, oar, 6).rotation.z = Math.PI / 2;
      bx(0.7, 0.012, 0.16, flat(0xe8d6b0, 0.7), s * 1.55, 0, 0, oar);
      lock.add(oar);
      this.fit[0].add(lock);
      this.oars.push(oar);
    }
    bx(0.12, 0.3, 0.12, flat(0x5a4330), 0, 0.3, 1.6, this.fit[0]);
    cy(0.04, 0.05, 0.5, flat(0x5a4330), 0, 0.9, -2.0, this.fit[0], 6);
    // sloop: bowsprit and cleats; cutter: low hatch and boom crutch
    const wood = flat(0x6a4a30, 0.8), trim = flat(0xe9e0c8, 0.7);
    bx(0.1, 0.1, 1.2, wood, 0, 0.8, -3.2, this.fit[1]);
    bx(0.7, 0.4, 0.9, trim, 0, 0.62, 0.3, this.fit[2]);
    bx(0.62, 0.05, 0.82, wood, 0, 0.85, 0.3, this.fit[2]);
    bx(0.1, 0.1, 1.8, wood, 0, 0.9, -4.0, this.fit[2]);
    // trawler: wheelhouse, funnel, winch and gantry
    const cab = this.fit[3];
    bx(1.9, 1.3, 2.2, flat(0xeee6d2, 0.8), 0, 1.3, 1.5, cab);
    bx(2.05, 0.1, 2.35, flat(0x2f4f78, 0.7), 0, 1.99, 1.5, cab);
    bx(1.95, 0.45, 0.06, windowMat, 0, 1.55, 0.37, cab);
    for (const s of [-1, 1]) bx(0.06, 0.45, 1.2, windowMat, s * 0.96, 1.55, 1.3, cab);
    cy(0.16, 0.2, 0.7, flat(0xc0572d, 0.7), 0.4, 2.4, 2.1, cab, 8);
    cy(0.28, 0.28, 0.55, flat(0x2d3236, 0.5), 0, 0.85, -2.7, cab, 10).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) bx(0.1, 0.8, 0.1, flat(0x2d3236, 0.5), s * 0.4, 0.7, -2.7, cab);
    for (const s of [-1, 1]) bx(0.08, 1.9, 0.08, flat(0x2d3236, 0.5), s * 1.0, 1.5, 3.2, cab).rotation.z = -s * 0.15;
    bx(2.0, 0.08, 0.08, flat(0x2d3236, 0.5), 0, 2.4, 3.2, cab);
    // mast (unit cylinder scaled), sails, pennant
    this.mastMesh = cy(0.06, 0.09, 1, wood, 0, 0.5, 0, this.mast, 8);
    this.mast.add(this.main.mesh, this.jib.mesh);
    const fg = new THREE.PlaneGeometry(0.6, 0.28, 5, 1);
    fg.translate(0.3, 0, 0);
    this.flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xd24a3a, side: THREE.DoubleSide, roughness: 0.9 }));
    this.flag.rotation.y = Math.PI / 2;
    this.mast.add(this.flag);
    // deck crates: two instanced meshes (bodies and coloured tops)
    this.bodies = new THREE.InstancedMesh(crateBodyGeo, tex('crate', boards('crate', [176, 140, 96], 4), 0.85), 14);
    this.tops = new THREE.InstancedMesh(crateTopGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), 14);
    for (const m of [this.bodies, this.tops]) { m.frustumCulled = false; m.castShadow = true; m.count = 0; }
    this.inner.add(this.mast, this.gearGroup, this.bodies, this.tops);
    this.setHull(0);
  }

  private setHull(t: number): void {
    this.tier = t;
    const T = TIERS[t];
    this.shells.forEach((s, i) => (s.visible = i === t));
    this.fit.forEach((f, i) => (f.visible = i === t || (i === 1 && t >= 2 && false)));
    this.scale = T.sz;
    this.inner.scale.setScalar(1);
    this.key.sails = -1;
    this.key.gear = -1;
    this.key.load = '';
  }

  /** Mast, sails and pennant for this hull and Sails level. */
  private setRig(sails: number): void {
    const t = this.tier, T = TIERS[t];
    const hasMast = t >= 1 || sails >= 1;
    this.mast.visible = hasMast;
    this.mast.position.set(0, deckY(t) - 0.1, T.mastZ);
    this.mastMesh.scale.y = T.mastH;
    const big = sails >= 1 ? 1.2 : 1;
    const sailOn = t < 3 ? hasMast : sails >= 1;
    this.main.mesh.visible = sailOn;
    this.main.y0 = 0.7; this.main.h = T.mastH * 0.72 * big; this.main.len = (1.2 + 0.45 * t) * big; this.main.z = 0; this.main.dir = t === 3 ? -1 : 1;
    this.jib.mesh.visible = sailOn && (t >= 2 || sails >= 2);
    this.jib.y0 = 0.7; this.jib.h = T.mastH * 0.6; this.jib.len = (1.4 + 0.4 * t); this.jib.z = 0; this.jib.dir = -1;
    this.flag.visible = hasMast && (t >= 1 || sails >= 2);
    this.flag.position.set(0, T.mastH + 0.1, 0);
    if (sails >= 2) this.flag.scale.setScalar(1.4); else this.flag.scale.setScalar(1);
    this.key.sails = sails;
  }

  /** Floats and nets on the gunwale: level 1 on one side, level 2 on both plus a net pile on deck. */
  private setGear(level: number): void {
    this.key.gear = level;
    this.gearGroup.clear();
    if (level === 0) return;
    const t = this.tier, T = TIERS[t];
    const hw = halfBeam(t) + 0.02, ry = 0.72 * T.sy + 0.06, zr = 1.0 * T.sz;
    const orange = flat(0xe9772e, 0.6);
    const sides = level >= 2 ? [-1, 1] : [-1];
    for (const s of sides) {
      for (let i = 0; i < 6; i++) put(floatGeo, orange, s * hw, ry, -zr + (i / 5) * zr * 1.6, this.gearGroup);
      net(this.gearGroup, zr * 1.5, 0.55, s * (hw + 0.03), ry - 0.3, zr * 0.1, s * Math.PI / 2);
    }
    if (level >= 2) {
      const pile = put(floatGeo, flat(0xc9b58a, 0.95), 0, deckY(t) + 0.1, T.cap[2] - 3 * Math.abs(T.cap[3]) - 0.2 + (t === 3 ? 0 : 0.0), this.gearGroup);
      pile.scale.set(4, 1.6, 3.2);
      pile.visible = t < 3;
    }
  }

  private layoutCrates(n: number, catchList: string[]): void {
    const t = this.tier, [cols, rows, z0, dz, dx] = TIERS[t].cap;
    this.bodies.count = this.tops.count = Math.min(n, 14);
    const dy = deckY(t);
    for (let i = 0; i < this.bodies.count; i++) {
      const col = i % cols, row = Math.floor(i / cols) % rows, layer = Math.floor(i / (cols * rows));
      const x = (col - (cols - 1) / 2) * dx * 1.05, y = dy + 0.18 + layer * 0.33, z = z0 + row * dz;
      tmpM.makeTranslation(x, y, z);
      this.bodies.setMatrixAt(i, tmpM);
      tmpM.makeTranslation(x, y + 0.18, z);
      this.tops.setMatrixAt(i, tmpM);
      const sp = catchList[i] as Species | undefined;
      this.tops.setColorAt(i, sp ? tmpC.set(SPECIES_COLOUR[sp]) : TARP);
    }
    this.bodies.instanceMatrix.needsUpdate = this.tops.instanceMatrix.needsUpdate = true;
    if (this.tops.instanceColor) this.tops.instanceColor.needsUpdate = true;
  }

  private setCaptain(trait: Trait | null): void {
    const k = trait ?? '';
    if (k === this.captainKey) return;
    this.captainKey = k;
    if (this.captain) { this.inner.remove(this.captain.group); this.captain = null; }
    if (!trait) return;
    this.captain = new Figure({ shirt: 0xf0e8d8, pants: 0x2f3b47, hat: 'cap', hatColor: TRAIT_HAT[trait], scale: 0.8, beard: 0x8a7a6a });
    this.captain.group.rotation.y = Math.PI;
    this.inner.add(this.captain.group);
  }

  sync(b: Boat): void {
    if (b.hull !== this.tier) this.setHull(b.hull);
    if (this.key.sails !== b.sails) this.setRig(b.sails);
    if (this.key.gear !== b.gear) this.setGear(b.gear);
    const cap = activeCaptain(b);
    const key = `${b.hull}|${holdSize(b)}|${b.status === 'returned' ? b.catch.join(',') : ''}`;
    if (key !== this.key.load) {
      this.key.load = key;
      this.layoutCrates(b.status === 'returned' ? b.catch.length : holdSize(b), b.status === 'returned' ? b.catch : []);
    }
    this.setCaptain(cap ? cap.trait : null);
    if (this.captain) this.captain.group.position.set(0, deckY(this.tier), TIERS[this.tier].sz * 1.45 + (this.tier === 3 ? 0.3 : 0));
  }

  /** Row the oars (moving) or rest them; sway the sails. */
  animate(dt: number, t: number, moving: boolean): void {
    this.rowAmt += ((moving ? 1 : 0) - this.rowAmt) * Math.min(1, dt * 4);
    if (moving) this.row += dt * 4.2;
    if (this.tier === 0 && !this.mast.visible) {
      const phi = this.row;
      this.oars.forEach((oar, i) => {
        const s = i === 0 ? -1 : 1;
        const rest = s * -1.35;
        const sweep = s === -1 ? -0.5 * Math.cos(phi) : 0.5 * Math.cos(phi);
        const dive = (0.1 + 0.28 * Math.max(0, Math.sin(phi))) * (s === -1 ? 1 : -1);
        oar.rotation.y = rest * (1 - this.rowAmt) + sweep * this.rowAmt;
        oar.rotation.z = (s === -1 ? 0.1 : -0.1) * (1 - this.rowAmt) + dive * this.rowAmt;
      });
    }
    this.fit[0].children.forEach((c) => { if (c.type === 'Group') c.visible = !this.mast.visible; });
    if (this.main.mesh.visible) this.main.update(t);
    if (this.jib.mesh.visible) this.jib.update(t + 1.3);
    if (this.flag.visible) {
      const f = this.flag.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < f.count; i++) f.setZ(i, Math.sin(t * 7 - f.getX(i) * 8) * 0.06 * f.getX(i) * 1.6);
      f.needsUpdate = true;
    }
    this.captain?.update(dt, 0);
  }

  tickWake(dt: number): boolean {
    this.wakeT -= dt;
    if (this.wakeT <= 0) { this.wakeT = 0.13; return true; }
    return false;
  }
}

const REACH = [85, 120, 150, 180];
const SWING = [0.12, 0.3, 0.42, 0.55];

export class BoatsView {
  private models = new Map<number, BoatModel>();
  readonly foam: BoatFoam[] = [];
  private ws = { h: 0, sx: 0, sz: 0 };
  private pts = [0, 0, 0, 0, 0].map(() => ({ h: 0, sx: 0, sz: 0 }));
  constructor(private scene: THREE.Scene, private wake: Wake) {}

  private pose(b: Boat, tier: number): { x: number; z: number; dx: number; dz: number } {
    const berth = LAYOUT.berths[b.berth];
    const side = b.berth % 2 === 0 ? -1 : 1;
    const mx = side * (2.2 + halfBeam(tier) + 0.35);
    if (b.status !== 'out' || b.tripTime <= 0) return { x: mx, z: berth.boatZ, dx: 0, dz: 0 };
    const zi = Math.max(0, ZONE_IDS.indexOf(b.zone ?? 'shallows'));
    const f = (t: number) => {
      const o = REACH[zi] * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      // swing away from the pier first so boats clear the berths behind them
      return { x: mx + side * (Math.min(1, o / 5) * 3.4 + o * SWING[zi]), z: berth.boatZ - o };
    };
    const t = b.progress / b.tripTime;
    const p = f(t), q = f(t + 0.004);
    return { x: p.x, z: p.z, dx: q.x - p.x, dz: q.z - p.z };
  }

  sync(state: GameState, now: number, dt: number): void {
    const ids = new Set<number>();
    this.foam.length = 0;
    for (const b of state.boats) {
      ids.add(b.id);
      let m = this.models.get(b.id);
      if (!m) {
        m = new BoatModel();
        this.models.set(b.id, m);
        this.scene.add(m.group);
      }
      m.sync(b);
      const p = this.pose(b, m.tier);
      const moving = b.status === 'out' && (p.dx !== 0 || p.dz !== 0);
      let target = Math.PI; // docked boats lie bow-in
      if (moving) target = Math.atan2(-p.dx, -p.dz);
      let d = ((target - m.heading + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      m.heading += d * Math.min(1, dt * 3);
      // Ride the same wave field the water shader draws.
      const c = Math.cos(m.heading), s = Math.sin(m.heading);
      const at = (lx: number, lz: number, o: { h: number; sx: number; sz: number }) => waveAt(p.x + lx * c + lz * s, p.z - lx * s + lz * c, now, o);
      const sc = m.scale;
      at(0, 0, this.ws);
      const hwid = halfBeam(m.tier);
      const hb = at(0, -1.9 * sc, this.pts[0]).h, hs = at(0, 1.7 * sc, this.pts[1]).h;
      const hl = at(-hwid, 0, this.pts[2]).h, hr = at(hwid, 0, this.pts[3]).h;
      const pitch = Math.atan2(hb - hs, 3.6 * sc) * 1.25;
      const roll = Math.atan2(hr - hl, 2 * hwid) * 1.25;
      m.group.position.set(p.x, SEA_Y - 0.36 + this.ws.h, p.z);
      m.group.rotation.set(pitch, m.heading, roll, 'YXZ');
      m.animate(dt, now, moving);
      if (moving && m.tickWake(dt)) {
        for (const sx of [-1, 1]) {
          this.wake.emit(p.x + (sx * 0.45) * c + 1.9 * s, p.z - sx * 0.45 * s + 1.9 * c, 0.9 * sc, 1.9);
          this.wake.emit(p.x + sx * 0.35 * c - 1.9 * s, p.z - sx * 0.35 * s - 1.9 * c, 0.6 * sc, 1.2);
        }
        this.wake.emit(p.x + 3.4 * s, p.z + 3.4 * c, 1.3 * sc, 2.4);
      }
      this.foam.push({ x: p.x, z: p.z, heading: m.heading, scale: sc });
    }
    for (const [id, m] of this.models) {
      if (!ids.has(id)) {
        this.scene.remove(m.group);
        this.models.delete(id);
      }
    }
  }
}
