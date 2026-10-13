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
  /** Dungarees bib and straps in this colour. */
  overalls?: number;
  /** Neckerchief in this colour. */
  scarf?: number;
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
/** Speeds (m/s) between which the gait blends from a walk into a run. */
const RUN_FROM = 2, RUN_FULL = 4.6;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Three-step light ramp that gives characters their cel-shaded look. */
const RAMP = new THREE.DataTexture(new Uint8Array([165, 215, 255, 255]), 4, 1, THREE.RedFormat);
RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
RAMP.needsUpdate = true;

const toonCache = new Map<number, THREE.MeshToonMaterial>();
function toon(color: number): THREE.MeshToonMaterial {
  let m = toonCache.get(color);
  if (!m) { m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP }); toonCache.set(color, m); }
  return m;
}

/** Ink outline: the mesh drawn again inside-out, pushed out along its normals. */
const OUTLINE_WIDTH = 0.016;
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1b1630, side: THREE.BackSide });
OUTLINE.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${OUTLINE_WIDTH.toFixed(3)};`);
};

const INK = 0x241c2c;
type Part = THREE.Mesh & { userData: { outline?: boolean } };

function part(g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, parent: THREE.Object3D, outline = true): Part {
  const m = new THREE.Mesh(g, toon(color)) as Part;
  m.position.set(x, y, z);
  m.castShadow = outline;
  m.userData.outline = outline;
  parent.add(m);
  return m;
}
const cap = (r: number, len: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D) =>
  part(new THREE.CapsuleGeometry(r, len, 4, 12), color, x, y, z, parent);
function ball(r: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D, sx = 1, sy = 1, sz = 1, outline = true): Part {
  const m = part(new THREE.SphereGeometry(r, 16, 12), color, x, y, z, parent, outline);
  m.scale.set(sx, sy, sz);
  return m;
}
/** Small surface detail (belt, straps, brows): flat-sided, so it gets no outline. */
const slab = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D) =>
  part(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent, false);

function addOutlines(root: THREE.Object3D): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as Part).isMesh && (o as Part).userData.outline) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) m.add(new THREE.Mesh(m.geometry, OUTLINE));
}

/** Code-built cartoon person with a full procedural rig: big head, expressive face, cel shading and ink outlines. Front faces +z. */
export class Figure {
  group = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private eyes = new THREE.Group();
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
  private lastSpeed = 0;
  private accel = 0;
  private headSteady = 0;
  private headNod = 0;
  pose: Pose = { carry: 0, fish: null, wave: false };

  constructor(o: FigureOpts) {
    const skin = o.skin ?? 0xf6c9a0;
    this.group.add(this.hips);
    this.hips.position.y = 0.6;
    this.hips.add(this.torso);
    this.buildBody(o);
    this.buildHead(o, skin);
    this.buildHat(o);
    this.buildLimbs(o, skin);
    addOutlines(this.group);
    if (o.scale) this.group.scale.setScalar(o.scale);
  }

  private buildBody(o: FigureOpts): void {
    cap(0.2, 0.1, o.pants, 0, -0.02, 0, this.hips).scale.set(1.12, 1, 0.92);
    cap(0.22, 0.26, o.shirt, 0, 0.32, 0, this.torso).scale.set(1.18, 1, 0.92);
    slab(0.5, 0.07, 0.4, 0x3a2c22, 0, 0.07, 0, this.torso);                       // belt
    slab(0.09, 0.08, 0.03, 0xe0b040, 0, 0.07, 0.2, this.torso);                   // buckle
    if (o.overalls !== undefined) {
      slab(0.3, 0.26, 0.05, o.overalls, 0, 0.26, 0.19, this.torso);               // bib
      for (const s of [-1, 1]) {
        slab(0.06, 0.32, 0.42, o.overalls, s * 0.14, 0.44, 0, this.torso);        // straps over the shoulders
        ball(0.028, 0xe0b040, s * 0.12, 0.36, 0.22, this.torso, 1, 1, 0.5, false);
      }
    }
    if (o.apron) slab(0.42, 0.5, 0.05, o.apron, 0, 0.24, 0.2, this.torso);
    if (o.scarf !== undefined) {
      const ring = part(new THREE.TorusGeometry(0.15, 0.055, 8, 16), o.scarf, 0, 0.63, 0, this.torso);
      ring.rotation.x = Math.PI / 2;
      ball(0.06, o.scarf, 0.06, 0.58, 0.16, this.torso, 1, 1.3, 0.8);
    }
  }

  private buildHead(o: FigureOpts, skin: number): void {
    const h = this.head;
    this.torso.add(h);
    h.position.set(0, 0.66, 0);
    cap(0.06, 0.04, skin, 0, 0, 0, h);                                            // neck
    ball(0.29, skin, 0, 0.27, 0, h, 1, 0.94, 0.95);
    for (const s of [-1, 1]) ball(0.06, skin, s * 0.285, 0.25, 0, h, 0.55, 1, 0.8); // ears
    // face: big eyes with highlights, brows, button nose, smile, rosy cheeks
    h.add(this.eyes);
    this.eyes.position.set(0, 0.29, 0);
    for (const s of [-1, 1]) {
      ball(0.075, 0xffffff, s * 0.11, 0, 0.235, this.eyes, 0.85, 1.1, 0.5, false);
      ball(0.046, INK, s * 0.108, -0.005, 0.262, this.eyes, 0.9, 1.15, 0.5, false);
      ball(0.016, 0xffffff, s * 0.108 - 0.016, 0.02, 0.284, this.eyes, 1, 1, 0.5, false);
      slab(0.1, 0.024, 0.02, o.beard ?? o.hair ?? 0x5a3d28, s * 0.11, 0.4, 0.245, h).rotation.z = -s * 0.16;
      ball(0.055, 0xf09a8c, s * 0.19, 0.17, 0.2, h, 1, 0.6, 0.4, false);
    }
    ball(0.042, skin, 0, 0.22, 0.275, h, 1, 0.9, 0.9, false).material = toon(new THREE.Color(skin).multiplyScalar(0.9).getHex());
    if (o.beard === undefined) {
      const smile = part(new THREE.TorusGeometry(0.06, 0.013, 6, 12, Math.PI), 0x9a3b3b, 0, 0.175, 0.255, h, false);
      smile.rotation.z = Math.PI;
    } else {
      ball(0.24, o.beard, 0, 0.12, 0.1, h, 1.05, 0.85, 0.85);
    }
    const hair = o.hair ?? (o.beard !== undefined ? o.beard : undefined);
    if (hair !== undefined) {
      const hatted = o.hat === 'cap' || o.hat === 'straw';
      // Under a hat the hair shows as a fringe round the back and sides; without one it covers the crown.
      const g = new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * (hatted ? 0.6 : 0.56));
      const top = part(g, hair, 0, 0.275, -0.012, h);
      top.rotation.x = hatted ? -0.8 : -0.18;
      top.scale.set(1.02, 0.96, 0.98);
    }
  }

  private buildHat(o: FigureOpts): void {
    const h = this.head;
    const hc = o.hatColor ?? 0xf0cf62;
    if (o.hat === 'straw') {
      part(new THREE.CylinderGeometry(0.5, 0.54, 0.045, 24), hc, 0, 0.46, 0, h);
      part(new THREE.CylinderGeometry(0.22, 0.29, 0.2, 18), hc, 0, 0.57, 0, h);
      part(new THREE.CylinderGeometry(0.297, 0.3, 0.06, 18), 0xd6453a, 0, 0.5, 0, h, false);
    } else if (o.hat === 'cap') {
      part(new THREE.SphereGeometry(0.305, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 0.31, 0, h).scale.set(1, 0.9, 1);
      const visor = part(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16, 1, false, -Math.PI / 2, Math.PI), hc, 0, 0.32, 0.2, h);
      visor.rotation.y = Math.PI / 2;
      ball(0.035, hc, 0, 0.59, 0, h);
    }
  }

  private buildLimbs(o: FigureOpts, skin: number): void {
    const boots = o.boots ?? 0x4a3a2c;
    // arms: shoulder -> upper arm -> elbow -> forearm + mitten hand
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const sh = this.arm[i];
      sh.position.set(s * 0.36, 0.56, 0);
      this.torso.add(sh);
      ball(0.1, o.shirt, 0, 0, 0, sh);
      cap(0.085, 0.18, o.shirt, 0, -0.15, 0, sh);
      const el = this.elbow[i];
      el.position.y = -0.31;
      sh.add(el);
      cap(0.078, 0.16, o.shirt, 0, -0.12, 0, el);
      slab(0.18, 0.05, 0.18, new THREE.Color(o.shirt).multiplyScalar(0.8).getHex(), 0, -0.22, 0, el); // cuff
      ball(0.095, skin, 0, -0.3, 0, el);
      ball(0.04, skin, -s * 0.06, -0.28, 0.06, el, 1, 1, 1, false);                // thumb
      if (i === 1) { this.hand.position.set(0, -0.3, 0); el.add(this.hand); }
    }
    // legs: thigh -> knee -> shin + rounded boot
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const lg = this.leg[i];
      lg.position.set(s * 0.13, -0.02, 0);
      this.hips.add(lg);
      cap(0.105, 0.18, o.pants, 0, -0.18, 0, lg);
      const kn = this.knee[i];
      kn.position.y = -0.36;
      lg.add(kn);
      cap(0.095, 0.16, o.pants, 0, -0.15, 0, kn);
      cap(0.105, 0.06, boots, 0, -0.27, 0, kn);                                    // boot shaft
      const foot = cap(0.1, 0.14, boots, 0, -0.34, 0.06, kn);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.1, 1, 0.8);
    }
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
    this.amp += ((moving ? 1 : 0) - this.amp) * k(7);
    // Run blend: a stroll below ~2 m/s, a full run above ~4.5 m/s.
    const run = ease(Math.min(1, Math.max(0, (speed - RUN_FROM) / (RUN_FULL - RUN_FROM))));
    // The step cycle advances with distance covered, so feet match the ground instead of sliding.
    const stepLen = lerp(0.62, 1.12, run);
    if (moving) this.phase += (Math.PI * speed * dt) / stepLen;
    this.idle += dt;
    this.carry += (this.pose.carry - this.carry) * k(9);
    const fishing = this.pose.fish !== null;
    this.fishBlend += ((fishing ? 1 : 0) - this.fishBlend) * k(8);
    // Speeding up leans the body in; slowing down rocks it back.
    this.accel += ((speed - this.lastSpeed) / Math.max(dt, 1e-3) - this.accel) * k(6);
    this.lastSpeed = speed;
    const a = this.amp, ph = this.phase, s = Math.sin(ph), c = Math.cos(ph);
    const breath = Math.sin(this.idle * 1.9);
    const still = 1 - a;

    // legs: the thigh swings from the hip; the knee folds as the foot comes through and gives a little as it lands
    const stride = lerp(0.5, 0.82, run);
    for (let i = 0; i < 2; i++) {
      const p = ph + (i === 0 ? 0 : Math.PI);
      const sp = Math.sin(p), cp = Math.cos(p);
      const swing = Math.max(0, cp);                       // 0 while the foot is planted, up to 1 mid-swing
      const landing = Math.max(0, Math.sin(p - 0.5)) ** 3; // brief knee give just after the foot lands in front
      this.leg[i].rotation.x = (-sp * stride - 0.1 * run - swing * lerp(0.1, 0.3, run)) * a;
      this.leg[i].rotation.z = (i === 0 ? 1 : -1) * 0.03 * a;
      this.knee[i].rotation.x = (swing ** 0.8 * lerp(0.75, 1.5, run) + landing * 0.22) * a + 0.04 * still;
    }
    // body: drops as weight lands on a foot and rises as it passes over; sways towards the standing leg
    const bob = lerp(0.03, 0.075, run);
    this.hips.position.y = 0.6 - 0.03 * a - bob * Math.abs(s) * a + bob * 0.5 * a + breath * 0.004 * still;
    this.hips.position.x = -0.035 * c * a * (1 - run * 0.5);
    this.hips.rotation.y = -0.16 * s * a;
    this.hips.rotation.z = 0.05 * c * a + Math.sin(this.idle * 0.5) * 0.015 * still;
    const targetLean = (lerp(0.04, 0.24, run) + Math.max(-0.12, Math.min(0.16, this.accel * 0.012))) * a - 0.02 * this.carry;
    this.lean += (targetLean - this.lean) * k(8);
    this.torso.rotation.x = this.lean + 0.025 * Math.cos(ph * 2) * a;
    this.torso.rotation.y = lerp(0.22, 0.3, run) * s * a * (1 - this.carry * 0.7);
    this.torso.scale.y = 1 + breath * 0.012 * still;
    this.torso.rotation.z = -this.hips.rotation.z * 0.8;

    // arms: swing opposite the legs, a beat behind them; elbows hang loose at a walk and pump at a run
    const reach = lerp(0.5, 0.95, run);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const p = ph + (i === 0 ? 0 : Math.PI) - 0.25;
      const sw = Math.sin(p);
      let ax = (sw * reach + 0.08 * run) * a * (1 - this.carry) + breath * 0.03 * still;
      // The forearm folds more as the arm comes forward, and trails straighter behind.
      let ex = -(lerp(0.22, 1.25, run) + Math.max(0, -sw) * lerp(0.35, 0.45, run)) * a * (1 - this.carry) - 0.08 * still;
      let az = side * (0.07 + 0.03 * breath * still + 0.05 * run * a);
      // carrying: forearms forward, hugging the crates
      ax = lerp(ax, -1.15 + 0.04 * Math.sin(ph * 2) * a, this.carry);
      ex = lerp(ex, -0.55, this.carry);
      az = lerp(az, -side * 0.22, this.carry);
      this.arm[i].rotation.set(ax, 0, az);
      this.elbow[i].rotation.set(ex, 0, 0);
    }
    // The head stays level and faces forward while the shoulders twist beneath it.
    this.headSteady = -this.torso.rotation.y * 0.85;
    this.headNod = -0.03 * Math.cos(ph * 2) * a;

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
    this.head.rotation.set(this.pitch - this.lean * 0.6 + this.headNod + Math.sin(this.idle * 1.2) * 0.02 * still, this.yaw + this.headSteady + Math.sin(this.idle * 0.7) * 0.05 * still, -this.torso.rotation.z);
    this.blink -= dt;
    this.eyes.scale.y = this.blink > 0 && this.blink < 0.09 ? 0.12 : 1;
    if (this.blink < -3.5) this.blink = 0.1;
  }
}
