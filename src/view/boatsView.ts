import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { Boat, GameState } from '../sim/state';
import { box, mat } from './figures';
import { makeCrateMesh } from './cratesView';

function hullShape(hw: number, bow: number, stern: number): THREE.Shape {
  // Shape y maps to world -z after rotateX(-90deg); bow (-z) is +y.
  const s = new THREE.Shape();
  s.moveTo(0, bow);
  s.lineTo(hw, bow - 1.3);
  s.lineTo(hw, -stern + 0.2);
  s.lineTo(hw * 0.8, -stern);
  s.lineTo(-hw * 0.8, -stern);
  s.lineTo(-hw, -stern + 0.2);
  s.lineTo(-hw, bow - 1.3);
  s.closePath();
  return s;
}

function extrude(shape: THREE.Shape, depth: number, color: number): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

class BoatModel {
  readonly group = new THREE.Group();
  private inner = new THREE.Group();
  private hullMesh: THREE.Mesh;
  private mast = new THREE.Group();
  private load = new THREE.Group();
  private loadKey = '';
  private upgraded = false;
  heading = Math.PI;

  constructor() {
    this.group.add(this.inner);
    this.hullMesh = extrude(hullShape(0.8, 2.2, 1.8), 0.7, 0x8b5a3c);
    this.inner.add(this.hullMesh);
    const floor = extrude(hullShape(0.62, 1.9, 1.5), 0.05, 0xc9a36b);
    floor.position.y = 0.55;
    this.inner.add(floor);
    box(1.3, 0.08, 0.3, 0x6b4a2f, 0, 0.62, 0.3, this.inner);
    box(1.3, 0.08, 0.3, 0x6b4a2f, 0, 0.62, -0.8, this.inner);
    for (const sx of [-1, 1]) {
      const oar = box(0.05, 0.05, 2.0, 0x6b4a2f, sx * 0.95, 0.75, 0, this.inner);
      oar.rotation.y = sx * 0.12;
    }
    // mast + sail (shown once the hull upgrade is bought)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6), mat(0x5a4330));
    pole.position.set(0, 2.4, -0.5);
    pole.castShadow = true;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(0, 3.0);
    sh.lineTo(1.5, 0.2);
    sh.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0xf3ecd8, side: THREE.DoubleSide, roughness: 1 }));
    sail.position.set(0.03, 1.0, -0.5);
    sail.rotation.y = Math.PI / 2;
    sail.castShadow = true;
    const flag = box(0.04, 0.22, 0.4, 0xd24a3a, 0, 4.1, -0.3);
    this.mast.add(pole, sail, flag);
    this.mast.visible = false;
    this.inner.add(this.mast, this.load);
  }

  setUpgraded(u: boolean): void {
    if (u === this.upgraded) return;
    this.upgraded = u;
    this.mast.visible = u;
    this.inner.scale.setScalar(u ? 1.22 : 1);
    (this.hullMesh.material as THREE.MeshStandardMaterial) = mat(u ? 0x4f6a86 : 0x8b5a3c);
  }

  setLoad(catchList: string[]): void {
    const key = catchList.join(',');
    if (key === this.loadKey) return;
    this.loadKey = key;
    this.load.clear();
    catchList.forEach((sp, i) => {
      const m = makeCrateMesh(sp as never);
      m.scale.setScalar(0.62);
      m.position.set(i % 2 ? 0.28 : -0.28, 0.62 + Math.floor(i / 8) * 0.25, 1.15 - Math.floor((i % 8) / 2) * 0.55);
      this.load.add(m);
    });
  }
}

export class BoatsView {
  private models = new Map<number, BoatModel>();
  constructor(private scene: THREE.Scene) {}

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
      let target = Math.PI; // docked boats lie bow-in
      if (b.status === 'out' && (p.dx !== 0 || p.dz !== 0)) target = Math.atan2(-p.dx, -p.dz);
      let d = ((target - m.heading + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      m.heading += d * Math.min(1, dt * 3);
      m.group.position.set(p.x, -0.42 + Math.sin(now * 1.7 + b.id) * 0.05, p.z);
      m.group.rotation.set(Math.sin(now * 1.3 + b.id) * 0.03, m.heading, Math.sin(now * 1.1 + b.id * 2) * 0.04, 'YXZ');
    }
    for (const [id, m] of this.models) {
      if (!ids.has(id)) {
        this.scene.remove(m.group);
        this.models.delete(id);
      }
    }
  }
}
