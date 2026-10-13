import * as THREE from 'three';
import { flat } from './kit';

/** Kept for older call sites: a lit flat-colour material. */
export function mat(color: number): THREE.MeshStandardMaterial {
  return flat(color, 0.9);
}

export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

export interface FigureOpts {
  skin?: number;
  shirt: number;
  pants: number;
  hat?: 'straw' | 'cap' | 'none';
  hatColor?: number;
  apron?: number;
  scale?: number;
  hair?: number;
  beard?: number;
  boots?: number;
}

export interface Pose {
  carry: number;                 // 0..1 arms hold crates in front
  fish: { t: number; bite: boolean } | null; // t = seconds since cast
  wave: boolean;
}

const ease = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function cap(r: number, len: number, color: number, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent?.add(m);
  return m;
}
function ball(r: number, color: number, x = 0, y = 0, z = 0, parent?: THREE.Object3D, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent?.add(m);
  return m;
}

/** Code-built stylised person with a full procedural rig. Front faces +z. */
export class Figure {
  group = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private arm: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  private elbow: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  private leg: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  private knee: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  private hand = new THREE.Object3D();
  private phase = Math.random() * 6;
  private amp = 0;
  private lean = 0;
  private carry = 0;
  private idle = Math.random() * 10;
  private yaw = 0;
  private pitch = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private blink = 0;
  private fishBlend = 0;
  pose: Pose = { carry: 0, fish: null, wave: false };

