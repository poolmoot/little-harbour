import * as THREE from 'three';
import { LAYOUT, toWorld } from '../sim/config';
import { NPC_POSTS } from '../sim/layoutBoxes';
import type { Crate } from '../sim/state';
import { Figure, mat } from './figures';
import { NPC_TITLE, pickLine } from '../ui/text';
import type { LineContext, Role } from '../ui/text';
import { NPC_LOOK } from './people';
import type { World } from './world';
import { NO_HOOKS } from './townHooks';
import type { TownHooks } from './townHooks';
import { CARRY_SHARE, GULL_FLUSH_DIST, catRub, catWantsPlayer, friendlyShare, gullSettleDelay, gullTakeOffLevel } from './townRules';
import { townLook } from './people';
import { panFor } from '../audio/town';

interface Npc {
  role: Role;
  title: string;
  figure: Figure;
  x: number;
  z: number;
  el: HTMLDivElement;
  lineN: number;
  lineAt: number;
  lastKey: string;
  yaw: number;
  wasNear: boolean;
  waveUntil: number;
}

const angDiff = (a: number, b: number) => ((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const mesh = (g: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh => {
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent?.add(m);
  return m;
};
const ell = (rx: number, ry: number, rz: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh => {
  const m = mesh(new THREE.SphereGeometry(1, 10, 8), color, x, y, z, parent);
  m.scale.set(rx, ry, rz);
  return m;
};

type FigureLook = ConstructorParameters<typeof Figure>[0];

/** Townsfolk who stroll around the quay: outfits, and how briskly each one walks (m/s). */
const WALKERS: { look: FigureLook; pace: number }[] = [
  { look: { shirt: 0xe8c14a, pants: 0x5a4a6a, hair: 0x3a2a1a, scarf: 0x3f8fbf }, pace: 1.5 },
  { look: { shirt: 0xd9705a, pants: 0x3f4f5f, hat: 'cap', hatColor: 0x3f5f7f, hair: 0x8a5a2a, scale: 0.94 }, pace: 1.75 },
  { look: { shirt: 0x6fae7e, pants: 0x6a5238, overalls: 0x6a5238, hat: 'straw', hatColor: 0xe6d08a, beard: 0xd8d2c4, skin: 0xe8b890 }, pace: 1.15 },
  { look: { shirt: 0xb58ad6, pants: 0x4a4038, hair: 0xd9a03a, skin: 0xf2d2b4, scale: 0.9 }, pace: 1.6 },
];
/** Places people like to walk to: stalls, doors, the board, the pier head. */
const HAUNTS: [number, number][] = [
  ...[LAYOUT.market, LAYOUT.noticeBoard, LAYOUT.inn, LAYOUT.shipyard, LAYOUT.plots.coldstore, LAYOUT.plots.smokehouse, LAYOUT.plots.restaurant, LAYOUT.bellTower]
    .map((o) => { const p = toWorld(o, 0, 5.5); return [p.x, p.z] as [number, number]; }),
  [0, 4], [0, 2], [0, -3], [-1, -10], [1, -6], [-5, 8], [5, 8], [0, 12], [-7, 12], [7, 12], [0, 14],
];
const WALKER_RADIUS = 0.32;

/** A passer-by: picks somewhere to go, walks there round obstacles, stands a while looking about, then moves on. */
class Walker {
  private figure: Figure;
  private root = new THREE.Group();
  /** Fade in and out as the town gets busier or quieter: 0 hidden to 1 shown. */
  private shown = 0;
  private wanted = false;
  private friendly = friendlyShare(Math.random());
  private basket: THREE.Mesh | null = null;
  private parcel: THREE.Mesh | null = null;
  private x = 0;
  private z = 0;
  private tx = 0;
  private tz = 0;
  private heading = Math.random() * 6.28;
  private speed = 0;
  private pause = Math.random() * 4;
  private stuck = 0;
  private greeted = false;
  private waveUntil = -1;

  constructor(scene: THREE.Scene, private world: World, look: FigureLook, private pace: number, private hooks: TownHooks, carries = false) {
    this.figure = new Figure(look);
    this.root.add(this.figure.group);
    this.pickTarget();
    this.x = this.tx;
    this.z = this.tz;
    this.pickTarget();
    if (carries) {
      this.parcel = mesh(new THREE.BoxGeometry(0.34, 0.2, 0.26), 0xc9a06a, 0, 1.12, 0.46, this.figure.group);
      this.basket = mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.17, 10), 0xb88a4a, 0, 1.04, 0.44, this.figure.group);
      const wearBasket = Math.random() < 0.5;
      this.parcel.visible = !wearBasket;
      this.basket.visible = wearBasket;
      this.figure.pose.carry = 1;
      this.figure.pose.load = 1;
    }
    // background people leave out the shadow pass: it would double their draw calls (the harbour's named people and the player keep theirs)
    this.figure.group.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
    this.root.visible = false;
    this.root.scale.setScalar(0.001);
    scene.add(this.root);
  }

  /** Ask for this stroller to be out (or not). It fades in or out and only costs anything while visible. */
  setWanted(on: boolean): void {
    if (on && !this.wanted) {
      // come out somewhere not right next to the player
      this.pickTarget();
      this.x = this.tx; this.z = this.tz;
      this.pickTarget();
    }
    this.wanted = on;
  }
  get visible(): boolean { return this.root.visible; }

  private pickTarget(): void {
    for (let i = 0; i < 16; i++) {
      const haunt = HAUNTS[Math.floor(Math.random() * HAUNTS.length)];
      const anywhere = Math.random() < 0.35;
      const x = anywhere ? LAYOUT.square.cx + (Math.random() - 0.5) * 2 * 12 : haunt[0] + (Math.random() - 0.5) * 2.4;
      const z = anywhere ? LAYOUT.square.cz + (Math.random() - 0.5) * 2 * 7 : haunt[1] + (Math.random() - 0.5) * 2;
      if (this.world.walkable(x, z, WALKER_RADIUS + 0.1) && Math.hypot(x - this.x, z - this.z) > 3) {
        this.tx = x;
        this.tz = z;
        return;
      }
    }
  }

  update(dt: number, now: number, px: number, pz: number): void {
    this.shown += ((this.wanted ? 1 : 0) - this.shown) * Math.min(1, dt * 2.5);
    if (this.shown < 0.02 && !this.wanted) { this.root.visible = false; return; }
    this.root.visible = true;
    this.root.scale.setScalar(Math.max(0.001, this.shown < 0.98 ? this.shown : 1));
    const dx = this.tx - this.x, dz = this.tz - this.z;
    const d = Math.hypot(dx, dz);
    const toPlayer = Math.hypot(px - this.x, pz - this.z);
    const playerAngle = Math.atan2(px - this.x, pz - this.z);
    let want = 0;
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this.pickTarget();
    } else if (d < 0.35) {
      this.pause = 2 + Math.random() * 6;
    } else if (!(toPlayer < 1.1 && Math.abs(angDiff(playerAngle, this.heading)) < 1)) {
      want = this.pace; // keep walking unless the player is standing right in the way
    }
    this.speed += (want - this.speed) * Math.min(1, dt * 4);
    if (this.speed > 0.05 && d > 0.01) {
      this.heading += angDiff(Math.atan2(dx, dz), this.heading) * Math.min(1, dt * 5);
      // Walk the way the body faces, so turns are arcs and not sidesteps.
      const step = this.speed * dt;
      const r = this.world.resolve(this.x, this.z, this.x + Math.sin(this.heading) * step, this.z + Math.cos(this.heading) * step, WALKER_RADIUS);
      const moved = Math.hypot(r.x - this.x, r.z - this.z);
      this.x = r.x;
      this.z = r.z;
      // Blocked by a wall or a crate stack for a moment: give up on this spot and choose another.
      this.stuck = moved < step * 0.4 && want > 0 ? this.stuck + dt : 0;
      if (this.stuck > 0.8) { this.stuck = 0; this.pickTarget(); }
    }
    // Notice the player: glance over, and wave once each time they come close.
    const near = toPlayer < 3.2;
    if (near && !this.greeted && this.friendly && !this.parcel) {
      this.waveUntil = now + 1.6;
      this.hooks.wave(Math.max(0.3, 1 - toPlayer / 5), panFor(px, this.x));
    }
    this.greeted = near;
    this.figure.pose.wave = now < this.waveUntil && this.speed < 0.6;
    if (toPlayer < 5) this.figure.look(angDiff(playerAngle, this.heading) * 0.9, -0.05);
    else this.figure.look(this.pause > 0 ? Math.sin(now * 0.6 + this.tx) * 0.7 : 0, 0);
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.heading;
    this.figure.update(dt, this.speed);
  }
}

class Cat {
  group = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private tail: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  x = toWorld(LAYOUT.market, 1.6, 4.0).x;
  z = toWorld(LAYOUT.market, 1.6, 4.0).z;
  private mode: 'sit' | 'wander' | 'home' | 'greet' | 'rub' = 'sit';
  private sinceGreet = 20;
  private rubT = 0;
  private rubFor = 0;
  private sideVel = 0;
  private lastSide = 0;
  private timer = 6;
  private tx = this.x;
  private tz = this.z;
  private walk = 0;
  private heading = 0;
  private sitAmt = 1;
  private flick = 0;
  private t = 0;

  constructor(scene: THREE.Scene, private world: World, private hooks: TownHooks) {
    const orange = 0xd9923f, dark = 0xb5732a, cream = 0xf3dcb4;
    this.group.add(this.body);
    ell(0.15, 0.14, 0.3, orange, 0, 0.3, 0, this.body);
    ell(0.1, 0.09, 0.12, cream, 0, 0.26, 0.2, this.body);
    for (let s = -1; s <= 1; s += 2) ell(0.035, 0.12, 0.2, dark, s * 0.07, 0.34, 0, this.body); // stripes
    this.body.add(this.head);
    this.head.position.set(0, 0.42, 0.3);
    ell(0.13, 0.12, 0.12, orange, 0, 0, 0, this.head);
    ell(0.07, 0.05, 0.06, cream, 0, -0.04, 0.09, this.head);
    mesh(new THREE.SphereGeometry(0.02, 6, 5), 0xe08a8a, 0, -0.01, 0.15, this.head);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), dark, s * 0.075, 0.13, 0, this.head);
      ear.rotation.z = -s * 0.2;
      mesh(new THREE.SphereGeometry(0.018, 6, 5), 0x2a2a1a, s * 0.055, 0.02, 0.105, this.head);
    }
    // tail: chain of segments
    let parent: THREE.Object3D = this.body;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.32 : 0, i === 0 ? -0.27 : -0.09);
      mesh(new THREE.CapsuleGeometry(0.03 - i * 0.002, 0.08, 3, 6), i === 4 ? cream : orange, 0, 0, -0.045, seg).rotation.x = Math.PI / 2;
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    for (const [lx, lz] of [[-0.08, 0.2], [0.08, 0.2], [-0.09, -0.18], [0.09, -0.18]] as const) {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.22, lz);
      mesh(new THREE.CapsuleGeometry(0.035, 0.12, 3, 6), orange, 0, -0.1, 0, leg);
      mesh(new THREE.SphereGeometry(0.04, 6, 5), cream, 0, -0.2, 0.015, leg);
      this.group.add(leg);
      this.legs.push(leg);
    }
    this.group.traverse((o) => { (o as THREE.Mesh).castShadow = false; });   // a cat is too small to need a shadow, and each part costs a draw call twice over
    scene.add(this.group);
  }

  private pickWander(): void {
    for (let i = 0; i < 12; i++) {
      const home = toWorld(LAYOUT.market, 1.6, 4.0), x = home.x + (Math.random() - 0.5) * 12, z = home.z + (Math.random() - 0.5) * 8;
      if (this.world.walkable(x, z, 0.3)) {
        this.tx = x;
        this.tz = z;
        return;
      }
    }
  }

  update(dt: number, px: number, pz: number, carrying: boolean, facing = 0): void {
    this.t += dt;
    const home = toWorld(LAYOUT.market, 1.6, 4.0);
    const toPlayer = Math.hypot(px - this.x, pz - this.z);
    let speed = 0;
    this.sinceGreet += dt;
    if (carrying && (this.mode === 'greet' || this.mode === 'rub')) this.mode = 'wander';
    if (!carrying && this.mode !== 'greet' && this.mode !== 'rub'
      && catWantsPlayer(toPlayer, Math.hypot(px - home.x, pz - home.z) < 7, false, this.sinceGreet)) {
      this.mode = 'greet';
    }
    let rubbing = false;
    if (this.mode === 'greet') {
      // trot over to the player
      this.tx = px; this.tz = pz;
      speed = toPlayer > 5 ? 3.4 : 2.4;
      if (toPlayer < 0.9) { this.mode = 'rub'; this.rubT = 0; this.rubFor = 5 + Math.random() * 3; this.hooks.catPurr(2.4); }
      else if (toPlayer > 10) { this.mode = 'home'; this.sinceGreet = 0; }
    } else if (this.mode === 'rub') {
      // wind round the player's legs in a slow figure of eight, purring
      this.rubT += dt;
      rubbing = true;
      if (Math.floor((this.rubT - dt) / 2.6) !== Math.floor(this.rubT / 2.6)) this.hooks.catPurr(2.4);
      const { side, ahead } = catRub(this.rubT), sf = Math.sin(facing), cf = Math.cos(facing);
      const gx = px + sf * ahead + cf * side, gz = pz + cf * ahead - sf * side;
      const nx = this.x + (gx - this.x) * Math.min(1, dt * 7), nz = this.z + (gz - this.z) * Math.min(1, dt * 7);
      this.sideVel = (side - this.lastSide) / Math.max(dt, 1e-3);
      this.lastSide = side;
      const r = this.world.resolve(this.x, this.z, nx, nz, 0.2);
      this.x = r.x; this.z = r.z;
      this.heading += angDiff(Math.atan2(Math.sign(this.sideVel || 1) * cf, -Math.sign(this.sideVel || 1) * sf), this.heading) * Math.min(1, dt * 5);
      this.walk += dt * 3;
      if (toPlayer > 3 || this.rubT > this.rubFor) { this.mode = 'home'; this.sinceGreet = 0; }
    } else if (carrying) {
      this.mode = 'wander';
      if (toPlayer > 1.6) {
        this.tx = px;
        this.tz = pz;
        speed = toPlayer > 6 ? 5.5 : 3.6;
      }
    } else {
      this.timer -= dt;
      if (this.mode === 'sit' && this.timer <= 0) {
        this.mode = 'wander';
        this.timer = 6 + Math.random() * 4;
        this.pickWander();
      } else if (this.mode === 'wander') {
        speed = 1.6;
        if (Math.hypot(this.tx - this.x, this.tz - this.z) < 0.4 || this.timer <= 0) {
          this.mode = 'home';
        }
      } else if (this.mode === 'home') {
        this.tx = home.x;
        this.tz = home.z;
        speed = 2.0;
        if (Math.hypot(home.x - this.x, home.z - this.z) < 0.35) {
          this.mode = 'sit';
          this.timer = 8 + Math.random() * 8;
        }
      }
    }
    const dx = this.tx - this.x, dz = this.tz - this.z;
    const d = Math.hypot(dx, dz);
    if (speed > 0 && d > 0.2) {
      const r = this.world.resolve(this.x, this.z, this.x + (dx / d) * speed * dt, this.z + (dz / d) * speed * dt, 0.25);
      this.x = r.x;
      this.z = r.z;
      this.heading += angDiff(Math.atan2(dx, dz), this.heading) * Math.min(1, dt * 10);
      this.walk += dt * speed * 5;
    }
    const sitting = speed === 0 && !carrying && !rubbing;
    this.sitAmt += ((sitting ? 1 : 0) - this.sitAmt) * Math.min(1, dt * 5);
    const sa = this.sitAmt, run = Math.min(1, speed / 3);
    this.body.rotation.x = -0.75 * sa;
    this.body.rotation.z += ((rubbing ? Math.max(-0.35, Math.min(0.35, -this.sideVel * 0.3)) : 0) - this.body.rotation.z) * Math.min(1, dt * 8);
    this.body.position.set(0, -0.02 * sa + Math.abs(Math.sin(this.walk)) * 0.035 * (1 - sa), -0.05 * sa);
    // legs: diagonal gait; front legs straight when sitting, hind legs tucked
    this.legs.forEach((l, i) => {
      const front = i < 2;
      const swing = Math.sin(this.walk + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 * (1 - sa) * (0.6 + 0.4 * run);
      l.rotation.x = swing;
      if (!front) { l.position.y = 0.22 - 0.05 * sa; l.rotation.x = swing + sa * 1.3; }
    });
    // tail: lazy sway; flick every few seconds while sitting
    this.flick = Math.max(0, this.flick - dt);
    if (sitting && this.flick <= 0 && Math.random() < dt * 0.25) this.flick = 0.7;
    const fl = this.flick > 0 ? Math.sin(this.flick * 22) * 0.9 : 0;
    this.tail.forEach((seg, i) => {
      const base = sa * 0.28;
      seg.rotation.y = Math.sin(this.t * 1.6 + i * 0.7) * (0.12 + 0.1 * run) + base + fl * 0.3;
      seg.rotation.x = -0.25 * (1 - sa) * (i > 0 ? 1 : 0.4) + (sitting ? 0.1 : 0) - (rubbing ? 0.55 : 0);
    });
    // head: looks at the player when close
    const toP = angDiff(Math.atan2(px - this.x, pz - this.z), this.heading);
    this.head.rotation.y += ((toPlayer < 5 ? Math.max(-0.8, Math.min(0.8, toP)) : 0) - this.head.rotation.y) * Math.min(1, dt * 6);
    this.head.rotation.x = 0.75 * sa + (sitting ? Math.sin(this.t * 0.8) * 0.03 : 0);
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }
}

