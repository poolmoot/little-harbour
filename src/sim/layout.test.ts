import { describe, expect, it } from 'vitest';
import { BOAT_RANGE, BUILDING_IDS, INTERACT_RANGE, toWorld } from './config';
import { APPROACHES, BOXES, DOORS, L, QUEUE_BOX, ROUNDS, STREET_LANE, TABLES, inside, insideRound, overlap } from './layoutBoxes';
import type { Box, Lane } from './layoutBoxes';
import { walkPath } from './staff';

const R = 0.4; // the player's radius
const STEP = 0.1;
const SOLID_BOXES: Box[] = [...BOXES, QUEUE_BOX];
const X0 = L.quayMinX - 2, Z0 = L.pierEndZ - 2, W = Math.round((L.quayMaxX + 2 - X0) / STEP), H = Math.round((L.quayMaxZ + 2 - Z0) / STEP);
const cx = (i: number) => X0 + (i + 0.5) * STEP, cz = (j: number) => Z0 + (j + 0.5) * STEP;
const ix = (x: number) => Math.floor((x - X0) / STEP), iz = (z: number) => Math.floor((z - Z0) / STEP);

/** The quay, pier and point as a fine grid: true where the player's centre can stand. */
function walkGrid(): Uint8Array {
  const ok = new Uint8Array(W * H);
  const areas = [[L.quayMinX, L.quayMaxX, 0, L.quayMaxZ], [-L.pierHalfWidth, L.pierHalfWidth, L.pierEndZ, 1.2], [L.point.x0, L.point.x1, L.point.z0, 1.2]];
  for (const [x0, x1, z0, z1] of areas) {
    for (let i = ix(x0 + R); i <= ix(x1 - R); i++) for (let j = iz(z0 + R); j <= iz(z1 - R); j++) ok[j * W + i] = 1;
  }
  for (const b of SOLID_BOXES) {
    for (let i = ix(b.cx - b.hx - R); i <= ix(b.cx + b.hx + R); i++) for (let j = iz(b.cz - b.hz - R); j <= iz(b.cz + b.hz + R); j++) {
      const dx = Math.max(0, Math.abs(cx(i) - b.cx) - b.hx), dz = Math.max(0, Math.abs(cz(j) - b.cz) - b.hz);
      if (Math.hypot(dx, dz) < R) ok[j * W + i] = 0;
    }
  }
  for (const r of ROUNDS) {
    for (let i = ix(r.cx - r.r - R); i <= ix(r.cx + r.r + R); i++) for (let j = iz(r.cz - r.r - R); j <= iz(r.cz + r.r + R); j++) {
      if (Math.hypot(cx(i) - r.cx, cz(j) - r.cz) < r.r + R) ok[j * W + i] = 0;
    }
  }
  return ok;
}
/** Breadth-first search from a spot; returns the walking distance (in steps) of every cell, -1 where unreachable. */
function flood(ok: Uint8Array, x: number, z: number): Int32Array {
  const dist = new Int32Array(W * H).fill(-1);
  let s = iz(z) * W + ix(x);
  expect(ok[s], `start ${x},${z} is free`).toBe(1);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  queue[tail++] = s; dist[s] = 0;
  while (head < tail) {
    const c = queue[head++], i = c % W, j = (c - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (ok[n] && dist[n] < 0) { dist[n] = dist[c] + 1; queue[tail++] = n; }
    }
  }
  return dist;
}
/** Is any solid (grown by `pad`) inside the lane? */
function blockers(l: Lane, pad = 0): string[] {
  const out: string[] = [];
  for (const b of SOLID_BOXES) if (b.cx + b.hx + pad > l.x0 && b.cx - b.hx - pad < l.x1 && b.cz + b.hz + pad > l.z0 && b.cz - b.hz - pad < l.z1) out.push(b.name);
  for (const r of ROUNDS) if (r.cx + r.r + pad > l.x0 && r.cx - r.r - pad < l.x1 && r.cz + r.r + pad > l.z0 && r.cz - r.r - pad < l.z1) out.push(r.name);
  return out;
}
const reachNear = (dist: Int32Array, x: number, z: number, range: number) => {
  let best = Infinity;
  for (let i = ix(x - range); i <= ix(x + range); i++) for (let j = iz(z - range); j <= iz(z + range); j++) {
    if (i < 0 || j < 0 || i >= W || j >= H) continue;
    if (dist[j * W + i] >= 0 && Math.hypot(cx(i) - x, cz(j) - z) <= range) best = Math.min(best, dist[j * W + i]);
  }
  return best;
};

