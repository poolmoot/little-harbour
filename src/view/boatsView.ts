import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { Boat, GameState } from '../sim/state';
import { bx, cy, flat, put, tex } from './kit';
import { boards } from './textures';
import { gunwale, gunwaleY, hullGeometry, hullWidth } from './hull';
import { makeCrateMesh } from './cratesView';
import { SEA_Y, waveAt } from './waves';
import type { BoatFoam, Wake } from './water';

const hullMats = {
  plain: () => tex('hullA', boards('hullA', [158, 100, 66], 8, false), 0.8),
  blue: () => tex('hullB', boards('hullB', [78, 112, 148], 8, false), 0.8),
};

class BoatModel {
  readonly group = new THREE.Group();
  private inner = new THREE.Group();
  private hullMesh: THREE.Mesh;
  private mast = new THREE.Group();
  private sail: THREE.Mesh;
  private flag: THREE.Mesh;
  private oars: THREE.Group[] = [];
  private load = new THREE.Group();
  private loadKey = '';
  private upgraded = false;
  private row = Math.random() * 6;
  private rowAmt = 0;
  private wakeT = 0;
  heading = Math.PI;
  scale = 1;

  constructor() {
    this.group.add(this.inner);
    const hm = hullMats.plain();
    hm.side = THREE.DoubleSide;
    this.hullMesh = put(hullGeometry(0.8, 0.72), hm, 0, 0, 0, this.inner);
    const rim = flat(0xd9b27a, 0.7);
    for (const s of [-1, 1]) put(gunwale(0.8, 0.72, s), rim, 0, 0, 0, this.inner);
    // white boot stripe along the outside
    bx(1.1, 0.04, 2.7, tex('hullfloor', boards('hullfloor', [196, 160, 110], 5, true), 0.9), 0, 0.2, 0.1, this.inner);
    for (const z of [-1.2, 1.55]) {
      const u = (z + 2.2) / 4;
      bx(hullWidth(u) * 2 - 0.05, 0.08, 0.3, flat(0xb98a55, 0.85), 0, 0.46, z, this.inner);
    }
    bx(0.12, 0.3, 0.12, flat(0x5a4330), 0, 0.3, 1.6, this.inner);
    // bow post and rope
    cy(0.04, 0.05, 0.5, flat(0x5a4330), 0, 0.9, -2.0, this.inner, 6);
    // oars with oarlocks
    for (const s of [-1, 1]) {
      const u = (-1.15 + 2.2) / 4;
      const lx = s * (hullWidth(u) + 0.01);
      const lock = new THREE.Group();
      lock.position.set(lx, gunwaleY(u) + 0.02, -1.15);
      cy(0.025, 0.03, 0.14, flat(0x2d3236, 0.5), 0, 0, 0, lock, 5);
      const oar = new THREE.Group();
      cy(0.028, 0.028, 2.4, flat(0xc89c62, 0.7), s * 0.45, 0, 0, oar, 6).rotation.z = Math.PI / 2;
      bx(0.7, 0.012, 0.16, flat(0xe8d6b0, 0.7), s * 1.55, 0, 0, oar);
      cy(0.04, 0.04, 0.16, flat(0x5a4330), -s * 0.7, 0, 0, oar, 6).rotation.z = Math.PI / 2;
      lock.add(oar);
      this.inner.add(lock);
      this.oars.push(oar);
    }
    // mast, boom, sail and pennant (shown once the hull upgrade is bought)
    const wood = flat(0x6a4a30, 0.8);
    cy(0.06, 0.09, 4.0, wood, 0, 2.3, -0.5, this.mast, 8);
    bx(0.06, 0.06, 1.9, wood, 0, 0.95, 0.4, this.mast);
    const sg = new THREE.PlaneGeometry(1, 1, 8, 12);
    this.sail = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xf6efdc, side: THREE.DoubleSide, roughness: 1 }));
    this.sail.castShadow = true;
    this.mast.add(this.sail);
    const fg = new THREE.PlaneGeometry(0.6, 0.28, 5, 1);
    fg.translate(0.3, 0, 0);
    this.flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xd24a3a, side: THREE.DoubleSide, roughness: 0.9 }));
    this.flag.position.set(0.0, 4.15, -0.5);
    this.flag.rotation.y = Math.PI / 2;
    this.mast.add(this.flag);
    this.mast.visible = false;
    this.inner.add(this.mast, this.load);
    this.animateSail(0);
  }

  private animateSail(t: number): void {
    const p = this.sail.geometry.attributes.position as THREE.BufferAttribute;
    const nx = 8, ny = 12;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const px = i / nx, py = j / ny;
      const k = j * (nx + 1) + i;
      const len = 1.7 * (1 - py * 0.92);
      const bulge = Math.sin(Math.PI * px) * 0.32 * (1 - py * 0.6);
      const flutter = Math.sin(t * 2.2 + py * 4 + px * 3) * 0.05 * px + Math.sin(t * 5 + px * 7) * 0.012;
      p.setXYZ(k, bulge + flutter + 0.03, 1.0 + py * 3.1, -0.5 + 0.08 + px * len);
    }
    p.needsUpdate = true;
    this.sail.geometry.computeVertexNormals();
    const f = this.flag.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < f.count; i++) f.setZ(i, Math.sin(t * 7 - f.getX(i) * 8) * 0.06 * f.getX(i) * 1.6);
    f.needsUpdate = true;
  }

  setUpgraded(u: boolean): void {
    if (u === this.upgraded) return;
    this.upgraded = u;
    this.mast.visible = u;
    this.scale = u ? 1.22 : 1;
    this.inner.scale.setScalar(this.scale);
    const m = u ? hullMats.blue() : hullMats.plain();
    m.side = THREE.DoubleSide;
    this.hullMesh.material = m;
  }

  setLoad(catchList: string[]): void {
    const key = catchList.join(',');
    if (key === this.loadKey) return;
    this.loadKey = key;
    this.load.clear();
    catchList.forEach((sp, i) => {
      const m = makeCrateMesh(sp as never);
      m.scale.setScalar(0.62);
      m.position.set(i % 2 ? 0.28 : -0.28, 0.22 + Math.floor(i / 8) * 0.25, 1.0 - Math.floor((i % 8) / 2) * 0.5);
      this.load.add(m);
    });
  }

  /** Row the oars (moving) or rest them; sway the sail. */
  animate(dt: number, t: number, moving: boolean): void {
    this.rowAmt += ((moving ? 1 : 0) - this.rowAmt) * Math.min(1, dt * 4);
    if (moving) this.row += dt * 4.2;
    const phi = this.row;
    this.oars.forEach((oar, i) => {
      const s = i === 0 ? -1 : 1;
      const rest = s * -1.35; // shipped alongside the hull
      const sweep = s === -1 ? -0.5 * Math.cos(phi) : 0.5 * Math.cos(phi);
      const dip = Math.max(0, Math.sin(phi));
      const dive = (0.1 + 0.28 * dip) * (s === -1 ? 1 : -1);
      oar.rotation.y = rest * (1 - this.rowAmt) + sweep * this.rowAmt;
      oar.rotation.z = (s === -1 ? 0.1 : -0.1) * (1 - this.rowAmt) + dive * this.rowAmt;
    });
    if (this.upgraded) this.animateSail(t);
  }

  tickWake(dt: number): boolean {
    this.wakeT -= dt;
    if (this.wakeT <= 0) { this.wakeT = 0.13; return true; }
    return false;
  }
}

