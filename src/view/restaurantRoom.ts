import * as THREE from 'three';
import { restaurantCapacity } from '../sim/buildings';
import type { GameState } from '../sim/state';
import { Figure } from './figures';
import { bx, cy, flat, toon } from './kit';
import { NPC_LOOK, townLook } from './people';

/**
 * The restaurant seen from above like a doll's house (two walls, open towards the camera), drawn in the restaurant window
 * by its own small renderer. It follows the restaurant upgrades: Tables add tables, Kitchen grows the counter and adds a
 * cook, Waiters add waiters who walk between the counter and the tables, Decoration adds lanterns, paintings, a bottle
 * shelf and plants. Guests sit at the tables; how many depends on how much of today's fish has been served.
 * The game stops drawing the harbour while this shows, so it costs no more than normal play.
 */

const W = 12, D = 9, WALL_H = 3.2; // room size in metres: x from -W/2, z from -D/2
const CAM_SIZE = 4.3; // half the height the camera sees

const DARK = 0x23262b, CREAM = 0xefe6d2, RED = 0xc8352b, WOOD = 0xb07a45, FLOOR = 0xc9a271;

interface Walker { fig: Figure; x: number; z: number; to: { x: number; z: number }; wait: number; yaw: number; home: { x: number; z: number } }

