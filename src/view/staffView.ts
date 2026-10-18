import * as THREE from 'three';
import { DOCKHAND_SPEED } from '../sim/config';
import { homePos, jobPose } from '../sim/staff';
import type { GameState } from '../sim/state';
import { bx, cy, flat } from './kit';
import { Figure } from './figures';
import { dockhandLook } from './people';
import { REST_HIPS } from './gait';
/** Carried crates ride at hand height: the rig stands this much taller than it used to, with its boots on the ground. */
const HAND_LIFT = REST_HIPS - 0.6;


function buildCart(): THREE.Group {
  const g = new THREE.Group();
  const wood = flat(0x8a6a48, 0.85), iron = flat(0x2d3236, 0.6);
  bx(0.9, 0.08, 0.7, wood, 0, 0.35, 0, g);
  for (const s of [-1, 1]) {
    bx(0.06, 0.28, 0.7, wood, s * 0.42, 0.5, 0, g);
    cy(0.22, 0.22, 0.06, iron, s * 0.5, 0.22, 0, g, 10).rotation.z = Math.PI / 2;
  }
  bx(0.9, 0.28, 0.06, wood, 0, 0.5, -0.32, g);
  for (const s of [-1, 1]) bx(0.05, 0.05, 0.8, wood, s * 0.3, 0.55, 0.7, g).rotation.x = -0.2;
  return g;
}

interface Entry { fig: Figure; cart: THREE.Group; yaw: number; x: number; z: number }

/** Dockhand figures: they walk the paths the simulation gives them and carry the claimed crates. */
export class StaffView {
  private entries = new Map<number, Entry>();
  private pool: THREE.Vector3[] = [];
  private used = 0;
  private pose = { x: 0, z: 0, dx: 0, dz: 0 };
  constructor(private scene: THREE.Scene, private haul: Map<number, THREE.Vector3>) {}

  sync(state: GameState, dt: number): void {
    const seen = new Set<number>();
    this.haul.clear();
    this.used = 0;
    const cart = state.upgrades.handcart;
    for (const d of state.dockhands) {
      seen.add(d.id);
      let e = this.entries.get(d.id);
      if (!e) {
        const fig = new Figure(dockhandLook(d.id));
        const c = buildCart();
        c.visible = false;
        fig.group.add(c);
        this.scene.add(fig.group);
        const h = homePos(d.slot);
        e = { fig, cart: c, yaw: Math.PI, x: h.x, z: h.z };
        this.entries.set(d.id, e);
      }
      const p = this.pose;
      let moving = false;
      if (d.job) {
        jobPose(d.job, p);
        moving = true;
        if (Math.abs(p.dx) + Math.abs(p.dz) > 1e-4) e.yaw = lerpAngle(e.yaw, Math.atan2(p.dx, p.dz), Math.min(1, dt * 10));
        e.x = p.x; e.z = p.z;
      } else {
        const h = homePos(d.slot);
        e.x = h.x; e.z = h.z;
        e.yaw = lerpAngle(e.yaw, Math.PI * 0.9, Math.min(1, dt * 4));
      }
      const hauling = !!d.job && d.job.phase === 'haul';
      e.cart.visible = cart;
      e.fig.pose.carry = hauling && !cart ? 1 : 0;
      e.fig.pose.load = hauling && !cart ? d.job!.crateIds.length : 0;
      e.cart.position.set(0, 0, 0.95);
      e.fig.group.position.set(e.x, 0, e.z);
      e.fig.group.rotation.y = e.yaw;
      e.fig.update(dt, moving ? DOCKHAND_SPEED * (hauling ? 1.1 : 1.6) : 0);
      if (hauling) {
        const s = Math.sin(e.yaw), c = Math.cos(e.yaw);
        d.job!.crateIds.forEach((id, i) => {
          const v = (this.pool[this.used++] ??= new THREE.Vector3());
          if (cart) {
            const lx = (i % 2 ? 0.2 : -0.2), lz = 0.95 + (Math.floor(i / 2) % 2 ? 0.15 : -0.15), ly = 0.5 + Math.floor(i / 4) * 0.3;
            v.set(e!.x + lx * c + lz * s, ly, e!.z - lx * s + lz * c);
          } else {
            const lx = i % 2 ? 0.2 : -0.2, lz = 0.5, ly = 0.95 + HAND_LIFT + Math.floor(i / 2) * 0.36;
            v.set(e!.x + lx * c + lz * s, ly, e!.z - lx * s + lz * c);
          }
          this.haul.set(id, v);
        });
      }
    }
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) { this.scene.remove(e.fig.group); this.entries.delete(id); }
    }
  }
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
