import * as THREE from 'three';
import { LAYOUT, toWorld } from '../sim/config';
import { bake, bx, cy, flat, lampMat } from './kit';
import { haloSprite } from './fx';
import { CitizenPool } from './townFolk';
import type { Citizen } from './townFolk';
import { CHAIR_OFFSETS, TABLE_SPOTS, nearestGate, seatsOf } from './townPlaces';
import type { SeatSpot } from './townPlaces';
import type { World } from './world';
import type { Disc } from './collide';

const SEATED = 1, LEAVING = 2, ARRIVING = 3;
const EAT_SECONDS = [24, 48];

function buildTable(index: number): THREE.Group {
  const g = new THREE.Group();
  const t = TABLE_SPOTS[index];
  g.position.set(t.x, 0, t.z);
  const cloth = flat(index % 2 ? 0xf4f1e8 : 0xf2d9a8, 0.8), iron = flat(0x34384a, 0.6), wood = flat(0x7a5638, 0.85);
  const seatCol = flat([0x2f6fb8, 0xd6453a, 0x4f9a5a][index % 3], 0.8);
  cy(0.46, 0.46, 0.05, cloth, 0, 0.74, 0, g, 14);
  cy(0.47, 0.5, 0.1, cloth, 0, 0.68, 0, g, 14);                                      // cloth hanging down
  cy(0.05, 0.09, 0.7, iron, 0, 0.35, 0, g, 6);
  cy(0.24, 0.24, 0.03, iron, 0, 0.015, 0, g, 10);
  cy(0.05, 0.065, 0.1, lampMat, 0.18, 0.82, 0.05, g, 8);                              // table lantern
  cy(0.07, 0.07, 0.02, iron, 0.18, 0.765, 0.05, g, 8);
  cy(0.06, 0.06, 0.012, flat(0xffffff, 0.5), -0.15, 0.775, -0.1, g, 10);              // a plate each side
  cy(0.06, 0.06, 0.012, flat(0xffffff, 0.5), -0.15, 0.775, 0.22, g, 10);
  for (const c of CHAIR_OFFSETS) {
    const back = c.z < 0 ? -1 : 1;
    bx(0.42, 0.06, 0.42, wood, c.x, 0.36, c.z, g);
    bx(0.38, 0.05, 0.38, seatCol, c.x, 0.4, c.z, g);
    bx(0.42, 0.44, 0.05, wood, c.x, 0.64, c.z + back * 0.2, g);
    for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) bx(0.05, 0.36, 0.05, wood, c.x + lx, 0.18, c.z + lz, g);
  }
  bake(g);
  return g;
}

/**
 * The restaurant terrace: up to three tables out in front (one per restaurant level, lit by a lantern at night) and the
 * diners who arrive, sit, eat and chat, and leave. Tables carry two diners each, filled in proportion to today's service.
 */
export class Terrace {
  readonly group = new THREE.Group();
  private tables: THREE.Group[] = [];
  private halos: THREE.Sprite[] = [];
  private discs: Disc[] = [];
  private discOn: boolean[] = [false, false, false];
  private pool: CitizenPool;
  private seats: SeatSpot[] = [];
  private taken: (Citizen | null)[] = [];
  private spawnIn = 2;
  private chatterIn = 0;
  private level = 0;
  /** How many are seated right now (for the sound). */
  seated = 0;

  constructor(scene: THREE.Scene, private world: World, size: number) {
    const plot = LAYOUT.plots.restaurant;
    this.group.position.set(plot.x, 0, plot.z);
    this.group.rotation.y = plot.rot ?? 0;
    for (let i = 0; i < 3; i++) {
      const t = buildTable(i);
      t.visible = false;
      this.group.add(t);
      this.tables.push(t);
      const w = toWorld(plot, TABLE_SPOTS[i].x, TABLE_SPOTS[i].z);
      this.discs.push({ cx: w.x, cz: w.z, r: 0.95 });
      const h = haloSprite(0xffc060, 1.5);
      h.position.set(TABLE_SPOTS[i].x + 0.18, 0.95, TABLE_SPOTS[i].z + 0.05);
      h.visible = false;
      this.group.add(h);
      this.halos.push(h);
      const s = seatsOf(i);
      this.seats.push(s[0], s[1]);
      this.taken.push(null, null);
    }
    scene.add(this.group);
    this.pool = new CitizenPool(scene, size, 200);
  }