export class RestaurantRoom {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private furniture = new THREE.Group();
  private people = new THREE.Group();
  private key = '';
  private seats: { x: number; z: number; yaw: number }[] = [];
  private tables: { x: number; z: number }[] = [];
  private guests: Figure[] = [];
  private waiters: Walker[] = [];
  private cooks: Figure[] = [];
  private counter = { x: -2.6, z: -3.1 };
  private time = 0;
  private size = new THREE.Vector2();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'room-canvas';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a48, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(6, 12, 8);
    this.scene.add(sun);
    this.scene.add(this.furniture, this.people);
    // An isometric view from the open corner (front right), like a doll's house.
    this.camera.position.set(14, 13, 14);
    this.camera.lookAt(0, 0.6, 0);
  }

  /** Draw one frame. Rebuilds the furniture only when an upgrade changed. */
  render(dt: number, s: GameState): void {
    this.fit();
    const up = s.restaurantUp;
    const key = `${s.buildings.restaurant}|${up.tables}|${up.kitchen}|${up.waiters}|${up.decor}`;
    if (key !== this.key) { this.key = key; this.build(s); }
    this.seatGuests(s);
    this.time += dt;
    this.animate(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private fit(): void {
    const w = this.canvas.clientWidth || 600, h = this.canvas.clientHeight || 300;
    const size = this.renderer.getSize(this.size);
    if (size.x !== w || size.y !== h) this.renderer.setSize(w, h, false);
    const a = w / h;
    this.camera.left = -CAM_SIZE * a; this.camera.right = CAM_SIZE * a; this.camera.top = CAM_SIZE; this.camera.bottom = -CAM_SIZE;
    this.camera.updateProjectionMatrix();
  }

  private clear(g: THREE.Group): void {
    for (const c of [...g.children]) g.remove(c);
  }

  private build(s: GameState): void {
    this.clear(this.furniture);
    this.clear(this.people);
    this.guests = []; this.waiters = []; this.cooks = []; this.seats = []; this.tables = [];
    const up = s.restaurantUp, f = this.furniture;
    const dark = flat(DARK, 0.6), cream = flat(CREAM, 0.8), wood = flat(WOOD, 0.7), red = flat(RED, 0.7);

    // floor, two walls with a red band on top, a dark base strip
    bx(W, 0.2, D, flat(FLOOR, 0.8), 0, -0.1, 0, f);
    for (let i = 0; i < 12; i++) bx(0.02, 0.01, D, flat(0xb08a5a, 0.9), -W / 2 + (i + 0.5) * (W / 12), 0.005, 0, f);
    bx(W, WALL_H, 0.2, cream, 0, WALL_H / 2, -D / 2 - 0.1, f);
    bx(0.2, WALL_H, D, cream, -W / 2 - 0.1, WALL_H / 2, 0, f);
    for (let i = 0; i < 24; i++) bx(0.03, WALL_H * 0.7, 0.02, flat(0xd8ccb2, 0.9), -W / 2 + (i + 0.5) * (W / 24), WALL_H * 0.35, -D / 2 + 0.01, f);
    for (let i = 0; i < 18; i++) bx(0.02, WALL_H * 0.7, 0.03, flat(0xd8ccb2, 0.9), -W / 2 + 0.01, WALL_H * 0.35, -D / 2 + (i + 0.5) * (D / 18), f);
    const bandH = up.decor >= 5 ? 0.9 : 0.35;
    bx(W, bandH, 0.04, red, 0, WALL_H - bandH / 2, -D / 2 + 0.02, f);
    bx(0.04, bandH, D, red, -W / 2 + 0.02, WALL_H - bandH / 2, 0, f);
    bx(W, 0.12, 0.05, dark, 0, 0.06, -D / 2 + 0.03, f);
    bx(0.05, 0.12, D, dark, -W / 2 + 0.03, 0.06, 0, f);

    // the counter at the back: longer and with a glass fish case as the kitchen grows
    const len = 3 + up.kitchen * 0.6;
    const cx = this.counter.x, cz = this.counter.z;
    bx(len, 1.0, 0.8, wood, cx, 0.5, cz, f);
    bx(len + 0.1, 0.08, 0.9, dark, cx, 1.04, cz, f);
    if (up.kitchen >= 2) {
      bx(1.6, 0.35, 0.5, toon(new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.45, roughness: 0.1 })), cx, 1.26, cz, f);
      for (let i = 0; i < 6; i++) bx(0.18, 0.06, 0.12, flat([0xf08a6a, 0xf2f0ea, 0xe0503a][i % 3], 0.6), cx - 0.6 + i * 0.24, 1.12, cz, f);
    }
    // stools along the counter front
    for (let i = 0; i < Math.min(5, 2 + up.kitchen); i++) {
      const x = cx - len / 2 + 0.5 + i * 0.75;
      cy(0.2, 0.2, 0.1, cream, x, 0.75, cz + 0.85, f);
      cy(0.04, 0.04, 0.7, dark, x, 0.37, cz + 0.85, f);
    }
    // cooks behind the counter
    const cooks = 1 + (up.kitchen >= 3 ? 1 : 0);
    for (let i = 0; i < cooks; i++) {
      const fig = new Figure({ ...NPC_LOOK.innkeeper, shirt: 0xf4f1e8, apron: 0xffffff, hat: 'cap', hatColor: 0xffffff });
      fig.group.position.set(cx - 0.6 + i * 1.2, 0, cz - 0.7);
      this.people.add(fig.group);
      this.cooks.push(fig);
    }

    // tables in a grid in the open front of the room: 2 to 12
    const n = Math.min(12, 2 + up.tables * 2);
    const spots: { x: number; z: number }[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) spots.push({ x: -3.6 + c * 2.6, z: -0.6 + r * 2.0 });
    // fill from the back right outwards so few tables still look placed
    spots.sort((a, b) => (a.z - b.z) || (b.x - a.x));
    for (let i = 0; i < n; i++) {
      const t = spots[i];
      this.tables.push(t);
      bx(1.2, 0.08, 0.8, dark, t.x, 0.75, t.z, f);
      cy(0.05, 0.05, 0.72, dark, t.x, 0.37, t.z, f);
      bx(0.5, 0.03, 0.5, dark, t.x, 0.02, t.z, f);
      for (const dx of [-0.3, 0.3]) cy(0.12, 0.12, 0.02, red, t.x + dx, 0.8, t.z, f); // plates
      cy(0.03, 0.03, 0.14, flat(0x2a2a2a, 0.5), t.x, 0.86, t.z, f); // soy bottle
      for (const side of [-1, 1]) {
        const z = t.z + side * 0.65;
        bx(0.45, 0.06, 0.45, cream, t.x, 0.45, z, f);
        bx(0.45, 0.55, 0.06, dark, t.x, 0.75, z + side * 0.22, f);
        for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) bx(0.05, 0.43, 0.05, dark, t.x + lx, 0.21, z + lz, f);
        this.seats.push({ x: t.x, z, yaw: side > 0 ? Math.PI : 0 });
      }
    }

    // decoration
    if (up.decor >= 1) for (const x of [-4.5, 0.5, 4.5]) this.lantern(x, -D / 2 + 0.35, f);
    if (up.decor >= 2) {
      const art = [0xe7a6b4, 0x8fb3d9, 0xa9c98a];
      art.forEach((c, i) => {
        bx(1.0, 1.4, 0.05, dark, 0.6 + i * 1.3, 1.9, -D / 2 + 0.05, f);
        bx(0.86, 1.26, 0.06, flat(c, 0.8), 0.6 + i * 1.3, 1.9, -D / 2 + 0.06, f);
      });
    }
    if (up.decor >= 3) {
      bx(0.4, 1.8, 1.8, flat(0xd2b48c, 0.8), -W / 2 + 0.25, 1.9, 1.5, f);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        cy(0.06, 0.07, 0.36, flat([0xb5651d, 0x2f6f3a, 0x7a2a26, 0xe0a030][(r + c) % 4], 0.35), -W / 2 + 0.3, 1.3 + r * 0.55, 0.85 + c * 0.42, f);
      }
    }
    if (up.decor >= 4) for (const [x, z] of [[-5.3, 3.8], [5.3, -3.9], [-5.3, -1.0]]) {
      cy(0.28, 0.22, 0.5, flat(0x8a5a34, 0.8), x, 0.25, z, f);
      const leaf = flat(0x3f8a4f, 0.8);
      for (let i = 0; i < 5; i++) bx(0.12, 0.9, 0.12, leaf, x + Math.cos(i * 1.3) * 0.15, 0.85, z + Math.sin(i * 1.3) * 0.15, f).rotation.z = Math.cos(i) * 0.3;
    }
    if (up.decor >= 5) {
      // paper sliding door and a window with a dark lattice
      bx(2.2, 2.6, 0.05, flat(0xf6f0e0, 0.9), -4.2, 1.3, -D / 2 + 0.05, f);
      for (let i = 0; i < 5; i++) bx(0.04, 2.6, 0.07, dark, -5.2 + i * 0.5, 1.3, -D / 2 + 0.06, f);
      for (let i = 0; i < 5; i++) bx(2.2, 0.04, 0.07, dark, -4.2, 0.3 + i * 0.55, -D / 2 + 0.06, f);
    }

    // waiters
    for (let i = 0; i < 1 + up.waiters; i++) {
      const fig = new Figure({ ...townLook(40 + i), shirt: 0x1f1f24, pants: 0x1f1f24, apron: 0xf4f1e8, hat: 'none' });
      const home = { x: cx + len / 2 + 0.6 + (i % 3) * 0.5, z: cz + 0.9 + Math.floor(i / 3) * 0.5 };
      fig.group.position.set(home.x, 0, home.z);
      this.people.add(fig.group);
      this.waiters.push({ fig, x: home.x, z: home.z, to: home, wait: i * 0.7, yaw: 0, home });
    }
  }

  private lantern(x: number, z: number, f: THREE.Group): void {
    bx(0.5, 0.06, 0.06, flat(DARK, 0.6), x, 2.6, z - 0.2, f);
    bx(0.36, 0.5, 0.36, toon(new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd28a, emissiveIntensity: 0.6 })), x, 2.25, z, f);
    bx(0.4, 0.06, 0.4, flat(DARK, 0.6), x, 2.52, z, f);
    bx(0.4, 0.06, 0.4, flat(DARK, 0.6), x, 1.98, z, f);
  }

  /** Seat as many guests as today's service: at least a few, the room fills up as fish is served. */
  private seatGuests(s: GameState): void {
    const cap = Math.max(1, restaurantCapacity(s));
    const want = Math.min(this.seats.length, Math.round(this.seats.length * Math.min(1, 0.25 + 0.75 * (s.restaurant.served / cap))), 14);
    while (this.guests.length < want) {
      const i = this.guests.length;
      const seat = this.seats[(i * 5) % this.seats.length];
      const fig = new Figure(townLook(i * 3 + 7));
      fig.group.position.set(seat.x, -0.42, seat.z); // sitting: the legs go under the chair and the floor
      fig.group.rotation.y = seat.yaw;
      this.people.add(fig.group);
      this.guests.push(fig);
    }
    while (this.guests.length > want) this.people.remove(this.guests.pop()!.group);
  }

  private animate(dt: number): void {
    for (const g of this.guests) g.update(dt, 0);
    for (const c of this.cooks) c.update(dt, 0);
    const speed = 1.3;
    for (const w of this.waiters) {
      const dx = w.to.x - w.x, dz = w.to.z - w.z, dist = Math.hypot(dx, dz);
      if (w.wait > 0) {
        w.wait -= dt;
        w.fig.update(dt, 0);
      } else if (dist < 0.05) {
        // at a table: wait, then go back to the counter; at the counter: wait, then take food to a table
        const atHome = w.to === w.home;
        const t = this.tables[Math.floor(Math.random() * this.tables.length)];
        w.to = atHome && t ? { x: t.x + 0.9, z: t.z } : w.home;
        w.wait = atHome ? 1.2 : 1.6;
        w.fig.update(dt, 0);
      } else {
        const step = Math.min(dist, speed * dt);
        w.x += (dx / dist) * step; w.z += (dz / dist) * step;
        w.yaw = Math.atan2(dx, dz);
        w.fig.update(dt, speed);
      }
      w.fig.group.position.set(w.x, 0, w.z);
      w.fig.group.rotation.y = w.yaw;
    }
  }
}

