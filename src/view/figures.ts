import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flat } from './kit';
import { HIP_X, HIP_DROP, REST_HIPS, advance, gaitFor, footPath, hipsHeight, lerp, moveBlend, reachLimit, smooth, solveLeg, wrap01, type Foot, type Gait, type LegAngles } from './gait';

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
  /** How many crates are in the hands (heavier steps for a bigger load). */
  load: number;
  /** Sitting on a chair: thighs forward, knees bent, now and then a hand to the mouth or a small gesture. */
  sit: boolean;
  /** Clapping: both hands together in front of the chest. */
  clap: boolean;
}

const ease = smooth;
const TAU = Math.PI * 2;
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
// Scratch values for the gait maths, so nothing is allocated while the figures move.
const GAIT: Gait = { run: 0, stepLen: 0.6, duty: 0.6, lift: 0.07, crouch: 0.03, walkBob: 0.05, runBob: 0.05 };
/** Hips height (rig units) when sitting: the boots rest on the ground and the thighs slope a little down to the knees. */
export const SIT_HIPS = 0.545;
const SIT_THIGH = 1.2, SIT_KNEE = 0.72;
const F0: Foot = { z: 0, y: 0 }, F1: Foot = { z: 0, y: 0 }, LEG: LegAngles = { hip: 0, knee: 0 };

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

/** One material draws every figure: each part's colour is stored in its vertices. */
const BODY = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP });

/**
 * Fuse the many small parts hanging off each joint into one coloured mesh plus one outline mesh per joint.
 * A figure is then about two dozen draw calls instead of nearly a hundred, with no change to how it looks or moves.
 */
