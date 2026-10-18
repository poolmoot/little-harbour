import * as THREE from 'three';
import { QUEUE_BUY_SECONDS } from './townRules';
import { FACE_STALL, QUEUE_SLOTS, randomGate } from './townPlaces';
import { CitizenPool } from './townFolk';
import type { Citizen } from './townFolk';
import type { World } from './world';

const LINE = 1, LEAVING = 2;
const BOUGHT_PAUSE = 0.9;

/**
 * The market queue. Customers come out of town, walk up and wait in the line, the one at the front buys a small parcel
 * (straight away when a crate has just sold, otherwise after a while) and walks off with it. The length follows the target.
 */
export class MarketQueue {
  private pool: CitizenPool;
  private line: Citizen[] = [];
  private spawnIn = 0;
  private pendingSales = 0;

  constructor(scene: THREE.Scene, private world: World, size: number) {
    this.pool = new CitizenPool(scene, size, 100);
  }

  get length(): number { return this.line.length; }
  get members(): Citizen[] { return this.pool.all; }

  /** A crate was sold: let the next customer buy. */
  noteSale(): void { this.pendingSales = Math.min(3, this.pendingSales + 1); }

  update(dt: number, now: number, target: number): void {
    const line = this.line;
    // give up from the back when the target is shorter
    while (line.length > target) this.release(line.pop() as Citizen, false);
    // someone new joins every few seconds
    this.spawnIn -= dt;
    if (line.length < target && this.spawnIn <= 0) {
      const c = this.pool.acquire();
      if (c) {
        const g = randomGate();
        c.spawn(g.spot.x, g.spot.z, 0);
        c.tag = LINE;
        c.slot = -1;
        c.setItem('none');
        line.push(c);
        this.spawnIn = 2.2 + Math.random() * 3;
      }
    }
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c.slot !== i) {
        c.slot = i;
        c.timer = 0;
        c.state = 0;
        c.goTo(QUEUE_SLOTS[i].x, QUEUE_SLOTS[i].z, 1.35, FACE_STALL);
      }
      c.lookYaw = c.arrived && i > 0 ? Math.sin(now * 0.45 + i * 2.1) * 0.7 : null;
    }
    const head = line[0];
    if (head && head.arrived) {
      head.timer += dt;
      if (head.state === 0) {
        // a quick glance at the fish, then buy
        head.lookYaw = Math.sin(now * 1.3) * 0.3;
        const limit = QUEUE_BUY_SECONDS[0] + (head.id % 7) / 6 * (QUEUE_BUY_SECONDS[1] - QUEUE_BUY_SECONDS[0]);
        if (head.timer > 1.2 && this.pendingSales > 0 || head.timer > limit) {
          if (this.pendingSales > 0) this.pendingSales--;
          head.setItem('parcel');
          head.state = 1;
          head.timer = 0;
        }
      } else if (head.timer > BOUGHT_PAUSE) {
        line.shift();
        this.release(head, true);
      }
    }
    for (const c of this.pool.all) {
      if (c.tag === LEAVING && c.active && c.arrived && !c.fading) c.retire();
    }
    this.pool.update(dt, this.world);
  }

  private release(c: Citizen, bought: boolean): void {
    c.tag = LEAVING;
    c.slot = -1;
    c.lookYaw = null;
    const g = randomGate();
    c.goTo(g.spot.x, g.spot.z, bought ? 1.5 : 1.7, null);
  }
}