describe('town layout', () => {
  it('stands every building in one row, all at the same angle, with their fronts on one door line', () => {
    expect(L.shipyard.rot).toBe(0);
    for (const id of BUILDING_IDS) expect(L.plots[id].rot, id).toBe(0);
    for (const b of BOXES) {
      expect(b.a, b.name).toBe(0);
      if (/bench|planter|table|hull|npc/.test(b.name)) continue;
      expect(b.cz + b.hz, `${b.name} front`).toBeCloseTo(L.doorLineZ, 1);
    }
  });
  it('keeps real room between the buildings', () => {
    const row = BOXES.filter((b) => !/bench|planter|table|hull|npc/.test(b.name)).sort((a, b) => a.cx - b.cx);
    for (let i = 1; i < row.length; i++) {
      const gap = (row[i].cx - row[i].hx) - (row[i - 1].cx + row[i - 1].hx);
      expect(gap, `${row[i - 1].name} / ${row[i].name}`).toBeGreaterThanOrEqual(3.9);
    }
    for (let i = 0; i < BOXES.length; i++) for (let j = i + 1; j < BOXES.length; j++) expect(overlap(BOXES[i], BOXES[j], /table/.test(BOXES[i].name + BOXES[j].name) ? 0 : 0.3), `${BOXES[i].name} / ${BOXES[j].name}`).toBe(false);
  });
  it('keeps every solid on the quay or the point', () => {
    for (const b of BOXES) {
      expect(b.cx - b.hx, b.name).toBeGreaterThanOrEqual(L.quayMinX);
      expect(b.cx + b.hx, b.name).toBeLessThanOrEqual(L.quayMaxX);
      expect(b.cz + b.hz, b.name).toBeLessThanOrEqual(L.quayMaxZ);
    }
  });
  it('orders the work quarter west of the pier and the town quarter east of it', () => {
    const x = (n: string) => BOXES.find((b) => b.name === n)!.cx;
    expect(x('market')).toBeGreaterThan(x('coldstore'));
    expect(x('coldstore')).toBeGreaterThan(x('smokehouse'));
    expect(x('smokehouse')).toBeGreaterThan(x('shipyard'));
    expect(x('board')).toBeLessThan(x('tower'));
    expect(x('tower')).toBeLessThan(x('inn'));
    expect(x('inn')).toBeLessThan(x('restaurant'));
    expect(L.bellTower.x).toBe(x('tower'));
  });
  it('lets workers walk to every door without crossing anything', () => {
    for (const [id, dx, dz] of DOORS) {
      const path = walkPath(L.dockhandHome, { x: dx, z: dz });
      for (let i = 1; i < path.length; i++) {
        for (let t = 0; t <= 1; t += 0.01) {
          const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t, z = path[i - 1].z + (path[i].z - path[i - 1].z) * t;
          for (const b of SOLID_BOXES) expect(inside(b, x, z, 0.15), `${id} worker crosses ${b.name} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
          for (const r of ROUNDS) expect(insideRound(r, x, z, 0.15), `${id} worker crosses ${r.name}`).toBe(false);
        }
      }
    }
  });
  it('leaves room on the restaurant terrace for three tables, beside the door approach', () => {
    const t = L.terrace;
    for (const [lx, lz] of [[t.x0, t.z0], [t.x1, t.z0], [t.x0, t.z1], [t.x1, t.z1]]) {
      const p = toWorld(L.plots.restaurant, lx, lz);
      expect(p.z, 'terrace corner on the quay').toBeLessThanOrEqual(L.quayMaxZ);
      expect(p.z, 'terrace stays out of the street').toBeLessThan(L.street.z0);
    }
    expect(TABLES).toHaveLength(3);
  });
});

describe('nothing blocks the way', () => {
  const ok = walkGrid();
  const fromStart = flood(ok, L.playerStart.x, L.playerStart.z);
  const fromPier = flood(ok, 0, 1.6);

  it('reaches every door, interaction point, plot, boat spot and the fishing spot from the start and from the pier head', () => {
    for (const dist of [fromStart, fromPier]) {
      for (const [name, x, z] of DOORS) {
        expect(dist[iz(z) * W + ix(x)], `${name} door point is free and reachable`).toBeGreaterThanOrEqual(0);
        expect(reachNear(dist, x, z, INTERACT_RANGE), name).toBeLessThan(Infinity);
      }
      for (const [i, b] of L.berths.entries()) expect(reachNear(dist, b.edgeX, b.edgeZ, BOAT_RANGE), `boat spot ${i}`).toBeLessThan(Infinity);
      expect(reachNear(dist, L.fishingSpot.x, L.fishingSpot.z, 3.2)).toBeLessThan(Infinity);
      expect(dist[iz(L.fishingSpot.z) * W + ix(L.fishingSpot.x)], 'fishing spot itself').toBeGreaterThanOrEqual(0);
    }
  });
  it('keeps the whole main street unbroken, 6 wide, and the central 3 wide even after the player\'s width', () => {
    expect(STREET_LANE.z1 - STREET_LANE.z0).toBeGreaterThanOrEqual(5.9);
    expect(blockers(STREET_LANE), 'solids in the street').toEqual([]);
    const mid = (STREET_LANE.z0 + STREET_LANE.z1) / 2;
    for (let x = STREET_LANE.x0 + 0.5; x <= STREET_LANE.x1 - 0.5; x += 0.5) {
      for (let z = mid - 1.5; z <= mid + 1.5; z += 0.5) expect(ok[iz(z) * W + ix(x)], `street blocked at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(1);
      expect(fromStart[iz(mid) * W + ix(x)], `street unreachable at ${x.toFixed(1)}`).toBeGreaterThanOrEqual(0);
    }
  });
  it('keeps a wide, clear approach from the street to every door, interaction point, the pier head and the fishing spot', () => {
    for (const a of APPROACHES) {
      expect(a.x1 - a.x0, a.name).toBeGreaterThanOrEqual(2.7);
      expect(blockers(a), a.name).toEqual([]);
    }
  });
  it('keeps the square at the head of the pier open: at least 14 by 10 of clear paving', () => {
    const square: Lane = { name: 'square', x0: -7, x1: 7, z0: 0, z1: 10 };
    expect(blockers(square)).toEqual([]);
    for (let x = -6.4; x <= 6.4; x += 0.5) for (let z = 1.2; z <= 10; z += 0.5) expect(ok[iz(z) * W + ix(x)], `${x},${z}`).toBe(1);
  });
  it('keeps the queue, the terrace tables and the pier crowd beside the lanes, not across them', () => {
    const lanes = [STREET_LANE, ...APPROACHES];
    const hits = (b: { cx: number; cz: number; hx: number; hz: number }) => lanes.filter((l) => b.cx + b.hx > l.x0 && b.cx - b.hx < l.x1 && b.cz + b.hz > l.z0 && b.cz - b.hz < l.z1).map((l) => l.name);
    expect(hits(QUEUE_BOX), 'queue').toEqual([]);
    for (const t of TABLES) expect(hits(t), t.name).toEqual([]);
  });
  it('is no more than about 80 steps along the ground from the pier head to the furthest door', () => {
    let far = 0;
    for (const [name, x, z] of DOORS) far = Math.max(far, fromPier[iz(z) * W + ix(x)] * STEP + 0 * name.length);
    expect(far).toBeLessThan(80);
    expect(far).toBeGreaterThan(20);
  });
});
