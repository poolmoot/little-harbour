import * as THREE from 'three';
import { LAYOUT } from '../sim/config';

/**
 * The glowing trail on the ground for the starting guide: a dotted path from the player's feet to where to go.
 * It follows the walkable ground (a small grid search, then straightened), is one instanced mesh, and fades out as the
 * player gets close. Targets are given as world positions by the caller; nothing here knows where buildings are.
 */

export interface P2 { x: number; z: number }
export type Walkable = (x: number, z: number) => boolean;

const CELL = 0.8;
const X0 = LAYOUT.quayMinX - 3, X1 = LAYOUT.point.x1 + 3;
const Z0 = LAYOUT.pierEndZ - 3, Z1 = LAYOUT.ring.cz + LAYOUT.ring.front + 3;
const NX = Math.ceil((X1 - X0) / CELL), NZ = Math.ceil((Z1 - Z0) / CELL);
const DOTS = 90, SPACING = 0.85, DOT_R = 0.17;
/** Within this distance of the target the trail has faded away completely; it is full strength beyond FADE_FAR. */
const FADE_NEAR = 1.8, FADE_FAR = 5;

const cx = (i: number): number => X0 + (i % NX + 0.5) * CELL;
const cz = (i: number): number => Z0 + (Math.floor(i / NX) + 0.5) * CELL;
const cellOf = (p: P2): number => {
  const ix = Math.min(NX - 1, Math.max(0, Math.floor((p.x - X0) / CELL)));
  const iz = Math.min(NZ - 1, Math.max(0, Math.floor((p.z - Z0) / CELL)));
  return iz * NX + ix;
};

/** Can you walk in a straight line between two points? */
function clear(a: P2, b: P2, ok: Walkable): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.4));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!ok(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

/**
 * A walkable route from `from` to `to` as a short list of corner points (first is `from`, last is `to`).
 * A straight line is used when nothing is in the way; otherwise a grid search finds the way round and the result is straightened.
 * If no route exists, the straight line is returned so there is still something to follow.
 */
export function findRoute(from: P2, to: P2, ok: Walkable): P2[] {
  if (clear(from, to, ok)) return [from, to];
  const cache = new Int8Array(NX * NZ); // 0 unknown, 1 walkable, -1 blocked
  const walk = (i: number): boolean => {
    if (cache[i] === 0) cache[i] = ok(cx(i), cz(i)) ? 1 : -1;
    return cache[i] === 1;
  };
  const start = cellOf(from);
  let goal = cellOf(to);
  if (!walk(goal)) {
    // The target itself may be on a wall or the water: aim for the nearest walkable cell.
    let best = -1, bd = Infinity;
    const gx = goal % NX, gz = Math.floor(goal / NX);
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const x = gx + dx, z = gz + dz;
      if (x < 0 || z < 0 || x >= NX || z >= NZ) continue;
      const i = z * NX + x;
      const d = dx * dx + dz * dz;
      if (d < bd && walk(i)) { bd = d; best = i; }
    }
    if (best < 0) return [from, to];
    goal = best;
  }
  const g = new Float32Array(NX * NZ).fill(Infinity);
  const parent = new Int32Array(NX * NZ).fill(-1);
  const closed = new Uint8Array(NX * NZ);
  const open: number[] = [];
  const f = new Float32Array(NX * NZ);
  const h = (i: number): number => Math.hypot(cx(i) - cx(goal), cz(i) - cz(goal));
  g[start] = 0;
  f[start] = h(start);
  open.push(start);
  let found = false;
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === goal) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ux = cur % NX, uz = Math.floor(cur / NX);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const x = ux + dx, z = uz + dz;
      if (x < 0 || z < 0 || x >= NX || z >= NZ) continue;
      const n = z * NX + x;
      if (closed[n] || (n !== start && !walk(n))) continue;
      // no cutting corners through a blocked neighbour
      if (dx && dz && (!walk(uz * NX + x) || !walk(z * NX + ux))) continue;
      const ng = g[cur] + (dx && dz ? 1.4142 : 1) * CELL;
      if (ng < g[n]) { g[n] = ng; parent[n] = cur; f[n] = ng + h(n); open.push(n); }
    }
  }
  if (!found) return [from, to];
  const cells: P2[] = [];
  for (let c = goal; c >= 0; c = parent[c]) cells.push({ x: cx(c), z: cz(c) });
  cells.reverse();
  // Straighten: from each corner jump to the farthest point that can be reached in a straight line.
  const pts = [from, ...cells.slice(1), to];
  const out: P2[] = [from];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clear(pts[i], pts[j], ok)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** Evenly spaced points along a route, starting a little way from the first corner. Returns how many were written into `out`. */
