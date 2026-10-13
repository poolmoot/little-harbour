import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { Phase, Species } from '../sim/config';
import type { Crate } from '../sim/state';
import { Figure, box } from './figures';
import type { World } from './world';

export interface LineContext {
  phase: Phase;
  handSpecies: Species[];
  recentFilled: boolean;
  recentMissed: boolean;
  money: number;
  boatsOut: number;
  openOrders: number;
}

type Role = 'fishmonger' | 'shipwright' | 'innkeeper';

/** Pick a line that reacts to state. `n` rotates through the eligible lines. */
export function pickLine(role: Role, c: LineContext, n: number): string {
  const lines: string[] = [];
  const rare = c.handSpecies.some((s) => s === 'lobster' || s === 'snapper' || s === 'seabass');
  if (role === 'fishmonger') {
    if (rare) lines.push('Is that reef catch? Bring it over before it turns!');
    if (c.recentFilled) lines.push('That order made someone happy. Well done!');
    if (c.recentMissed) lines.push('Missed order? Fish spoils, and folk will not wait.');
    if (c.phase === 'night') lines.push('Market is shut up tight at night. Rest those legs.');
    if (c.phase === 'dawn' || c.phase === 'dusk') lines.push('Flounder run at dawn and dusk. Good money in them.');
    lines.push('Fresh fish sells best. Do not let it sit in the sun.', 'If I get too much of one fish, the price drops. Mix it up.');
  } else if (role === 'shipwright') {
    if (c.phase === 'night') lines.push('Cannot send boats in the dark. Come back at dawn.');
    if (c.boatsOut > 0) lines.push('Your boat is out there. Listen for the bell.');
    if (c.money >= 150) lines.push('I see coin in your pocket. Looking for a bigger hold?');
    lines.push('A bigger hold means more fish every trip.', 'With a reinforced hull you could try the reef.');
  } else {
    if (c.recentFilled) lines.push('Heard you filled that order. A round for the harbour!');
    if (c.recentMissed) lines.push('Pity about that order. There will be another.');
    if (c.openOrders > 0) lines.push('There are notices on the board. Folk pay double for the right fish.');
    if (c.phase === 'night') lines.push('Cosy in here after dark. Lanterns are lit on the quay.');
    if (c.phase === 'dawn') lines.push('Up with the gulls! Tea is on.');
    lines.push('Read the notice board before you pick a zone.');
  }
  return lines[n % lines.length];
}

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
}

class Cat {
  group = new THREE.Group();
  private body = new THREE.Group();
  private tail: THREE.Mesh;
  x = LAYOUT.market.x + 2.6;
  z = LAYOUT.market.z + 3;
  private mode: 'sit' | 'wander' | 'home' = 'sit';
  private timer = 6;
  private tx = this.x;
  private tz = this.z;
  private walk = 0;
  private heading = 0;

  constructor(scene: THREE.Scene, private world: World) {
    const orange = 0xd9923f;
    box(0.28, 0.26, 0.6, orange, 0, 0.3, 0, this.body);
    box(0.24, 0.22, 0.22, orange, 0, 0.5, 0.34, this.body);
    box(0.07, 0.1, 0.05, 0xb5732a, -0.08, 0.66, 0.34, this.body);
    box(0.07, 0.1, 0.05, 0xb5732a, 0.08, 0.66, 0.34, this.body);
    this.tail = box(0.07, 0.07, 0.4, 0xb5732a, 0, 0.35, -0.45, this.body);
    for (const [lx, lz] of [[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.2], [0.1, -0.2]] as const) box(0.07, 0.2, 0.07, 0xb5732a, lx, 0.1, lz, this.group);
    this.group.add(this.body);
    scene.add(this.group);
  }

  private pickWander(): void {
    for (let i = 0; i < 12; i++) {
      const x = LAYOUT.quayMinX + 3 + Math.random() * 38, z = 6 + Math.random() * 6;
      if (this.world.walkable(x, z, 0.3)) {
        this.tx = x;
        this.tz = z;
        return;
      }
    }
  }