  /** Show one table per restaurant level. */
  private setLevel(level: number): void {
    if (level === this.level) return;
    this.level = level;
    for (let i = 0; i < 3; i++) {
      const on = i < level;
      this.tables[i].visible = on;
      if (on !== this.discOn[i]) {
        this.discOn[i] = on;
        if (on) this.world.solids.push(this.discs[i]);
        else { const k = this.world.solids.indexOf(this.discs[i]); if (k >= 0) this.world.solids.splice(k, 1); }
      }
    }
  }

  update(dt: number, now: number, level: number, wanted: number, lantern: number, playerDist: number, chatter: (level: number) => void): void {
    this.setLevel(level);
    for (let i = 0; i < 3; i++) {
      this.halos[i].visible = i < level && lantern > 0.02;
      (this.halos[i].material as THREE.SpriteMaterial).opacity = lantern * 0.5 * (1 + Math.sin(now * 7 + i) * 0.04);
    }
    let seatedNow = 0, here = 0;
    for (let s = 0; s < 6; s++) {
      const c = this.taken[s];
      if (!c) continue;
      if (!c.active || c.tag === LEAVING) { this.taken[s] = null; continue; }
      here++;
      if (s >> 1 >= level && c.tag !== LEAVING) this.leave(s);   // the table was taken away
      if (c.tag === SEATED) {
        seatedNow++;
        c.timer -= dt;
        if (c.timer <= 0 || here > wanted + 1) this.leave(s);
        // seated diners look at each other, with the odd glance round
        c.lookYaw = Math.sin(now * 0.6 + c.id) * 0.35;
      } else if (c.tag === ARRIVING && c.arrived) {
        c.tag = SEATED;
        c.timer = EAT_SECONDS[0] + Math.random() * (EAT_SECONDS[1] - EAT_SECONDS[0]);
        const seat = this.seats[s];
        c.sitAt(seat.x, seat.z, seat.heading);
      }
    }
    this.seated = seatedNow;
    // a new diner arrives now and then until the terrace is as full as it should be
    this.spawnIn -= dt;
    if (here < wanted && this.spawnIn <= 0) {
      const s = this.freeSeat(level);
      const c = s >= 0 ? this.pool.acquire() : null;
      if (c && s >= 0) {
        this.spawnIn = 1.8 + Math.random() * 3;
        const pl = LAYOUT.plots.restaurant;
        c.spawn(pl.doorX, pl.doorZ, LAYOUT.plots.restaurant.rot ?? 0);
        c.tag = ARRIVING;
        const seat = this.seats[s], rot = LAYOUT.plots.restaurant.rot ?? 0;
        // walk to the side of the chair first, so nobody walks through the table or the building
        const side = toWorld(LAYOUT.plots.restaurant, TABLE_SPOTS[seat.table].x + (s & 1 ? 0.8 : -0.8), TABLE_SPOTS[seat.table].z + CHAIR_OFFSETS[s & 1].z);
        c.goTo(side.x, side.z, 1.3, rot);
        this.taken[s] = c;
      }
    }
    // the sound of conversation while people are seated, quieter with distance
    this.chatterIn -= dt;
    if (seatedNow > 0 && this.chatterIn <= 0) {
      this.chatterIn = 1.6;
      const near = 1 - Math.min(1, Math.max(0, (playerDist - 3) / 13));
      const lvl = Math.min(1, 0.25 + seatedNow / 5) * near;
      if (lvl > 0.04) chatter(lvl);
    }
    this.pool.update(dt, this.world);
    for (const c of this.pool.all) {
      if (c.tag === LEAVING && c.active && c.arrived && !c.fading) c.retire();
    }
  }

  private freeSeat(level: number): number {
    const free: number[] = [];
    for (let s = 0; s < level * 2; s++) if (!this.taken[s]) free.push(s);
    if (!free.length) return -1;
    // prefer to sit with company: a seat at a table that already has someone
    const mates = free.filter((s) => this.taken[s ^ 1]);
    const list = mates.length && Math.random() < 0.7 ? mates : free;
    return list[Math.floor(Math.random() * list.length)];
  }

  private leave(s: number): void {
    const c = this.taken[s];
    if (!c || c.tag === LEAVING) return;
    c.tag = LEAVING;
    c.standUp();
    c.lookYaw = null;
    // step back to the side of the chair, then out through the door and into town
    const seat = this.seats[s];
    const g = nearestGate(seat.x, seat.z);
    c.goTo(g.x, g.z, 1.5, null);
    this.taken[s] = null;
  }
}