export function sampleRoute(route: readonly P2[], spacing: number, max: number, out: { x: number; z: number; d: number }[]): number {
  let n = 0, carry = spacing * 0.5, total = 0;
  for (let i = 0; i + 1 < route.length && n < max; i++) {
    const a = route[i], b = route[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let at = carry;
    while (at <= len && n < max) {
      const t = at / len;
      const o = out[n++];
      o.x = a.x + (b.x - a.x) * t;
      o.z = a.z + (b.z - a.z) * t;
      o.d = total + at;
      at += spacing;
    }
    carry = at - len;
    total += len;
  }
  return n;
}

export class GuideTrail {
  private mesh: THREE.InstancedMesh;
  private route: P2[] = [];
  private pts = Array.from({ length: DOTS }, () => ({ x: 0, z: 0, d: 0 }));
  private count = 0;
  private lastFrom: P2 = { x: 1e9, z: 1e9 };
  private lastTo: P2 = { x: 1e9, z: 1e9 };
  private since = 0;
  private strength = 0;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor(scene: THREE.Scene, private ok: Walkable) {
    const geo = new THREE.CircleGeometry(DOT_R, 14);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.InstancedMesh(geo, mat, DOTS);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DOTS * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** `to` is null (or `on` false) when no trail should show. Call every frame. */
  update(now: number, dt: number, from: P2, to: P2 | null, on: boolean): void {
    const want = on && to ? 1 : 0;
    this.strength += (want - this.strength) * Math.min(1, dt * 4);
    if (this.strength < 0.01 && !want) { this.mesh.visible = false; this.lastTo.x = 1e9; return; }
    if (!to) { this.mesh.visible = false; return; }
    this.since += dt;
    const moved = Math.hypot(from.x - this.lastFrom.x, from.z - this.lastFrom.z) > 0.9;
    const changed = Math.hypot(to.x - this.lastTo.x, to.z - this.lastTo.z) > 0.3;
    if (moved || changed || this.since > 2) {
      this.since = 0;
      this.lastFrom.x = from.x; this.lastFrom.z = from.z;
      this.lastTo.x = to.x; this.lastTo.z = to.z;
      this.route = findRoute({ x: from.x, z: from.z }, { x: to.x, z: to.z }, this.ok);
      this.count = sampleRoute(this.route, SPACING, DOTS, this.pts);
    }
    // The first corner follows the player smoothly between searches.
    if (this.route.length) { this.route[0].x = from.x; this.route[0].z = from.z; if (!moved && !changed) this.count = sampleRoute(this.route, SPACING, DOTS, this.pts); }
    const left = Math.hypot(to.x - from.x, to.z - from.z);
    const near = Math.min(1, Math.max(0, (left - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));
    const k = this.strength * near;
    this.mesh.visible = k > 0.01 && this.count > 0;
    if (!this.mesh.visible) return;
    const dm = this.dummy;
    for (let i = 0; i < this.count; i++) {
      const p = this.pts[i];
      // A soft wave of light runs along the trail towards the target.
      const w = 0.5 + 0.5 * Math.sin(now * 3.2 - p.d * 0.9);
      const s = 0.75 + 0.5 * w;
      dm.position.set(p.x, 0.1, p.z);
      dm.scale.setScalar(s);
      dm.updateMatrix();
      this.mesh.setMatrixAt(i, dm.matrix);
      const b = k * (0.35 + 0.65 * w);
      this.color.setRGB(1.0 * b, 0.82 * b, 0.25 * b);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
