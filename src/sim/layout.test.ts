import { describe, expect, it } from 'vitest';
import { BOAT_RANGE, FOOT, INTERACT_RANGE, ringOf } from './config';
import { APPROACHES, BOXES, DOORS, L, QUEUE_BOX, RING_BAND, ROUNDS, SQUARE_R, TABLES, WALK_DISC, WALK_RECTS, inside, insideRound, overlap } from './layoutBoxes';
import type { Box } from './layoutBoxes';
import { walkPath } from './staff';

const R = 0.4; // the player's radius
const STEP = 0.1;
const SOLID_BOXES: Box[] = [...BOXES, QUEUE_BOX];
const X0 = L.quayMinX - 12, Z0 = L.pierEndZ - 2, W = Math.round((L.quayMaxX + 14 - X0) / STEP), H = Math.round((L.ring.cz + L.ring.south + 4 - Z0) / STEP);
const cx = (i: number) => X0 + (i + 0.5) * STEP, cz = (j: number) => Z0 + (j + 0.5) * STEP;
const ix = (x: number) => Math.floor((x - X0) / STEP), iz = (z: number) => Math.floor((z - Z0) / STEP);

/** The quay, pier and point as a fine grid: true where the player's centre can stand. */
function walkGrid(): Uint8Array {
  const ok = new Uint8Array(W * H);
  for (let i = ix(WALK_DISC.cx - WALK_DISC.r + R); i <= ix(WALK_DISC.cx + WALK_DISC.r - R); i++) for (let j = iz(WALK_DISC.cz - WALK_DISC.r + R); j <= iz(WALK_DISC.cz + WALK_DISC.r - R); j++) {
    if (Math.hypot(cx(i) - WALK_DISC.cx, cz(j) - WALK_DISC.cz) <= WALK_DISC.r - R && cz(j) <= WALK_DISC.zMax - R) ok[j * W + i] = 1;
  }
  for (const [x0, x1, z0, z1] of WALK_RECTS) {
    for (let i = ix(x0 + R); i <= ix(x1 - R); i++) for (let j = iz(z0 + R); j <= iz(z1 - R); j++) ok[j * W + i] = 1;
  }
  for (const b of SOLID_BOXES) {
    const ext = b.hx + b.hz + R, c = Math.cos(b.a), sn = Math.sin(b.a);
    for (let i = ix(b.cx - ext); i <= ix(b.cx + ext); i++) for (let j = iz(b.cz - ext); j <= iz(b.cz + ext); j++) {
      const dx = cx(i) - b.cx, dz = cz(j) - b.cz;
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      if (Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz)) < R) ok[j * W + i] = 0;
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
/** Is any solid (grown by `pad`) inside the lane (a turned box)? */
function blockers(l: Box, pad = 0): string[] {
  const out: string[] = [];
  for (const b of SOLID_BOXES) if (overlap(l, b, -pad)) out.push(b.name);
  for (const r of ROUNDS) if (inside(l, r.cx, r.cz, r.r + pad)) out.push(r.name);
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

const deg = (x: number, z: number) => ringOf(x, z).deg;
const ARMS: Record<string, string[]> = { west: ['market', 'coldstore', 'smokehouse', 'shipyard'], east: ['board', 'tower', 'inn', 'restaurant'] };
const named = (n: string) => BOXES.find((b) => b.name === n)!;
const rotOf = (n: string) => ({ market: L.market, shipyard: L.shipyard, inn: L.inn, tower: L.bellTower, board: L.noticeBoard, coldstore: L.plots.coldstore, smokehouse: L.plots.smokehouse, restaurant: L.plots.restaurant } as Record<string, { x: number; z: number; rot: number }>)[n];

describe('town layout', () => {
  it('stands every building on the one circle, facing its centre, with equal angular steps on each side', () => {
    for (const arm of Object.values(ARMS)) {
      const angles = arm.map((n) => ringOf(rotOf(n).x, rotOf(n).z).deg);
      for (const n of arm) {
        const p = rotOf(n), { deg: d, r } = ringOf(p.x, p.z);
        expect(p.rot, `${n} faces the centre`).toBeCloseTo(-(d * Math.PI) / 180, 9);
        const hz = n === 'tower' ? FOOT.bellTower[1] : n === 'board' ? FOOT.noticeBoard[1] : FOOT[n as keyof typeof FOOT][1];
        expect(r - hz, `${n} front on the ring`).toBeCloseTo(L.ring.front, 6);
        expect(Math.abs(d), `${n} keeps its door towards the camera`).toBeLessThanOrEqual(80);
        expect(named(n).a, `${n} box turned with it`).toBeCloseTo(p.rot, 9);
      }
      const steps = angles.slice(1).map((a, i) => Math.abs(a - angles[i]));
      for (const st of steps) expect(st).toBeCloseTo(steps[0], 6);
    }
  });
  it('orders the work quarter west of the pier and the town quarter east of it', () => {
    for (const n of ARMS.west) expect(rotOf(n).x).toBeLessThan(0);
    for (const n of ARMS.east) expect(rotOf(n).x).toBeGreaterThan(0);
    const w = ARMS.west.map((n) => Math.abs(deg(rotOf(n).x, rotOf(n).z))), e = ARMS.east.map((n) => deg(rotOf(n).x, rotOf(n).z));
    for (const a of [w, e]) for (let i = 1; i < 4; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    expect(L.bellTower.x).toBe(rotOf('tower').x);
    expect(L.bellTower.z).toBe(rotOf('tower').z);
  });
  it('keeps real room between the buildings and between every pair of solids', () => {
    for (const arm of Object.values(ARMS)) for (let i = 1; i < 4; i++) {
      const a = named(arm[i - 1]), b = named(arm[i]);
      expect(overlap(a, b, 1.9), `${a.name} / ${b.name} need about 2 units between them`).toBe(false);
    }
    for (let i = 0; i < BOXES.length; i++) for (let j = i + 1; j < BOXES.length; j++) expect(overlap(BOXES[i], BOXES[j], /table/.test(BOXES[i].name + BOXES[j].name) ? 0 : 0.3), `${BOXES[i].name} / ${BOXES[j].name}`).toBe(false);
  });
  it('is no wider than about 60 units across', () => {
    let lo = 1e9, hi = -1e9;
    for (const b of BOXES.filter((b) => !/table|npc/.test(b.name))) {
      const c = Math.cos(b.a), s = Math.sin(b.a), ex = b.hx * Math.abs(c) + b.hz * Math.abs(s);
      lo = Math.min(lo, b.cx - ex); hi = Math.max(hi, b.cx + ex);
    }
    expect(hi - lo).toBeLessThan(60);
  });
  it('keeps every solid in the horseshoe outside the walkable square, or on the rim', () => {
    for (const b of BOXES.filter((b) => !/table|npc|icebox|queue/.test(b.name))) {
      const c = Math.cos(b.a), s = Math.sin(b.a);
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const lx = sx * b.hx, lz = sz * b.hz;
        const x = b.cx + lx * c + lz * s, z = b.cz - lx * s + lz * c;
        if (Math.abs(deg(b.cx, b.cz)) > 85) continue;
        expect(Math.hypot(x - L.ring.cx, z - L.ring.cz), `${b.name} corner`).toBeGreaterThanOrEqual(L.ring.front - 0.05);
      }
    }
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
    expect(TABLES).toHaveLength(3);
    for (const t of TABLES) {
      const { r } = ringOf(t.cx, t.cz);
      expect(r, `${t.name} stays out of the free ring walkway`).toBeGreaterThan(RING_BAND.r1 + 0.4);
      expect(r, `${t.name} stays on the square`).toBeLessThan(L.ring.front);
    }
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
  it('keeps the ring walkway unbroken, at least 5 wide even after the player\'s width, all round the horseshoe', () => {
    expect(RING_BAND.r1 - RING_BAND.r0).toBeGreaterThanOrEqual(5);
    let n = 0;
    for (let d = -88; d <= 88; d += 0.5) {
      const a = (d * Math.PI) / 180;
      for (let r = RING_BAND.r0; r <= RING_BAND.r1; r += 0.25) {
        const x = L.ring.cx + r * Math.sin(a), z = L.ring.cz - r * Math.cos(a);
        expect(ok[iz(z) * W + ix(x)], `ring blocked at ${d} degrees, radius ${r}`).toBe(1);
        n++;
      }
      expect(fromStart[iz(L.ring.cz - 18 * Math.cos(a)) * W + ix(18 * Math.sin(a))], `ring unreachable at ${d}`).toBeGreaterThanOrEqual(0);
    }
    expect(n).toBeGreaterThan(1000);
  });
  it('keeps a wide, clear approach from the ring to every door, interaction point, the pier head and the fishing spot', () => {
    for (const a of APPROACHES) {
      expect(a.hx * 2, a.name).toBeGreaterThanOrEqual(2.7);
      expect(blockers(a), a.name).toEqual([]);
    }
  });
  it('keeps the middle of the square open: nothing stands inside a radius of 15, and all of it can be walked', () => {
    const square: Box = { name: 'square', cx: L.ring.cx, cz: L.ring.cz, hx: 1, hz: 1, a: 0 };
    for (const b of SOLID_BOXES) expect(Math.hypot(b.cx - square.cx, b.cz - square.cz) - Math.max(b.hx, b.hz) * 1.5, b.name).toBeGreaterThan(SQUARE_R - 1);
    for (const r of ROUNDS.filter((r) => r.cz < WALK_DISC.zMax)) expect(Math.hypot(r.cx - L.ring.cx, r.cz - L.ring.cz) - r.r, r.name).toBeGreaterThan(SQUARE_R - 1);
    for (let x = -SQUARE_R + 1; x <= SQUARE_R - 1; x += 0.5) for (let z = L.ring.cz - SQUARE_R + 1; z <= L.ring.cz + L.ring.south - 0.6; z += 0.5) {
      if (Math.hypot(x - L.ring.cx, z - L.ring.cz) > SQUARE_R - 1) continue;
      expect(ok[iz(z) * W + ix(x)], `${x},${z}`).toBe(1);
    }
  });
  it('keeps the queue, the terrace tables and the pier crowd beside the lanes, not across them', () => {
    const hits = (b: Box) => APPROACHES.filter((l) => overlap(l, b)).map((l) => l.name);
    expect(hits(QUEUE_BOX), 'queue').toEqual([]);
    for (const t of TABLES) expect(hits(t), t.name).toEqual([]);
  });
  it('is no more than about 70 grid steps (block distance, about 50 as the crow walks) from the pier head to the furthest door', () => {
    let far = 0;
    for (const [, x, z] of DOORS) far = Math.max(far, fromPier[iz(z) * W + ix(x)] * STEP);
    expect(far).toBeLessThan(70);
    expect(far).toBeGreaterThan(15);
  });
});