  constructor(o: FigureOpts) {
    const skin = o.skin ?? 0xf0c8a0;
    const boots = o.boots ?? 0x4a3a2c;
    this.group.add(this.hips);
    this.hips.position.y = 0.6;
    this.hips.add(this.torso);
    // pelvis + torso
    cap(0.19, 0.12, o.pants, 0, -0.02, 0, this.hips).scale.set(1.1, 1, 0.85);
    cap(0.2, 0.3, o.shirt, 0, 0.32, 0, this.torso).scale.set(1.2, 1, 0.8);
    box(0.44, 0.07, 0.3, 0x3a2c22, 0, 0.06, 0, this.torso);                      // belt
    if (o.apron) box(0.4, 0.46, 0.05, o.apron, 0, 0.26, 0.17, this.torso);
    // head
    this.torso.add(this.head);
    this.head.position.set(0, 0.66, 0);
    cap(0.05, 0.04, skin, 0, 0.0, 0, this.head);
    const hd = ball(0.22, skin, 0, 0.22, 0, this.head, 1, 1.05, 1);
    ball(0.035, 0x241c18, -0.08, 0.25, 0.19, this.head);
    ball(0.035, 0x241c18, 0.08, 0.25, 0.19, this.head);
    ball(0.045, skin, 0, 0.2, 0.22, this.head);
    ball(0.05, 0xe69a8a, -0.13, 0.17, 0.17, this.head, 1, 0.6, 0.4).material = flat(0xe9a090, 0.9);
    ball(0.05, 0xe69a8a, 0.13, 0.17, 0.17, this.head, 1, 0.6, 0.4).material = flat(0xe9a090, 0.9);
    ball(0.045, skin, -0.21, 0.22, 0, this.head, 0.6, 1, 0.8);
    ball(0.045, skin, 0.21, 0.22, 0, this.head, 0.6, 1, 0.8);
    if (o.hair !== undefined && o.hat !== 'cap' && o.hat !== 'straw') {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(o.hair));
      h.position.set(0, 0.24, -0.01);
      h.castShadow = true;
      this.head.add(h);
    }
    if (o.beard !== undefined) {
      const b = ball(0.18, o.beard, 0, 0.1, 0.1, this.head, 1.05, 0.9, 0.8);
      b.castShadow = false;
    }
    const hc = o.hatColor ?? 0xe6c35c;
    if (o.hat === 'straw') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.04, 20), mat(hc));
      brim.position.y = 0.4; brim.castShadow = true;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.17, 14), mat(hc));
      crown.position.y = 0.49; crown.castShadow = true;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.045, 14), mat(0xb5412f));
      band.position.y = 0.43;
      this.head.add(brim, crown, band);
    } else if (o.hat === 'cap') {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hc));
      c.position.y = 0.26; c.castShadow = true;
      this.head.add(c);
      box(0.32, 0.03, 0.2, hc, 0, 0.27, 0.22, this.head);
    }
    void hd;
    // arms: shoulder -> upper arm -> elbow -> forearm + hand
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const sh = this.arm[i];
      sh.position.set(s * 0.37, 0.56, 0);
      this.torso.add(sh);
      cap(0.07, 0.2, o.shirt, 0, -0.15, 0, sh);
      const el = this.elbow[i];
      el.position.y = -0.31;
      sh.add(el);
      cap(0.062, 0.18, o.shirt, 0, -0.13, 0, el);
      ball(0.075, skin, 0, -0.29, 0, el);
      if (i === 1) { this.hand.position.set(0, -0.3, 0); el.add(this.hand); }
    }
    // legs
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const lg = this.leg[i];
      lg.position.set(s * 0.12, -0.02, 0);
      this.hips.add(lg);
      cap(0.09, 0.2, o.pants, 0, -0.18, 0, lg);
      const kn = this.knee[i];
      kn.position.y = -0.36;
      lg.add(kn);
      cap(0.08, 0.2, o.pants, 0, -0.17, 0, kn);
      box(0.15, 0.1, 0.26, boots, 0, -0.36, 0.05, kn);
    }
    if (o.scale) this.group.scale.setScalar(o.scale);
  }

  /** Where the right hand is in world space (used to attach the fishing rod). */
  handWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.hand.getWorldPosition(out);
  }

  /** Ask the head to turn towards a direction relative to the body (radians). */
  look(yawRel: number, pitchRel = 0): void {
    this.lookYaw = Math.max(-1.1, Math.min(1.1, yawRel));
    this.lookPitch = Math.max(-0.4, Math.min(0.4, pitchRel));
  }

  /** speed in m/s. Call every frame. */
  update(dt: number, speed: number): void {
    const k = (r: number) => Math.min(1, dt * r);
    const moving = speed > 0.15;
    this.amp += ((moving ? 1 : 0) - this.amp) * k(10);
    const sp = Math.min(1.3, speed / 5.2);
    if (moving) this.phase += dt * (6 + speed * 1.15);
    this.idle += dt;
    this.carry += (this.pose.carry - this.carry) * k(9);
    const fishing = this.pose.fish !== null;
    this.fishBlend += ((fishing ? 1 : 0) - this.fishBlend) * k(8);
    const a = this.amp, ph = this.phase, s = Math.sin(ph), c = Math.cos(ph);
    const breath = Math.sin(this.idle * 1.9);
    const still = 1 - a;

    // legs
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? 1 : -1;
      const p = ph + (i === 0 ? 0 : Math.PI);
      this.leg[i].rotation.x = -Math.sin(p) * 0.8 * a;
      this.knee[i].rotation.x = Math.max(0, Math.cos(p)) * 1.0 * a + 0.04 * still;
      void sg;
    }
    // body motion
    this.hips.position.y = 0.6 - 0.025 * a + 0.05 * (1 - Math.abs(s)) * a * sp + breath * 0.004 * still;
    this.hips.rotation.y = -0.12 * s * a;
    this.hips.rotation.z = 0.04 * c * a + Math.sin(this.idle * 0.5) * 0.015 * still;
    const targetLean = 0.16 * sp * a;
    this.lean += (targetLean - this.lean) * k(8);
    this.torso.rotation.x = this.lean;
    this.torso.rotation.y = 0.16 * s * a;
    this.torso.scale.y = 1 + breath * 0.012 * still;
    this.torso.rotation.z = -this.hips.rotation.z * 0.7;

    // arms
    for (let i = 0; i < 2; i++) {
      const p = ph + (i === 0 ? 0 : Math.PI);
      const swing = Math.sin(p) * 0.7 * a * (1 - this.carry);
      let ax = swing + breath * 0.03 * still;
      let ex = -(0.18 + 0.35 * Math.max(0, Math.cos(p))) * a * (1 - this.carry) - 0.08 * still;
      let az = (i === 0 ? -1 : 1) * (0.06 + 0.03 * breath * still);
      // carrying: forearms forward, hugging the crates
      ax = lerp(ax, -1.15, this.carry);
      ex = lerp(ex, -0.55, this.carry);
      az = lerp(az, (i === 0 ? 1 : -1) * 0.22, this.carry);
      this.arm[i].rotation.set(ax, 0, az);
      this.elbow[i].rotation.set(ex, 0, 0);
    }

    // wave hello
    if (this.pose.wave) {
      this.arm[1].rotation.set(-2.7, 0, 0.35);
      this.elbow[1].rotation.set(-0.5 + Math.sin(this.idle * 9) * 0.35, 0, 0);
    }

    // fishing: cast swing, then hold the rod forward; jerk on a bite
    const f = this.pose.fish;
    if (f) {
      const t = f.t;
      let r: number, torso = 0.12;
      if (t < 0.22) { r = lerp(-0.4, 0.5, ease(t / 0.22)); torso = lerp(0.1, -0.25, ease(t / 0.22)); }
      else if (t < 0.5) { const u = ease((t - 0.22) / 0.28); r = lerp(0.5, -1.5, u); torso = lerp(-0.25, 0.28, u); }
      else { r = -1.15 + Math.sin(this.idle * 1.6) * 0.04; torso = 0.1; }
      if (f.bite) { r = -1.45 + Math.sin(this.idle * 38) * 0.1; torso = -0.1; }
      const w = this.fishBlend;
      this.arm[1].rotation.set(lerp(this.arm[1].rotation.x, r, w), 0, lerp(this.arm[1].rotation.z, -0.12, w));
      this.arm[0].rotation.set(lerp(this.arm[0].rotation.x, r * 0.8 - 0.2, w), 0, lerp(this.arm[0].rotation.z, 0.3, w));
      this.elbow[1].rotation.x = lerp(this.elbow[1].rotation.x, -0.5, w);
      this.elbow[0].rotation.x = lerp(this.elbow[0].rotation.x, -0.9, w);
      this.torso.rotation.x = lerp(this.torso.rotation.x, torso, w);
      this.knee[0].rotation.x = this.knee[1].rotation.x = 0.1 * w;
    }

    // head follows the look target, with a little idle bob and blink
    this.yaw += (this.lookYaw - this.yaw) * k(7);
    this.pitch += (this.lookPitch - this.pitch) * k(7);
    this.head.rotation.set(this.pitch - this.lean * 0.6 + Math.sin(this.idle * 1.2) * 0.02 * still, this.yaw + Math.sin(this.idle * 0.7) * 0.05 * still, 0);
    this.blink -= dt;
    this.head.scale.y = this.blink > 0 && this.blink < 0.09 ? 0.97 : 1;
    if (this.blink < -3.5) this.blink = 0.1;
  }
}