function fuse(root: THREE.Object3D): void {
  const joints: THREE.Object3D[] = [];
  root.traverse((o) => joints.push(o));
  for (const joint of joints) {
    const parts = joint.children.filter((c) => (c as Part).isMesh) as Part[];
    if (!parts.length) continue;
    const all: THREE.BufferGeometry[] = [], inked: THREE.BufferGeometry[] = [];
    for (const m of parts) {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.deleteAttribute('uv');
      g.applyMatrix4(m.matrix);
      const c = (m.material as THREE.MeshToonMaterial).color, n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      all.push(g);
      if (m.userData.outline) inked.push(g);
      joint.remove(m);
      m.geometry.dispose();
    }
    const body = new THREE.Mesh(mergeGeometries(all), BODY);
    body.castShadow = true;
    joint.add(body);
    if (inked.length) joint.add(new THREE.Mesh(mergeGeometries(inked), OUTLINE));
  }
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
  /** Where in the stride cycle the body is (0 to 1; one cycle is two steps). */
  private phase = Math.random();
  private amp = 0;
  private heft = 0;
  private waveBlend = 0;
  /** Small per-person differences so a crowd does not march in step. */
  private cadence = 0.92 + Math.random() * 0.16;
  private armSwing = 0.8 + Math.random() * 0.4;
  private swayVar = 0.85 + Math.random() * 0.3;
  private shift = 0;
  private shiftGoal = 0;
  private shiftIn = 3 + Math.random() * 5;
  private glance = 0;
  private glanceGoal = 0;
  private glanceIn = 4 + Math.random() * 6;
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
  /** True for the frame in which a boot lands. */
  landed = false;
  pose: Pose = { carry: 0, fish: null, wave: false, load: 0, sit: false, clap: false };
  private sitBlend = 0;
  private clapBlend = 0;

  constructor(o: FigureOpts) {
    const skin = o.skin ?? 0xf6c9a0;
    this.group.add(this.hips);
    this.hips.position.y = REST_HIPS;
    this.hips.add(this.torso);
    this.buildBody(o);
    this.buildHead(o, skin);
    this.buildHat(o);
    this.buildLimbs(o, skin);
    for (const l of this.leg) l.rotation.order = 'YXZ'; // swing the leg forwards and back, then keep its plane facing the way the body walks
    fuse(this.group);
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

  /** Height of the hips above the ground (rides up and down with the walk). */
  get hipsY(): number {
    return this.hips.position.y;
  }

  /** Where a foot's centre is in world space (used by the foot-slide check). */
  footWorld(i: 0 | 1, out: THREE.Vector3): THREE.Vector3 {
    return this.knee[i].localToWorld(out.set(0, -0.34, 0));
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
    const sc = this.group.scale.x || 1;
    const v = speed / sc; // the rig works in its own units
    const g = this.pose;

    // Blend weights: how much the legs are in their gait, how heavy the load is, and how far the arms are in a carry.
    this.amp += (moveBlend(v) - this.amp) * k(14);
    const a = this.amp, still = 1 - a;
    const heftGoal = g.carry > 0.5 ? clamp(0.3 + 0.23 * (g.load - 1), 0.3, 1) : 0;
    this.heft += (heftGoal - this.heft) * k(4);
    this.carry += (g.carry - this.carry) * k(9);
    const fishing = g.fish !== null;
    this.fishBlend += ((fishing ? 1 : 0) - this.fishBlend) * k(8);
    this.waveBlend += ((g.wave ? 1 : 0) - this.waveBlend) * k(10);
    this.idle += dt;
    // Speeding up leans the body in; slowing down rocks it back.
    this.accel += ((v - this.lastSpeed) / Math.max(dt, 1e-3) - this.accel) * k(6);
    this.lastSpeed = v;

    // The stride cycle advances with the distance covered and the step length, so the boots match the ground.
    const gait = gaitFor(v, this.cadence, this.heft, GAIT);
    const before = this.phase;
    if (v > 0.05) this.phase = advance(this.phase, v, dt, gait.stepLen);
    this.landed = a > 0.5 && Math.floor(this.phase * 2) !== Math.floor(before * 2);
    const run = gait.run, u0 = this.phase, u1 = wrap01(u0 + 0.5);
    const breath = Math.sin(this.idle * 1.9);

    // legs: each foot follows a planted-then-swinging path and the hip and knee angles are solved to reach it
    const c1 = Math.cos(TAU * u0);                                  // +1 right after the first foot lands in front
    const mid = Math.cos(TAU * (u0 - gait.duty * 0.5));              // +1 when the first foot is mid-stance
    const yawH = lerp(0.09, 0.12, run) * c1 * a;                    // hips twist forward on the side of the leading foot
    const sway = -0.032 * this.swayVar * (1 - run * 0.4) * mid * a;
    const roll = -0.045 * this.swayVar * mid * a;
    footPath(u0, gait, F0);
    footPath(u1, gait, F1);
    const hz0 = HIP_X * Math.sin(yawH), hz1 = -hz0;
    let hipY = Math.min(hipsHeight(u0, gait), reachLimit(F0, hz0), reachLimit(F1, hz1));
    hipY = lerp(REST_HIPS + breath * 0.004 * still, hipY, a);

    // idle weight shift: now and then settle onto one leg
    this.shiftIn -= dt;
    if (this.shiftIn <= 0) { this.shiftGoal = this.shiftGoal === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0; this.shiftIn = 3.5 + Math.random() * 5; }
    this.shift += (this.shiftGoal * still - this.shift) * k(2.2);
    const sh = this.shift;

    const hipX = sway + 0.022 * sh;
    const hipRoll = roll + 0.03 * sh + Math.sin(this.idle * 0.5) * 0.01 * still;
    this.hips.position.set(hipX, hipY - 0.004 * Math.abs(sh), 0);
    this.hips.rotation.set(0, yawH, hipRoll);
    for (let i = 0; i < 2; i++) {
      const f = i === 0 ? F0 : F1;
      solveLeg(f.z - (i === 0 ? hz0 : hz1), f.y - (hipY - HIP_DROP), LEG);
      // the leg that is not carrying the weight in an idle shift relaxes forward a little
      const free = Math.max(0, i === 0 ? sh : -sh);
      let hip = lerp(0.05 * free * -1, LEG.hip, a), knee = lerp(0.04 + 0.12 * free, LEG.knee, a);
      if (this.fishBlend > 0.01) { hip = lerp(hip, 0, this.fishBlend); knee = lerp(knee, 0.1, this.fishBlend); }
      this.leg[i].rotation.set(hip, -yawH, this.footPlant(hipRoll, hipX));
      this.knee[i].rotation.x = knee;
    }

    // body: shoulders turn against the hips, a forward lean that grows with speed, breathing when still
    const heftBack = 0.05 * this.heft;
    const targetLean = (lerp(0.05, 0.24, run) + clamp(this.accel * 0.012, -0.12, 0.16)) * a - 0.02 * this.carry - heftBack * a;
    this.lean += (targetLean - this.lean) * k(8);
    const shoulders = -lerp(0.11, 0.19, run) * c1 * a * (1 - this.carry * 0.6);
    this.torso.rotation.set(this.lean + 0.02 * Math.cos(TAU * 2 * u0) * a, shoulders - yawH, -hipRoll * 0.8);
    this.torso.scale.y = 1 + breath * 0.012 * still;

    // arms: opposite the legs and a beat behind them; the forearm trails, folding more on the back swing
    const reach = lerp(0.5, 0.95, run) * this.armSwing * (1 - 0.3 * this.heft);
    const flexBase = lerp(0.3, 1.25, run), flexExtra = lerp(0.4, 0.3, run);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const th = TAU * (i === 0 ? u0 : u1) - 0.35;
      let ax = (reach * Math.cos(th) + 0.08 * run) * a + breath * 0.03 * still;
      let ex = -(flexBase + flexExtra * 0.5 * (1 - Math.sin(th))) * a - 0.1 * still;
      let az = side * (0.07 + 0.03 * breath * still + 0.05 * run * a);
      // carrying: forearms forward, hugging the crates; a bigger load pulls the elbows in and the arms lower
      ax = lerp(ax, -1.15 + 0.04 * Math.sin(TAU * 2 * u0) * a + 0.08 * this.heft, this.carry);
      ex = lerp(ex, -0.55 - 0.2 * this.heft, this.carry);
      az = lerp(az, -side * (0.22 + 0.05 * this.heft), this.carry);
      this.arm[i].rotation.set(ax, 0, az);
      this.elbow[i].rotation.set(ex, 0, 0);
    }
    // The head stays level and faces forward while the shoulders twist beneath it.
    this.headSteady = -(this.torso.rotation.y + yawH) * 0.85;
    this.headNod = -0.025 * Math.cos(TAU * 2 * u0) * a;

    // wave hello (blended in and out, not snapped)
    if (this.waveBlend > 0.01) {
      const w = this.waveBlend, r = this.arm[1].rotation, e = this.elbow[1].rotation;
      r.set(lerp(r.x, -2.7, w), 0, lerp(r.z, 0.35, w));
      e.x = lerp(e.x, -0.5 + Math.sin(this.idle * 9) * 0.35, w);
    }

    // clapping: both hands meet in front of the chest, again and again
    this.clapBlend += ((g.clap ? 1 : 0) - this.clapBlend) * k(10);
    if (this.clapBlend > 0.01) {
      const c = this.clapBlend, hit = 0.5 + 0.5 * Math.sin(this.idle * 15 * this.cadence);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1, r = this.arm[i].rotation;
        r.set(lerp(r.x, -1.05, c), 0, lerp(r.z, -side * (0.08 + 0.24 * hit), c));
        this.elbow[i].rotation.x = lerp(this.elbow[i].rotation.x, -1.5, c);
      }
    }

    // fishing: cast swing, then hold the rod forward; jerk on a bite
    const f = g.fish;
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
    }

    this.sitBlend += ((g.sit ? 1 : 0) - this.sitBlend) * k(7);
    if (this.sitBlend > 0.01) this.applySit(this.sitBlend);

    // head: follows the look target; while standing it also glances about now and then; a slow idle bob and blinks
    this.glanceIn -= dt;
    if (this.glanceIn <= 0) {
      this.glanceGoal = this.glanceGoal === 0 ? (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.45) : 0;
      this.glanceIn = this.glanceGoal === 0 ? 3 + Math.random() * 6 : 1 + Math.random() * 1.6;
    }
    this.glance += (this.glanceGoal * still * (this.lookYaw === 0 ? 1 : 0) - this.glance) * k(3);
    this.yaw += (this.lookYaw - this.yaw) * k(7);
    this.pitch += (this.lookPitch - this.pitch) * k(7);
    this.head.rotation.set(
      this.pitch - this.lean * 0.6 + this.headNod + Math.sin(this.idle * 1.2) * 0.02 * still,
      this.yaw + this.glance + this.headSteady + Math.sin(this.idle * 0.7) * 0.05 * still * (1 - Math.abs(this.glance)),
      -(this.torso.rotation.z + hipRoll),
    );
    this.blink -= dt;
    this.eyes.scale.y = this.blink > 0 && this.blink < 0.09 ? 0.12 : 1;
    if (this.blink < -3.5) this.blink = 0.1;
  }

  /** Blend into a seated pose, with a slow cycle of eating, a small talking gesture and resting hands (each person on their own beat). */
  private applySit(s: number): void {
    const hp = this.hips.position, hr = this.hips.rotation;
    hp.set(lerp(hp.x, 0, s), lerp(hp.y, SIT_HIPS, s), 0);
    hr.set(0, lerp(hr.y, 0, s), lerp(hr.z, 0, s));
    for (let i = 0; i < 2; i++) {
      const lr = this.leg[i].rotation;
      lr.set(lerp(lr.x, -SIT_THIGH, s), lerp(lr.y, 0, s), lerp(lr.z, (i === 0 ? -1 : 1) * 0.05, s));
      this.knee[i].rotation.x = lerp(this.knee[i].rotation.x, SIT_KNEE, s);
    }
    const ph = (this.idle * 0.16 + this.swayVar * 7) % 1;
    const eat = ph < 0.5 ? 0.5 + 0.5 * Math.sin(this.idle * 2.6) : 0;
    const talk = ph >= 0.5 && ph < 0.8 ? 1 : 0;
    const tr = this.torso.rotation;
    tr.set(lerp(tr.x, 0.05 + 0.12 * eat, s), lerp(tr.y, 0, s), lerp(tr.z, 0, s));
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1, right = i === 1;
      let ax = -0.75, ex = -1.05, az = side * 0.1;
      if (right && eat > 0) { ax = lerp(-0.75, -1.5, eat); ex = lerp(-1.05, -2.2, eat); }
      if (right && talk) { ax = -1.05 + Math.sin(this.idle * 3.1) * 0.18; ex = -0.9 + Math.sin(this.idle * 4.7) * 0.35; az = 0.28; }
      const r = this.arm[i].rotation;
      r.set(lerp(r.x, ax, s), 0, lerp(r.z, az, s));
      this.elbow[i].rotation.x = lerp(this.elbow[i].rotation.x, ex, s);
    }
  }

  /** Leg sideways tilt that cancels the hips' sway and roll, so a planted boot stays where it landed. */
  private footPlant(roll: number, shift: number): number {
    return -(roll + shift / (0.34 + 0.36));
  }
}