  update(dt: number, px: number, pz: number, carrying: boolean): void {
    const home = { x: LAYOUT.market.x + 2.6, z: LAYOUT.market.z + 3 };
    const toPlayer = Math.hypot(px - this.x, pz - this.z);
    let speed = 0;
    if (carrying) {
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
      this.heading += (((Math.atan2(dx, dz) - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10);
      this.walk += dt * speed * 4;
    }
    const sitting = speed === 0 && !carrying;
    this.body.rotation.x += ((sitting ? -0.75 : 0) - this.body.rotation.x) * Math.min(1, dt * 6);
    this.body.position.y = sitting ? -0.02 : Math.abs(Math.sin(this.walk)) * 0.04;
    this.tail.rotation.y = Math.sin(this.walk * 0.5 + performance.now() / 700) * 0.4;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }
}

class Gull {
  group = new THREE.Group();
  private wingL = new THREE.Group();
  private wingR = new THREE.Group();
  pos = new THREE.Vector3();
  mode: 'circle' | 'landing' | 'perched' | 'rising' = 'circle';
  private heading = 0;
  private landWait = 0;

  constructor(scene: THREE.Scene, public idx: number) {
    box(0.3, 0.2, 0.6, 0xf4f4f0, 0, 0.1, 0, this.group);
    box(0.14, 0.14, 0.14, 0xf4f4f0, 0, 0.26, 0.3, this.group);
    box(0.05, 0.04, 0.14, 0xf0a030, 0, 0.25, 0.42, this.group);
    box(0.1, 0.06, 0.24, 0x9aa0a8, 0, 0.12, -0.38, this.group);
    for (const [w, s] of [[this.wingL, -1], [this.wingR, 1]] as const) {
      w.position.set(s * 0.15, 0.17, 0);
      box(0.7, 0.03, 0.32, 0xf4f4f0, s * 0.35, 0, 0, w);
      box(0.2, 0.03, 0.3, 0x6b7078, s * 0.78, 0, 0, w);
      this.group.add(w);
    }
    this.group.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
    scene.add(this.group);
    this.pos.copy(this.circlePoint(0));
  }

  circlePoint(t: number): THREE.Vector3 {
    const dir = this.idx % 2 ? -1 : 1;
    const a = t * 0.45 * dir + this.idx * 1.7;
    const r = 7 + this.idx * 1.6;
    return new THREE.Vector3(Math.cos(a) * r, 8 + (this.idx % 3) * 1.2 + Math.sin(t + this.idx) * 0.4, -11 + Math.sin(a) * r * 0.8);
  }

  update(dt: number, t: number, landing: THREE.Vector3 | null, playerNear: boolean): void {
    const circle = this.circlePoint(t);
    if (this.mode === 'circle' && landing && this.idx === 0) {
      this.landWait += dt;
      if (this.landWait > 3) this.mode = 'landing';
    } else if (this.mode !== 'perched' && this.mode !== 'landing') this.landWait = 0;
    if ((this.mode === 'landing' || this.mode === 'perched') && (!landing || playerNear)) this.mode = 'rising';
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
    if (this.mode === 'circle') {
      const prev = this.pos.clone();
      this.pos.lerp(circle, Math.min(1, dt * 8));
      const v = this.pos.clone().sub(prev);
      if (v.lengthSq() > 1e-6) this.heading = Math.atan2(v.x, v.z);
    } else if (this.mode !== 'perched') {
      const v = target.clone().sub(this.pos);
      const d = v.length();
      if (d > 0.01) {
        this.pos.addScaledVector(v, Math.min(d, speed * dt) / d);
        this.heading = Math.atan2(v.x, v.z);
      }
    }
    const flying = this.mode !== 'perched';
    const flap = flying ? Math.sin(t * 9 + this.idx * 2) * 0.55 : -1.35;
    this.wingL.rotation.z = -flap;
    this.wingR.rotation.z = flap;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }
}

export class Life {
  private npcs: Npc[] = [];
  private cat: Cat;
  private gulls: Gull[] = [];
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, world: World, private camera: THREE.Camera, uiRoot: HTMLElement) {
    const defs: { role: Role; title: string; name: string; x: number; z: number; fig: ConstructorParameters<typeof Figure>[0] }[] = [
      { role: 'fishmonger', title: 'Greta, fishmonger', name: 'Greta', x: LAYOUT.market.x, z: LAYOUT.market.z - 1.9, fig: { shirt: 0xe8e4d8, pants: 0x3f5f7f, apron: 0xffffff, hat: 'cap', hatColor: 0xffffff } },
      { role: 'shipwright', title: 'Osric, shipwright', name: 'Osric', x: LAYOUT.shipyard.x + 2.6, z: LAYOUT.shipyard.z + 3.4, fig: { shirt: 0x4a6a8a, pants: 0x5a4a3a, hat: 'cap', hatColor: 0x2f3b47, skin: 0xd9a97c } },
      { role: 'innkeeper', title: 'Bram, innkeeper', name: 'Bram', x: LAYOUT.inn.x - 1.0, z: LAYOUT.inn.z + 3.6, fig: { shirt: 0xb5483a, pants: 0x5a4a3a, apron: 0xf0e8d8, skin: 0xe8b890, scale: 1.05 } },
    ];
    for (const d of defs) {
      const figure = new Figure(d.fig);
      figure.group.position.set(d.x, 0, d.z);
      scene.add(figure.group);
      world.addObstacle({ x0: d.x - 0.4, x1: d.x + 0.4, z0: d.z - 0.4, z1: d.z + 0.4 });
      const el = document.createElement('div');
      el.className = 'bubble';
      uiRoot.appendChild(el);
      this.npcs.push({ role: d.role, title: d.title, figure, x: d.x, z: d.z, el, lineN: Math.floor(Math.random() * 5), lineAt: -99, lastKey: '' });
    }
    this.cat = new Cat(scene, world);
    for (let i = 0; i < 4; i++) this.gulls.push(new Gull(scene, i));
  }

  update(dt: number, now: number, player: { x: number; z: number }, ctx: LineContext, dockCrates: Crate[], hidden: boolean): void {
    const w = window.innerWidth, h = window.innerHeight;
    for (const n of this.npcs) {
      const dx = player.x - n.x, dz = player.z - n.z;
      const dist = Math.hypot(dx, dz);
      const near = dist < 5.5 && !hidden;
      const target = near ? Math.atan2(dx, dz) : 0;
      const d = ((target - n.figure.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      n.figure.group.rotation.y += d * Math.min(1, dt * 5);
      n.figure.update(dt, 0);
      if (near) {
        const key = `${ctx.phase}|${ctx.recentFilled}|${ctx.recentMissed}|${ctx.handSpecies.length}|${ctx.boatsOut}`;
        if (key !== n.lastKey || now - n.lineAt > 9) {
          if (key === n.lastKey) n.lineN++;
          n.lastKey = key;
          n.lineAt = now;
          n.el.innerHTML = `<b>${n.title}</b><span>${pickLine(n.role, ctx, n.lineN)}</span>`;
        }
        this.tmp.set(n.x, 2.3, n.z).project(this.camera);
        n.el.style.display = 'block';
        n.el.style.left = `${(this.tmp.x * 0.5 + 0.5) * w}px`;
        n.el.style.top = `${(-this.tmp.y * 0.5 + 0.5) * h}px`;
      } else {
        n.el.style.display = 'none';
      }
    }
    this.cat.update(dt, player.x, player.z, ctx.handSpecies.length > 0);
    const fresh = dockCrates.find((c) => c.freshness > 0);
    const land = fresh ? new THREE.Vector3(fresh.x ?? 0, 0.46 + (fresh.layer ?? 0) * 0.42, fresh.z ?? 0) : null;
    for (const g of this.gulls) {
      g.update(dt, now, g.idx === 0 ? land : null, Math.hypot(player.x - g.pos.x, player.z - g.pos.z) < 1.8 && g.mode === 'perched');
    }
  }
}
