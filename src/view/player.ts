import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { FishingState } from '../sim/state';
import { Figure, mat } from './figures';
import { REST_HIPS } from './gait';
import { accelerate, turnToward } from './motion';
import { SEA_Y, waveAt } from './waves';
import type { Ripple } from './water';
import type { World } from './world';

const SPEED = 5.2;
const RADIUS = 0.4;
/** Speeding up takes about 0.17 s and letting go about 0.11 s (m/s per second). */
const ACCEL = 30, DECEL = 47;
const NONE = { x: 0, z: 0 };

export class Player {
  readonly group = new THREE.Group();
  readonly carryGroup = new THREE.Group();
  readonly figure: Figure;
  readonly pos = new THREE.Vector3(LAYOUT.playerStart.x, 0, LAYOUT.playerStart.z);
  facing = 0;
  /** How fast the player is really moving (m/s), after walls. */
  speed = 0;
  private vel = { x: 0, z: 0 };
  private want = { x: 0, z: 0 };
  private lastX = LAYOUT.playerStart.x;
  private lastZ = LAYOUT.playerStart.z;
  private sinceStep = 0;
  private rod = new THREE.Group();
  private rodSegs: THREE.Group[] = [];
  private tipObj = new THREE.Object3D();
  private hand = new THREE.Vector3();

  constructor(scene: THREE.Scene, private world: World) {
    this.figure = new Figure({ shirt: 0xf2efe6, pants: 0x3f6fb8, overalls: 0x3f6fb8, scarf: 0xd6453a, hat: 'straw', hair: 0x7a4a24, boots: 0x6a4a2c });
    this.group.add(this.figure.group, this.carryGroup);
    // Fishing rod: three tapered segments that bend towards the tip.
    this.rod.rotation.order = 'YXZ';
    let parent: THREE.Object3D = this.rod;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      seg.position.y = i === 0 ? 0 : 0.9;
      const len = 0.9;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02 - i * 0.005, 0.03 - i * 0.006, len, 5), mat(i === 0 ? 0x5a4330 : 0x7b5a3a));
      m.position.y = len / 2;
      m.castShadow = true;
      seg.add(m);
      parent.add(seg);
      this.rodSegs.push(seg);
      parent = seg;
    }
    this.tipObj.position.y = 0.9;
    parent.add(this.tipObj);
    this.rod.visible = false;
    this.group.add(this.rod);
    scene.add(this.group);
    this.sync();
    if (import.meta.env.DEV) (window as unknown as { __player?: Player }).__player = this; // dev-only, for scripted checks
  }

  /** Returns true when a footstep should sound. */
  update(dt: number, move: { x: number; z: number }, frozen: boolean, faceSea: boolean): boolean {
    const m = frozen ? NONE : move;
    const moving = m.x !== 0 || m.z !== 0;
    // Somebody moved the player (a teleport, being stepped off a new building): start again from rest.
    if (Math.abs(this.pos.x - this.lastX) + Math.abs(this.pos.z - this.lastZ) > 0.05) { this.vel.x = this.vel.z = 0; this.speed = 0; }
    this.want.x = m.x * SPEED;
    this.want.z = m.z * SPEED;
    accelerate(this.vel, this.want, dt, ACCEL, DECEL);
    if (this.vel.x !== 0 || this.vel.z !== 0) {
      const r = this.world.resolve(this.pos.x, this.pos.z, this.pos.x + this.vel.x * dt, this.pos.z + this.vel.z * dt, RADIUS);
      const mx = r.x - this.pos.x, mz = r.z - this.pos.z;
      this.pos.x = r.x;
      this.pos.z = r.z;
      // Keep only the speed that was really achieved: pushing into a wall stops cleanly instead of jittering.
      const inv = 1 / Math.max(dt, 1e-4);
      this.vel.x = mx * inv;
      this.vel.z = mz * inv;
    }
    const actual = Math.hypot(this.vel.x, this.vel.z);
    this.speed += (actual - this.speed) * Math.min(1, dt * 22);
    if (this.speed < 0.02 && actual === 0) this.speed = 0;
    if (moving) this.facing = turnToward(this.facing, Math.atan2(m.x, m.z), dt);
    else if (faceSea) this.facing = turnToward(this.facing, Math.PI, dt, 8);
    this.lastX = this.pos.x;
    this.lastZ = this.pos.z;
    // Crates in the hands make the walk heavier.
    this.figure.pose.load = this.carryGroup.children.length;
    this.figure.update(dt, this.speed);
    this.sync();
    // A footstep sounds each time a boot lands, no more often than five times a second.
    this.sinceStep += dt;
    if (this.figure.landed && this.speed > 0.4 && this.sinceStep > 0.2) { this.sinceStep = 0; return true; }
    return false;
  }

  private sync(): void {
    this.group.position.copy(this.pos);
    this.figure.group.rotation.y = this.facing;
    this.carryGroup.rotation.y = this.facing;
    // Carried crates sit at hand height and ride the body's bob.
    this.carryGroup.position.y = this.figure.hipsY - 0.6 + (REST_HIPS - this.figure.hipsY) * 0.2;
  }

  setRodVisible(v: boolean): void {
    this.rod.visible = v;
  }

  /** Put the rod in the right hand, tilted `theta` rad from vertical towards the facing direction, bent `bend` rad per segment. */
  placeRod(theta: number, bend: number): void {
    this.figure.handWorld(this.hand);
    this.group.worldToLocal(this.hand);
    this.rod.position.copy(this.hand);
    this.rod.rotation.set(theta, this.facing, 0, 'YXZ');
    this.rodSegs.forEach((s, i) => { s.rotation.x = i === 0 ? 0 : bend; });
  }

  rodTip(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return this.tipObj.getWorldPosition(out);
  }
}