/** Gulls on the wing stay at least this far from the camera (the player is about 20 away). */
const KEEP_OFF = 16;

class Gull {
  group = new THREE.Group();
  private wing: { sh: THREE.Group; el: THREE.Group }[] = [];
  private legs: THREE.Object3D[] = [];
  pos = new THREE.Vector3();
  mode: 'circle' | 'landing' | 'perched' | 'rising' = 'circle';
  /** A spot on the ground this gull likes to stand on (the first gull lands on dock crates instead). */
  home: THREE.Vector3 | null = null;
  /** Set for one frame when the player walked into this gull and it took off. */
  flushed = false;
  private heading = 0;
  private bank = 0;
  private pitch = 0;
  private landWait = 0;
  private flapAmt = 1;
  private prev = new THREE.Vector3();

  constructor(scene: THREE.Scene, public idx: number) {
    const white = 0xf6f6f2, grey = 0x9aa4ae;
    ell(0.12, 0.1, 0.3, white, 0, 0.12, 0, this.group);
    ell(0.075, 0.075, 0.08, white, 0, 0.2, 0.3, this.group);
    mesh(new THREE.ConeGeometry(0.025, 0.12, 5), 0xf0a030, 0, 0.19, 0.4, this.group).rotation.x = Math.PI / 2;
    ell(0.07, 0.025, 0.14, grey, 0, 0.14, -0.34, this.group);
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.1, 0.18, 0.02);
      const el = new THREE.Group();
      el.position.x = s * 0.4;
      mesh(new THREE.BoxGeometry(0.42, 0.018, 0.3), white, s * 0.2, 0, 0, sh).castShadow = false;
      mesh(new THREE.BoxGeometry(0.4, 0.016, 0.22), grey, s * 0.2, 0, -0.02, el).castShadow = false;
      sh.add(el);
      this.group.add(sh);
      this.wing.push({ sh, el });
      const leg = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 4), 0xf0a030, s * 0.04, 0.0, 0.02, this.group);
      leg.castShadow = false;
      this.legs.push(leg);
    }
    this.group.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
    scene.add(this.group);
    this.pos.copy(this.circlePoint(0));
    this.prev.copy(this.pos);
  }

  /** Start standing at a spot, as if it had been there all along. */
  perchAt(v: THREE.Vector3): void {
    this.home = v.clone();
    this.pos.copy(v);
    this.prev.copy(v);
    this.mode = 'perched';
    this.group.position.copy(v);
  }

  private circle = new THREE.Vector3();
  private step = new THREE.Vector3();
  /** Where this gull should be on its lazy circle over the pier. The circle bends around the camera
   *  (which hangs above and behind the player), so a gull never fills the screen as a white-and-grey blur. */
  circlePoint(t: number, cam: THREE.Vector3 | null = null): THREE.Vector3 {
    const dir = this.idx % 2 ? -1 : 1;
    const a = t * 0.45 * dir + this.idx * 1.7;
    const r = 7 + this.idx * 1.6;
    const p = this.circle.set(Math.cos(a) * r, 8 + (this.idx % 3) * 1.2 + Math.sin(t + this.idx) * 0.4, -11 + Math.sin(a) * r * 0.8);
    if (cam) {
      // Slide the point level out to sea until it is KEEP_OFF from the camera.
      const dy = p.y - cam.y;
      if (Math.abs(dy) < KEEP_OFF) {
        const need = Math.sqrt(KEEP_OFF * KEEP_OFF - dy * dy);
        const dx = p.x - cam.x, dz = p.z - cam.z;
        const d = Math.hypot(dx, dz);
        if (d < need) {
          if (d > 0.01) { p.x = cam.x + (dx / d) * need; p.z = cam.z + (dz / d) * need; } else p.z = cam.z - need;
        }
      }
    }
    return p;
  }

  update(dt: number, t: number, landing: THREE.Vector3 | null, playerNear: boolean, cam: THREE.Vector3): void {
    const circle = this.circlePoint(t, cam);
    if (this.mode === 'circle' && landing && (this.idx === 0 || this.home)) {
      this.landWait += dt;
      if (this.landWait > 3) this.mode = 'landing';
    } else if (this.mode !== 'perched' && this.mode !== 'landing') this.landWait = 0;
    if ((this.mode === 'landing' || this.mode === 'perched') && (!landing || playerNear)) {
      if (playerNear) this.flushed = true;
      this.mode = 'rising';
    }
    let target = circle;
    let speed = 6;
    if (this.mode === 'landing' && landing) {
      target = landing;
      speed = 5;
      if (this.pos.distanceTo(landing) < 0.15) this.mode = 'perched';
    } else if (this.mode === 'perched') {
      target = this.pos;
    } else if (this.mode === 'rising') {
      speed = 7;
      if (this.pos.distanceTo(circle) < 1.5) this.mode = 'circle';
    }
    this.prev.copy(this.pos);
    const oldHeading = this.heading;
    if (this.mode === 'circle') {
      this.pos.lerp(circle, Math.min(1, dt * 8));
      const vx = this.pos.x - this.prev.x, vz = this.pos.z - this.prev.z;
      if (vx * vx + vz * vz > 1e-6) this.heading = Math.atan2(vx, vz);
    } else if (this.mode !== 'perched') {
      const v = this.step.copy(target).sub(this.pos);
      const d = v.length();
      if (d > 0.01) {
        this.pos.addScaledVector(v, Math.min(d, speed * dt) / d);
        this.heading = Math.atan2(v.x, v.z);
      }
    }
    const perched = this.mode === 'perched';
    const landingNow = this.mode === 'landing' && this.pos.distanceTo(target) < 2.5;
    // flap in bursts, glide in between; flap hard when landing / rising
    const burst = Math.sin(t * 0.7 + this.idx * 2.1);
    const flapTarget = perched ? 0 : landingNow || this.mode === 'rising' ? 1 : burst > -0.15 ? 0.8 : 0.0;
    this.flapAmt += (flapTarget - this.flapAmt) * Math.min(1, dt * 4);
    const f = Math.sin(t * 11 + this.idx * 2);
    const vy = dt > 0 ? (this.pos.y - this.prev.y) / dt : 0;
    this.pitch += (Math.max(-0.5, Math.min(0.5, -vy * 0.08)) - this.pitch) * Math.min(1, dt * 4);
    const dh = angDiff(this.heading, oldHeading) / Math.max(dt, 1e-3);
    this.bank += (Math.max(-0.5, Math.min(0.5, dh * 0.35)) - this.bank) * Math.min(1, dt * 4);
    this.wing.forEach((w, i) => {
      const s = i === 0 ? -1 : 1;
      if (perched) {
        w.sh.rotation.z = -s * -0.2; w.sh.rotation.y = s * 0.15;
        w.el.rotation.z = s * 0.55; w.el.rotation.y = 0;
        w.sh.rotation.x = 0;
        w.sh.rotation.z = s * -0.15;
      } else {
        const lift = f * 0.6 * this.flapAmt + 0.08;
        w.sh.rotation.set(0, 0, s * lift);
        w.el.rotation.z = s * (f * 0.45 * this.flapAmt - 0.08 + (landingNow ? 0.35 : 0));
        w.sh.rotation.y = 0;
      }
    });
    this.legs.forEach((l) => { l.visible = perched || landingNow; });
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, this.heading, this.bank, 'YXZ');
  }
}

