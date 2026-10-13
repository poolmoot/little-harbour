import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { FishingState } from '../sim/state';
import { Figure, mat } from './figures';
import type { World } from './world';

const SPEED = 5.2;
const RADIUS = 0.4;

export class Player {
  readonly group = new THREE.Group();
  readonly carryGroup = new THREE.Group();
  readonly figure: Figure;
  readonly pos = new THREE.Vector3(LAYOUT.playerStart.x, 0, LAYOUT.playerStart.z);
  facing = 0;
  speed = 0;
  private stepDist = 0;
  private rod = new THREE.Group();

  constructor(scene: THREE.Scene, private world: World) {
    this.figure = new Figure({ shirt: 0x3f7fbf, pants: 0x4a4a5a, hat: 'straw' });
    this.group.add(this.figure.group, this.carryGroup);
    const pivot = this.rod;
    pivot.position.set(0.4, 1.0, 0.25);
    pivot.rotation.order = 'YXZ';
    pivot.rotation.x = 1.15;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.6, 5), mat(0x6b4a2f));
    stick.position.y = 1.3;
    stick.castShadow = true;
    pivot.add(stick);
    pivot.visible = false;
    this.group.add(pivot);
    scene.add(this.group);
    this.sync();
  }

  /** Returns true when a footstep should sound. */
  update(dt: number, move: { x: number; z: number }, frozen: boolean, faceSea: boolean): boolean {
    let stepped = false;
    const m = frozen ? { x: 0, z: 0 } : move;
    const moving = m.x !== 0 || m.z !== 0;
    if (moving) {
      const nx = this.pos.x + m.x * SPEED * dt;
      const nz = this.pos.z + m.z * SPEED * dt;
      const r = this.world.resolve(this.pos.x, this.pos.z, nx, nz, RADIUS);
      const moved = Math.hypot(r.x - this.pos.x, r.z - this.pos.z);
      this.pos.x = r.x;
      this.pos.z = r.z;
      this.speed = moved / Math.max(dt, 1e-4);
      this.facing = this.turn(this.facing, Math.atan2(m.x, m.z), dt * 14);
      this.stepDist += moved;
      if (this.stepDist > 1.5) {
        this.stepDist = 0;
        stepped = true;
      }
    } else {
      this.speed = 0;
      if (faceSea) this.facing = this.turn(this.facing, Math.PI, dt * 10);
    }
    this.figure.update(dt, this.speed);
    this.sync();
    return stepped;
  }

  private turn(cur: number, target: number, k: number): number {
    let d = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return cur + d * Math.min(1, k);
  }

  private sync(): void {
    this.group.position.copy(this.pos);
    this.figure.group.rotation.y = this.facing;
    this.carryGroup.rotation.y = this.facing;
    this.rod.rotation.y = this.facing;
    this.rod.position.set(0.4 * Math.cos(this.facing) + 0.25 * Math.sin(this.facing), 1.0, -0.4 * Math.sin(this.facing) + 0.25 * Math.cos(this.facing));
  }

  setRodVisible(v: boolean): void {
    this.rod.visible = v;
  }

  rodTip(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return this.rod.localToWorld(out.set(0, 2.6, 0));
  }
}

/** Float, line, bite marker and ripple for pier fishing. */
export class FishingView {
  private float = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0xe04a3a));
  private line: THREE.Line;
  private mark: THREE.Sprite;
  private ripple = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.35, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  private castT = 0;
  private lastPhase: FishingState['phase'] = 'idle';
  private tip = new THREE.Vector3();
  private spot = new THREE.Vector3(LAYOUT.fishingSpot.x, -0.6, LAYOUT.pierEndZ - 2.6);

  constructor(scene: THREE.Scene, private player: Player) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf4f0e0 }));
    this.line.frustumCulled = false;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#d62828';
      g.beginPath();
      g.arc(32, 32, 28, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = 'bold 44px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', 32, 34);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    this.mark.scale.set(1.1, 1.1, 1);
    this.mark.renderOrder = 10;
    this.ripple.rotation.x = -Math.PI / 2;
    this.float.castShadow = true;
    scene.add(this.float, this.line, this.mark, this.ripple);
    this.hide();
  }

  private hide(): void {
    this.float.visible = this.line.visible = this.mark.visible = this.ripple.visible = false;
  }

  update(dt: number, now: number, f: FishingState): void {
    if (f.phase === 'idle') {
      this.lastPhase = 'idle';
      this.castT = 0;
      this.player.setRodVisible(false);
      this.hide();
      return;
    }
    this.player.setRodVisible(true);
    this.castT += dt;
    this.player.rodTip(this.tip);
    const k = Math.min(1, this.castT / 0.5);
    const e = 1 - (1 - k) * (1 - k);
    const p = this.float.position;
    p.lerpVectors(this.tip, this.spot, e);
    p.y += Math.sin(k * Math.PI) * 2.2;
    const bite = f.phase === 'bite';
    if (k >= 1) p.y = this.spot.y + 0.1 + (bite ? Math.sin(now * 40) * 0.08 - 0.12 : Math.sin(now * 2.2) * 0.03);
    this.float.visible = true;
    this.line.visible = true;
    const pa = this.line.geometry.attributes.position as THREE.BufferAttribute;
    pa.setXYZ(0, this.tip.x, this.tip.y, this.tip.z);
    pa.setXYZ(1, p.x, p.y, p.z);
    pa.needsUpdate = true;
    this.mark.visible = bite;
    this.mark.position.set(p.x, p.y + 1.3 + Math.sin(now * 14) * 0.08, p.z);
    if (bite && this.lastPhase !== 'bite') this.castT = Math.max(this.castT, 0.5);
    this.ripple.visible = bite;
    if (bite) {
      const t = (0.7 - f.timer) / 0.7;
      this.ripple.position.set(p.x, -0.58, p.z);
      this.ripple.scale.setScalar(1 + t * 4);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
    }
    this.lastPhase = f.phase;
  }
}

/** Pulsing ring on the ground under whatever E will act on. */
export class TargetMarker {
  private ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 28), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }));
  constructor(scene: THREE.Scene) {
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 5;
    this.ring.visible = false;
    scene.add(this.ring);
  }
  update(now: number, target: { x: number; z: number } | null): void {
    this.ring.visible = target !== null;
    if (!target) return;
    this.ring.position.set(target.x, 0.12, target.z);
    this.ring.scale.setScalar(1 + Math.sin(now * 5) * 0.12);
  }
}