/** Float, line, bite marker and water ripples for pier fishing. */
export class FishingView {
  private float = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0xe04a3a));
  private cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xf6f0e0));
  private line: THREE.Line;
  private mark: THREE.Sprite;
  private castT = 0;
  private evtT = 9;
  private landed = false;
  private lastPhase: FishingState['phase'] = 'idle';
  private tip = new THREE.Vector3();
  private spot = new THREE.Vector3(LAYOUT.fishingSpot.x, SEA_Y, LAYOUT.pierEndZ - 2.6);
  private ws = { h: 0, sx: 0, sz: 0 };
  readonly ripples: Ripple[] = [];
  private static N = 16;

  constructor(scene: THREE.Scene, private player: Player) {
    const geo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: FishingView.N }, () => new THREE.Vector3()));
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
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
    this.mark.scale.set(1.1, 1.1, 1);
    this.mark.renderOrder = 10;
    this.float.castShadow = true;
    this.float.add(this.cap);
    this.cap.position.y = 0.0;
    scene.add(this.float, this.line, this.mark);
    this.hide();
  }

  private hide(): void {
    this.float.visible = this.line.visible = this.mark.visible = false;
  }

  update(dt: number, now: number, f: FishingState): void {
    this.ripples.length = 0;
    if (f.phase === 'idle') {
      this.lastPhase = 'idle';
      this.castT = 0;
      this.evtT = 9;
      this.landed = false;
      this.player.figure.pose.fish = null;
      this.player.setRodVisible(false);
      this.hide();
      return;
    }
    const bite = f.phase === 'bite';
    this.player.setRodVisible(true);
    this.castT += dt;
    this.evtT += dt;
    this.player.figure.pose.fish = { t: this.castT, bite };

    // rod: wind back, flick forward, then hold; bends under a bite
    const t = this.castT;
    let theta: number;
    if (t < 0.22) theta = 0.35 - 0.8 * (t / 0.22);
    else if (t < 0.5) theta = -0.45 + 1.7 * ((t - 0.22) / 0.28);
    else theta = 1.25 - 0.1 * Math.min(1, (t - 0.5) * 2);
    if (bite) theta = 0.95 + Math.sin(now * 40) * 0.05;
    this.player.placeRod(theta, bite ? 0.42 : 0.1 + Math.sin(now * 2) * 0.01);
    this.player.rodTip(this.tip);

    const k = Math.min(1, t / 0.5);
    const e = 1 - (1 - k) * (1 - k);
    const p = this.float.position;
    waveAt(this.spot.x, this.spot.z, now, this.ws);
    const rest = SEA_Y + this.ws.h + 0.08;
    p.set(
      this.tip.x + (this.spot.x - this.tip.x) * e,
      this.tip.y + (rest - this.tip.y) * e + Math.sin(k * Math.PI) * 2.2,
      this.tip.z + (this.spot.z - this.tip.z) * e,
    );
    if (k >= 1) p.y = rest + (bite ? Math.sin(now * 40) * 0.05 - 0.14 : Math.sin(now * 2.2) * 0.02);
    this.float.visible = true;
    this.line.visible = true;
    this.float.rotation.set(this.ws.sz * 2, 0, -this.ws.sx * 2);

    const pa = this.line.geometry.attributes.position as THREE.BufferAttribute;
    const sag = k < 1 ? 0.15 : bite ? 0.05 : 0.5;
    const N = FishingView.N;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      pa.setXYZ(i, this.tip.x + (p.x - this.tip.x) * s, this.tip.y + (p.y - this.tip.y) * s - Math.sin(Math.PI * s) * sag, this.tip.z + (p.z - this.tip.z) * s);
    }
    pa.needsUpdate = true;
    this.mark.visible = bite;
    this.mark.position.set(p.x, p.y + 1.3 + Math.sin(now * 14) * 0.08, p.z);
    if (bite && this.lastPhase !== 'bite') { this.castT = Math.max(this.castT, 0.5); this.evtT = 0; }
    if (k >= 1 && !this.landed) { this.landed = true; this.evtT = 0; }
    this.lastPhase = f.phase;

    if (k >= 1) {
      for (let i = 0; i < 2; i++) {
        const ph = (now * 0.45 + i * 0.5) % 1;
        this.ripples.push({ x: p.x, z: p.z, radius: 0.2 + ph * 1.5, amp: (1 - ph) * (bite ? 0.9 : 0.45) });
      }
      if (this.evtT < 0.9) this.ripples.push({ x: p.x, z: p.z, radius: 0.2 + this.evtT * 3.6, amp: 1 - this.evtT / 0.9 });
    }
  }
}

/** Pulsing ring on the ground under whatever E will act on. */
export class TargetMarker {
  private ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 28), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
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