/** Where the three ground gulls stand until someone walks into them. */
const GULL_HOMES: [number, number][] = [[-4, 17], [4, 18], [-8, 22]];
/** The most extra strollers there ever are (on top of the four who always walk). */
export const MAX_EXTRA_STROLLERS = 4;

export class Life {
  private npcs: Npc[] = [];
  private cat: Cat;
  private walkers: Walker[] = [];
  private extras: Walker[] = [];
  private gulls: Gull[] = [];
  private settleAt = [0, 0, 0, 0];
  /** Which way the player faces (the cat winds round their legs in front of them). Set by the town-life code each frame. */
  playerFacing = 0;
  private tmp = new THREE.Vector3();
  private landing = new THREE.Vector3();

  constructor(scene: THREE.Scene, world: World, private camera: THREE.Camera, uiRoot: HTMLElement, private hooks: TownHooks = NO_HOOKS) {
    const defs: { role: Role; title: string; name: string; x: number; z: number; fig: ConstructorParameters<typeof Figure>[0] }[] = [
      { role: 'fishmonger', title: NPC_TITLE.fishmonger, name: 'Greta', ...NPC_POSTS.fishmonger, fig: NPC_LOOK.fishmonger },
      { role: 'shipwright', title: NPC_TITLE.shipwright, name: 'Osric', ...NPC_POSTS.shipwright, fig: NPC_LOOK.shipwright },
      { role: 'innkeeper', title: NPC_TITLE.innkeeper, name: 'Bram', ...NPC_POSTS.innkeeper, fig: NPC_LOOK.innkeeper },
    ];
    for (const d of defs) {
      const figure = new Figure(d.fig);
      figure.group.position.set(d.x, 0, d.z);
      figure.group.traverse((o) => { (o as THREE.Mesh).castShadow = false; });   // the shadow pass would double the draw calls of every figure
      scene.add(figure.group);
      const el = document.createElement('div');
      el.className = 'bubble';
      uiRoot.appendChild(el);
      this.npcs.push({ role: d.role, title: d.title, figure, x: d.x, z: d.z, el, lineN: Math.floor(Math.random() * 5), lineAt: -99, lastKey: '', yaw: 0, wasNear: false, waveUntil: 0 });
    }
    this.cat = new Cat(scene, world, hooks);
    for (const w of WALKERS) {
      const wk = new Walker(scene, world, w.look, w.pace, hooks);
      wk.setWanted(true);
      this.walkers.push(wk);
    }
    // more people stroll as the harbour grows; some carry a basket or a parcel of fish
    for (let i = 0; i < MAX_EXTRA_STROLLERS; i++) {
      this.extras.push(new Walker(scene, world, townLook(40 + i), 1.1 + ((i * 37) % 10) / 14, hooks, Math.random() < CARRY_SHARE));
    }
    for (let i = 0; i < 4; i++) this.gulls.push(new Gull(scene, i));
    GULL_HOMES.forEach(([x0, z0], i) => {
      // nearest free cobbles to the wanted spot, so a moved building never leaves a gull inside a wall
      let x = x0, z = z0;
      for (let k = 0; k < 24 && !world.walkable(x, z, 0.5); k++) { x = x0 + Math.cos(k * 2.4) * k * 0.3; z = z0 + Math.sin(k * 2.4) * k * 0.3; }
      this.gulls[i + 1].perchAt(new THREE.Vector3(x, 0.1, z));
    });
  }

