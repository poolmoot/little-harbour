import * as THREE from 'three';
import { LAYOUT, ZONE_IDS } from '../sim/config';
import type { Species } from '../sim/config';
import { activeCaptain, holdSize } from '../sim/fleet';
import type { Boat, Captain, GameState } from '../sim/state';
import { SPECIES_COLOUR } from '../palette';
import { cy, flat, net, put, tex } from './kit';
import { boards } from './textures';
import { BOAT_TIERS, buildBoat } from './boatModels';
import type { BoatBuild } from './boatModels';
import { Figure } from './figures';
import { captainLook } from './people';
import { SEA_Y, waveAt } from './waves';
import type { BoatFoam, Wake } from './water';

const deckY = (t: number) => BOAT_TIERS[t].deckY;
const halfBeam = (t: number) => BOAT_TIERS[t].shape.hw;
/** Boat length relative to the rowboat: sizes the foam ring, the wake and where the hull samples the waves. */
const ROWBOAT_LENGTH = BOAT_TIERS[0].shape.len;

const crateBodyGeo = new THREE.BoxGeometry(0.5, 0.32, 0.4);
const crateTopGeo = new THREE.BoxGeometry(0.4, 0.05, 0.3);
const floatGeo = new THREE.SphereGeometry(0.09, 8, 6);
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();
const TARP = new THREE.Color(0x8b7a5a);

/** Red "!" badge shown above a boat that is back and waiting to be unloaded. Drawn once, shared by every boat. */
let alertTex: THREE.CanvasTexture | null = null;
function alertTexture(): THREE.CanvasTexture {
  if (alertTex) return alertTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = '#0b1a44';
  // speech-bubble body with a pointer towards the boat
  g.beginPath();
  g.roundRect(14, 8, 100, 88, 26);
  g.moveTo(46, 94); g.lineTo(64, 122); g.lineTo(82, 94);
  g.stroke();
  const grad = g.createLinearGradient(0, 8, 0, 96);
  grad.addColorStop(0, '#ff6b5a'); grad.addColorStop(1, '#e02a2a');
  g.fillStyle = grad;
  g.fill();
  g.fillStyle = '#fff';
  g.font = '900 78px "Lilita One", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeText('!', 64, 54);
  g.fillText('!', 64, 54);
  alertTex = new THREE.CanvasTexture(c);
  alertTex.colorSpace = THREE.SRGBColorSpace;
  return alertTex;
}
const ALERT_SIZE = 1.5;

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
  /** One model per boat size, built the first time this boat reaches that size. */
  private builds: (BoatBuild | null)[] = [null, null, null, null];
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
  private alert: THREE.Sprite;
  private alertAmt = 0;
  tier = 0;
  heading = Math.PI;
  scale = 1;

  constructor() {
    this.group.add(this.inner);
    const wood = flat(0x6a4a30, 0.8);
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
    // Always drawn on top and unaffected by fog or lighting, so it reads from anywhere in the harbour.
    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false, fog: false, toneMapped: false }));
    this.alert.center.set(0.5, 0);
    this.alert.renderOrder = 9;
    this.alert.visible = false;
    this.group.add(this.alert);
    this.setHull(0);
  }

  private setHull(t: number): void {
    this.tier = t;
    let build = this.builds[t];
    if (!build) {
      build = this.builds[t] = buildBoat(t);
      this.inner.add(build.group);
    }
    this.builds.forEach((b, i) => { if (b) b.group.visible = i === t; });
    this.scale = BOAT_TIERS[t].shape.len / ROWBOAT_LENGTH;
    this.inner.scale.setScalar(1);
    this.key.sails = -1;
    this.key.gear = -1;
    this.key.load = '';
  }

  /** Mast, sails and pennant for this hull and Sails level. */
  private setRig(sails: number): void {
    const t = this.tier, T = BOAT_TIERS[t];
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
    const t = this.tier, T = BOAT_TIERS[t];
    const hw = halfBeam(t) + 0.02, ry = T.shape.H + 0.06, zr = this.scale;
    const orange = flat(0xe9772e, 0.6);
    const sides = level >= 2 ? [-1, 1] : [-1];
    for (const s of sides) {
      for (let i = 0; i < 6; i++) put(floatGeo, orange, s * hw, ry, -zr + (i / 5) * zr * 1.6, this.gearGroup);
      net(this.gearGroup, zr * 1.5, 0.55, s * (hw + 0.03), ry - 0.3, zr * 0.1, s * Math.PI / 2);
    }
    if (level >= 2) {
      const pile = put(floatGeo, flat(0xc9b58a, 0.95), 0, deckY(t) + 0.1, T.crates[2] - 3 * Math.abs(T.crates[3]) - 0.2, this.gearGroup);
      pile.scale.set(4, 1.6, 3.2);
      pile.visible = t < 3;
    }
  }

  private layoutCrates(n: number, catchList: string[]): void {
    const t = this.tier, [cols, rows, z0, dz, dx] = BOAT_TIERS[t].crates;
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

  private setCaptain(cap: Captain | null): void {
    const k = cap ? `${cap.id}|${cap.trait}` : '';
    if (k === this.captainKey) return;
    this.captainKey = k;
    if (this.captain) { this.inner.remove(this.captain.group); this.captain = null; }
    if (!cap) return;
    this.captain = new Figure(captainLook(cap.id, cap.trait));
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
    this.setCaptain(cap);
    if (this.captain) this.captain.group.position.set(0, deckY(this.tier), BOAT_TIERS[this.tier].captainZ);
  }

  /** Pop the "unload me" badge in or out, and bob it gently while it shows. */
  animateAlert(dt: number, t: number, waiting: boolean): void {
    this.alertAmt += ((waiting ? 1 : 0) - this.alertAmt) * Math.min(1, dt * 8);
    this.alert.visible = this.alertAmt > 0.02;
    if (!this.alert.visible) return;
    const top = this.mast.visible ? deckY(this.tier) + BOAT_TIERS[this.tier].mastH + 0.5 : 2.3;
    this.alert.position.y = top + Math.sin(t * 3.2) * 0.14;
    this.alert.scale.setScalar(ALERT_SIZE * this.alertAmt * (1 + Math.sin(t * 6.4) * 0.05));
  }

  /** Row the oars (moving) or rest them; sway the sails. */
  animate(dt: number, t: number, moving: boolean): void {
    this.rowAmt += ((moving ? 1 : 0) - this.rowAmt) * Math.min(1, dt * 4);
    if (moving) this.row += dt * 4.2;
    if (this.tier === 0 && !this.mast.visible) {
      const phi = this.row;
      this.builds[0]?.oars.forEach((oar, i) => {
        const s = i === 0 ? -1 : 1;
        const rest = s * -1.35;
        const sweep = s === -1 ? -0.5 * Math.cos(phi) : 0.5 * Math.cos(phi);
        const dive = (0.1 + 0.28 * Math.max(0, Math.sin(phi))) * (s === -1 ? 1 : -1);
        oar.rotation.y = rest * (1 - this.rowAmt) + sweep * this.rowAmt;
        oar.rotation.z = (s === -1 ? 0.1 : -0.1) * (1 - this.rowAmt) + dive * this.rowAmt;
      });
    }
    const oarRig = this.builds[0]?.oarRig;
    if (oarRig) oarRig.visible = !this.mast.visible;
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
      m.group.position.set(p.x, SEA_Y - BOAT_TIERS[m.tier].shape.draft + this.ws.h, p.z);
      m.group.rotation.set(pitch, m.heading, roll, 'YXZ');
      m.animate(dt, now, moving);
      m.animateAlert(dt, now, b.status === 'returned');
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