export class BoatsView {
  private models = new Map<number, BoatModel>();
  readonly foam: BoatFoam[] = [];
  private ws = { h: 0, sx: 0, sz: 0 };
  private pts = [0, 0, 0, 0, 0].map(() => ({ h: 0, sx: 0, sz: 0 }));
  constructor(private scene: THREE.Scene, private wake: Wake) {}

  private pose(b: Boat): { x: number; z: number; dx: number; dz: number } {
    const berth = LAYOUT.berths[b.berth];
    if (b.status !== 'out' || b.tripTime <= 0) return { x: berth.boatX, z: berth.boatZ, dx: 0, dz: 0 };
    const reef = b.zone === 'reef';
    const maxD = reef ? 120 : 85;
    const side = b.berth === 0 ? -1 : 1;
    const f = (t: number) => {
      const o = maxD * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      return { x: berth.boatX + side * o * (reef ? 0.3 : 0.12), z: berth.boatZ - o };
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
      m.setUpgraded(state.upgrades.hull);
      m.setLoad(b.status === 'returned' ? b.catch : []);
      const p = this.pose(b);
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
      const hb = at(0, -1.9 * sc, this.pts[0]).h, hs = at(0, 1.7 * sc, this.pts[1]).h;
      const hl = at(-0.8 * sc, 0, this.pts[2]).h, hr = at(0.8 * sc, 0, this.pts[3]).h;
      const pitch = Math.atan2(hb - hs, 3.6 * sc) * 1.25;
      const roll = Math.atan2(hr - hl, 1.6 * sc) * 1.25;
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