  /** How many of the extra strollers are out (0 to MAX_EXTRA_STROLLERS). */
  setStrollers(n: number): void {
    this.extras.forEach((w, i) => w.setWanted(i < n));
  }

  update(dt: number, now: number, player: { x: number; z: number }, ctx: LineContext, dockCrates: Crate[], hidden: boolean): void {
    const w = window.innerWidth, h = window.innerHeight;
    for (const n of this.npcs) {
      const dx = player.x - n.x, dz = player.z - n.z;
      const dist = Math.hypot(dx, dz);
      const near = dist < 5.5 && !hidden;
      const watch = dist < 8 && !hidden;
      const want = Math.atan2(dx, dz);
      const rel = angDiff(want, n.yaw);
      // head turns first; the body follows once the head is turned far enough
      if (watch) {
        n.figure.look(rel * 0.95, -0.05);
        if (Math.abs(rel) > 0.7) n.yaw += angDiff(want, n.yaw) * Math.min(1, dt * 2.5);
      } else {
        n.figure.look(Math.sin(now * 0.3 + n.x) * 0.35, 0);
        n.yaw += angDiff(0, n.yaw) * Math.min(1, dt * 1.2);
      }
      if (near && !n.wasNear) n.waveUntil = now + 2.2;
      n.wasNear = near;
      n.figure.pose.wave = now < n.waveUntil;
      n.figure.group.rotation.y = n.yaw;
      n.figure.update(dt, 0);
      if (near) {
        const key = `${ctx.phase}|${ctx.recentFilled}|${ctx.recentMissed}|${ctx.handSpecies.length}|${ctx.boatsOut}`;
        if (key !== n.lastKey || now - n.lineAt > 9) {
          if (key === n.lastKey) n.lineN++;
          n.lastKey = key;
          n.lineAt = now;
          n.el.innerHTML = `<b>${n.title}</b><span>${pickLine(n.role, ctx, n.lineN)}</span>`;
        }
        this.tmp.set(n.x, 2.5, n.z).project(this.camera);
        n.el.style.display = 'block';
        n.el.style.left = `${(this.tmp.x * 0.5 + 0.5) * w}px`;
        n.el.style.top = `${(-this.tmp.y * 0.5 + 0.5) * h}px`;
      } else {
        n.el.style.display = 'none';
      }
    }
    this.cat.update(dt, player.x, player.z, ctx.handSpecies.length > 0, this.playerFacing);
    for (const wk of this.walkers) wk.update(dt, now, player.x, player.z);
    for (const wk of this.extras) wk.update(dt, now, player.x, player.z);
    const fresh = dockCrates.find((c) => c.freshness > 0);
    const land = fresh ? this.landing.set(fresh.x ?? 0, 0.46 + (fresh.layer ?? 0) * 0.42, fresh.z ?? 0) : null;
    for (const g of this.gulls) {
      const dist = Math.hypot(player.x - g.pos.x, player.z - g.pos.z);
      const spot = g.idx === 0 ? land : now >= this.settleAt[g.idx] ? g.home : null;
      g.update(dt, now, spot, dist < GULL_FLUSH_DIST && g.mode === 'perched', this.camera.position);
      if (g.flushed) {
        g.flushed = false;
        if (g.idx > 0) this.settleAt[g.idx] = now + gullSettleDelay(Math.random());
        this.hooks.gullsTakeOff(gullTakeOffLevel(dist));
      }
    }
  }
}
