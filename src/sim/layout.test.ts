import { describe, expect, it } from 'vitest';
import { BOAT_RANGE, INTERACT_RANGE } from './config';
import { APPROACHES, BOXES, DOORS, FRONTAGE, L, LANES, MIDDLE, QUEUE_BOX, ROUNDS, TABLES, WALK_RECTS, inside, insideRound, overlap } from './layoutBoxes';
import type { Box } from './layoutBoxes';
import { walkPath } from './staff';

const R = 0.4; // the player's radius
const STEP = 0.1;
const S = L.square;
const SOLID_BOXES: Box[] = [...BOXES, QUEUE_BOX];
const X0 = L.quayMinX - 3, Z0 = L.pierEndZ - 2, W = Math.round((L.quayMaxX + 3 - X0) / STEP), H = Math.round((S.z1 + 4 - Z0) / STEP);
const cx = (i: number) => X0 + (i + 0.5) * STEP, cz = (j: number) => Z0 + (j + 0.5) * STEP;
const ix = (x: number) => Math.floor((x - X0) / STEP), iz = (z: number) => Math.floor((z - Z0) / STEP);

/** The square, pier and breakwater as a fine grid: true where the player's centre can stand. */
function walkGrid(): Uint8Array {
  const ok = new Uint8Array(W * H);
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
/** Breadth-first search from a spot (moves up, down, left, right); returns the walking distance in steps of every cell, -1 where unreachable. */
function flood(ok: Uint8Array, x: number, z: number): Int32Array {
  const dist = new Int32Array(W * H).fill(-1);
  const s = iz(z) * W + ix(x);
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
/** The same search, but a walker may also step diagonally (a diagonal step costs 1.414): the walking distance in units, Infinity where unreachable. */
function walkDist(ok: Uint8Array, x: number, z: number): Float64Array {
  const dist = new Float64Array(W * H).fill(Infinity);
  const heap: number[] = [], key: number[] = [];
  const push = (c: number, d: number) => {
    let i = heap.length; heap.push(c); key.push(d);
    while (i > 0) { const p = (i - 1) >> 1; if (key[p] <= key[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [key[p], key[i]] = [key[i], key[p]]; i = p; }
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [heap[0], key[0]], c = heap.pop()!, d = key.pop()!;
    if (heap.length) {
      heap[0] = c; key[0] = d;
      for (let i = 0; ;) {
        let m = i; const l = 2 * i + 1, r = l + 1;
        if (l < heap.length && key[l] < key[m]) m = l;
        if (r < heap.length && key[r] < key[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; [key[m], key[i]] = [key[i], key[m]]; i = m;
      }
    }
    return top;
  };
  const s = iz(z) * W + ix(x);
  expect(ok[s], `start ${x},${z} is free`).toBe(1);
  dist[s] = 0; push(s, 0);
  while (heap.length) {
    const [c, d] = pop();
    if (d > dist[c]) continue;
    const i = c % W, j = (c - i) / W;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      // a diagonal step may not cut a corner of something solid
      if (!ok[n] || (di && dj && (!ok[j * W + ni] || !ok[nj * W + i]))) continue;
      const nd = d + (di && dj ? Math.SQRT2 : 1) * STEP;
      if (nd < dist[n]) { dist[n] = nd; push(n, nd); }
    }
  }
  return dist;
}
/** Is any solid (grown by `pad`) inside the lane (a box)? */
function blockers(l: Box, pad = 0): string[] {
  const out: string[] = [];
  for (const b of SOLID_BOXES) if (overlap(l, b, -pad)) out.push(b.name);
  for (const r of ROUNDS) if (inside(l, r.cx, r.cz, r.r + pad)) out.push(r.name);
  return out;
}
const near = (dist: ArrayLike<number>, x: number, z: number, range: number, none: number) => {
  let best = Infinity;
  for (let i = ix(x - range); i <= ix(x + range); i++) for (let j = iz(z - range); j <= iz(z + range); j++) {
    if (i < 0 || j < 0 || i >= W || j >= H) continue;
    const d = dist[j * W + i];
    if (d !== none && d >= 0 && Math.hypot(cx(i) - x, cz(j) - z) <= range) best = Math.min(best, d);
  }
  return best;
};

const SEA_ROW = ['market', 'board', 'tower'];
const WEST_ROW = ['shipyard', 'smokehouse'];
const EAST_ROW = ['inn', 'restaurant'];
const named = (n: string) => BOXES.find((b) => b.name === n)!;
const poseOf = (n: string) => ({ market: L.market, shipyard: L.shipyard, inn: L.inn, tower: L.bellTower, board: L.noticeBoard, smokehouse: L.plots.smokehouse, restaurant: L.plots.restaurant } as Record<string, { x: number; z: number; rot: number }>)[n];
const corners = (b: Box) => {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => ({ x: b.cx + sx * b.hx * c + sz * b.hz * s, z: b.cz - sx * b.hx * s + sz * b.hz * c }));
};

describe('town layout', () => {
  it('turns no building except by exactly 90 degrees on the two side rows, and faces every door into the square', () => {
    for (const n of SEA_ROW) { expect(poseOf(n).rot, n).toBe(0); expect(named(n).a).toBe(0); }
    for (const n of WEST_ROW) { expect(poseOf(n).rot, n).toBe(Math.PI / 2); expect(named(n).a, n).toBe(Math.PI / 2); }
    for (const n of EAST_ROW) { expect(poseOf(n).rot, n).toBe(-Math.PI / 2); expect(named(n).a, n).toBe(-Math.PI / 2); }
  });
  it('puts the sea row on the water side with its front wall on the square, the pier running out of the gap in the middle', () => {
    for (const n of SEA_ROW) for (const c of corners(named(n))) expect(c.z, `${n} stays behind the square's top edge`).toBeLessThanOrEqual(S.z0 + 0.01);
    for (const n of SEA_ROW) expect(Math.max(...corners(named(n)).map((c) => c.z)), `${n} front wall on the edge`).toBeCloseTo(S.z0, 6);
    const xs = SEA_ROW.map((n) => poseOf(n).x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(L.market.x).toBeLessThan(-L.pierHalfWidth - 1);
    expect(L.noticeBoard.x).toBeGreaterThan(L.pierHalfWidth + 1);
    expect(L.bellTower.x).toBe(poseOf('tower').x);
    expect(L.bellTower.z).toBe(poseOf('tower').z);
  });
  it('stands the side rows outside the square with their front walls on its edges, the shipyard at the water\'s corner', () => {
    for (const n of WEST_ROW) expect(Math.max(...corners(named(n)).map((c) => c.x)), n).toBeCloseTo(S.x0, 6);
    for (const n of EAST_ROW) expect(Math.min(...corners(named(n)).map((c) => c.x)), n).toBeCloseTo(S.x1, 6);
    const zs = WEST_ROW.map((n) => poseOf(n).z);
    for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeGreaterThan(zs[i - 1]);
    expect(L.plots.restaurant.z).toBeGreaterThan(L.inn.z);
    for (const n of [...WEST_ROW, ...EAST_ROW]) for (const c of corners(named(n))) expect(c.z, `${n} stays inside the square's depth`).toBeLessThanOrEqual(S.z1);
    // the shipyard's sea end is the northernmost thing on the west side, at the shore
    expect(Math.min(...corners(named('shipyard')).map((c) => c.z))).toBeLessThan(L.shoreZ + 1.5);
  });
  it('keeps real room between neighbours in a row and between every pair of solids', () => {
    for (const row of [SEA_ROW, WEST_ROW, EAST_ROW]) for (let i = 1; i < row.length; i++) {
      const a = named(row[i - 1]), b = named(row[i]);
      expect(overlap(a, b, 0.3), `${a.name} / ${b.name} need room between them`).toBe(false);
    }
    for (const row of [WEST_ROW, EAST_ROW]) for (let i = 1; i < row.length; i++) expect(overlap(named(row[i - 1]), named(row[i]), 1.3), `${row[i - 1]} / ${row[i]} need about 1.5 units`).toBe(false);
    for (let i = 0; i < BOXES.length; i++) for (let j = i + 1; j < BOXES.length; j++) expect(overlap(BOXES[i], BOXES[j], /table/.test(BOXES[i].name + BOXES[j].name) ? 0 : 0.3), `${BOXES[i].name} / ${BOXES[j].name}`).toBe(false);
  });
  it('is no wider than 40 units across, side buildings included (x from -20 to 20)', () => {
    let lo = 1e9, hi = -1e9;
    for (const b of BOXES.filter((b) => !/table|npc/.test(b.name))) for (const c of corners(b)) { lo = Math.min(lo, c.x); hi = Math.max(hi, c.x); }
    expect(lo).toBeGreaterThanOrEqual(-20);
    expect(hi).toBeLessThanOrEqual(20);
    expect(hi - lo).toBeLessThanOrEqual(40);
    for (const [x0, x1] of WALK_RECTS) { expect(x0).toBeGreaterThanOrEqual(-20); expect(x1).toBeLessThanOrEqual(20); }
  });
  it('keeps decoration (lamp posts, trees) out of the square: only the pier, the wall and the gaps between side buildings', () => {
    for (const r of ROUNDS.filter((r) => /street lamp|tree/.test(r.name))) {
      const inSquare = r.cx > S.x0 && r.cx < S.x1 && r.cz > S.z0 && r.cz < S.z1;
      expect(inSquare, r.name).toBe(false);
    }
  });
  it('lets workers walk to every door without crossing anything', () => {
    const homes = [L.dockhandHome, { x: 1.4, z: 0.6 }];
    for (const home of homes) for (const [id, dx, dz] of DOORS) {
      const path = walkPath(home, { x: dx, z: dz });
      for (let i = 1; i < path.length; i++) {
        for (let t = 0; t <= 1; t += 0.01) {
          const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t, z = path[i - 1].z + (path[i].z - path[i - 1].z) * t;
          for (const b of SOLID_BOXES) expect(inside(b, x, z, 0.15), `${id} worker crosses ${b.name} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
          for (const r of ROUNDS) expect(insideRound(r, x, z, 0.15), `${id} worker crosses ${r.name}`).toBe(false);
        }
      }
    }
  });
  it('lets workers walk between any two doors without crossing anything', () => {
    for (const [ida, ax, az] of DOORS) for (const [idb, bx, bz] of DOORS) {
      const path = walkPath({ x: ax, z: az }, { x: bx, z: bz });
      for (let i = 1; i < path.length; i++) for (let t = 0; t <= 1; t += 0.02) {
        const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t, z = path[i - 1].z + (path[i].z - path[i - 1].z) * t;
        for (const b of SOLID_BOXES) expect(inside(b, x, z, 0.1), `${ida} to ${idb} crosses ${b.name} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
        for (const r of ROUNDS) expect(insideRound(r, x, z, 0.1), `${ida} to ${idb} crosses ${r.name}`).toBe(false);
      }
    }
  });
  it('leaves room on the restaurant terrace for three tables, in the frontage beside the door approach', () => {
    expect(TABLES).toHaveLength(3);
    for (const t of TABLES) {
      expect(t.cx, `${t.name} is on the square, not on the lane`).toBeGreaterThan(FRONTAGE.east + 0.4);
      expect(Math.max(...corners(t).map((c) => c.x)), `${t.name} stays on the square`).toBeLessThan(S.x1);
      expect(Math.max(...corners(t).map((c) => c.z)), `${t.name} stays on the square`).toBeLessThan(S.z1);
    }
  });
});

describe('nothing blocks the way', () => {
  const ok = walkGrid();
  const fromStart = flood(ok, L.playerStart.x, L.playerStart.z);
  const PIER_MOUTH = { x: 0, z: 1.6 };
  const fromPier = flood(ok, PIER_MOUTH.x, PIER_MOUTH.z);
  const walk = walkDist(ok, PIER_MOUTH.x, PIER_MOUTH.z);
  const spots: [string, number, number][] = [...DOORS, ['fishing spot', L.fishingSpot.x, L.fishingSpot.z], ...L.berths.map((b, i) => [`boat spot ${i}`, b.edgeX, b.edgeZ] as [string, number, number])];
  /** Walking distance to a spot: to the spot itself, or (for a spot on a pier edge or in the water) to the nearest standing place within 1 unit. */
  const toSpot = (x: number, z: number) => near(walk, x, z, 1, Infinity);

  it('reaches every door, interaction point, plot, boat spot and the fishing spot from the start and from the pier head', () => {
    for (const dist of [fromStart, fromPier]) {
      for (const [name, x, z] of DOORS) {
        expect(dist[iz(z) * W + ix(x)], `${name} door point is free and reachable`).toBeGreaterThanOrEqual(0);
        expect(near(dist, x, z, INTERACT_RANGE, -1), name).toBeLessThan(Infinity);
      }
      for (const [i, b] of L.berths.entries()) expect(near(dist, b.edgeX, b.edgeZ, BOAT_RANGE, -1), `boat spot ${i}`).toBeLessThan(Infinity);
      expect(near(dist, L.fishingSpot.x, L.fishingSpot.z, 3.2, -1)).toBeLessThan(Infinity);
      expect(dist[iz(L.fishingSpot.z) * W + ix(L.fishingSpot.x)], 'fishing spot itself').toBeGreaterThanOrEqual(0);
    }
  });
  it('is at most 20 units of walking from the pier head to every door and interaction point, and at most 26 to the lighthouse', () => {
    let far = 0, farName = '';
    for (const [name, x, z] of spots) {
      const d = toSpot(x, z);
      expect(d, `${name} is reachable`).toBeLessThan(Infinity);
      if (name === 'lighthouse') expect(d, 'lighthouse door').toBeLessThanOrEqual(26);
      else if (d > far) { far = d; farName = name; }
    }
    expect(far, `the furthest is ${farName}`).toBeLessThanOrEqual(20);
    expect(far).toBeGreaterThan(8);
    // counted in blocks (no diagonal steps) it is still short
    let blocks = 0;
    for (const [name, x, z] of spots) if (name !== 'lighthouse') blocks = Math.max(blocks, near(fromPier, x, z, 1, -1) * STEP);
    expect(blocks).toBeLessThanOrEqual(25);
  });
  it('keeps a clear lane at least 4 wide along the inside of all three rows, even after the player\'s width', () => {
    expect(LANES).toHaveLength(3);
    for (const l of LANES) {
      expect(Math.min(l.hx, l.hz) * 2, `${l.name} width`).toBeGreaterThanOrEqual(4);
      expect(blockers(l), l.name).toEqual([]);
      for (let x = l.cx - l.hx + R; x <= l.cx + l.hx - R; x += 0.25) for (let z = l.cz - l.hz + R; z <= l.cz + l.hz - R; z += 0.25) expect(ok[iz(z) * W + ix(x)], `${l.name} blocked at ${x},${z}`).toBe(1);
    }
    // the three lanes make one U: each meets the next
    expect(overlap(LANES[0], LANES[1], 0.05)).toBe(true);
    expect(overlap(LANES[0], LANES[2], 0.05)).toBe(true);
  });
  it('connects every door to a lane with a wide, clear approach, and the pier head to the square with a path at least 3 wide', () => {
    for (const a of APPROACHES) {
      expect(a.hx * 2, a.name).toBeGreaterThanOrEqual(3);
      expect(blockers(a), a.name).toEqual([]);
    }
    const pier = APPROACHES.find((a) => /pier/.test(a.name))!;
    expect(pier.hx * 2).toBeGreaterThanOrEqual(3);
    for (const [name, x, z] of DOORS) {
      const a = APPROACHES.find((l) => l.name === `approach to ${name}`)!;
      expect(inside(a, x, z, 0.3), `${name} stands in its own approach`).toBe(true);
      expect(LANES.some((l) => overlap(a, l, 0.05)) || name === 'lighthouse', `${name} approach reaches a lane`).toBe(true);
    }
    expect(LANES.some((l) => overlap(pier, l, 0.05))).toBe(true);
    // the lighthouse's way leads back to the square
    const lh = APPROACHES.find((l) => l.name === 'approach to lighthouse')!;
    expect(lh.cz + lh.hz).toBeGreaterThanOrEqual(S.z0 - 0.01);
  });
  it('keeps the middle of the square clear: no solid inside the lanes and the open middle, and all of it can be walked', () => {
    const inner: Box = { name: 'inner square', cx: 0, cz: (FRONTAGE.sea + S.z1) / 2, hx: FRONTAGE.east, hz: (S.z1 - FRONTAGE.sea) / 2, a: 0 };
    expect(blockers(inner), 'inner square').toEqual([]);
    expect(blockers(MIDDLE), 'middle').toEqual([]);
    for (let x = inner.cx - inner.hx + R; x <= inner.cx + inner.hx - R; x += 0.25) for (let z = inner.cz - inner.hz + R; z <= inner.cz + inner.hz - R; z += 0.25) expect(ok[iz(z) * W + ix(x)], `${x},${z}`).toBe(1);
  });
  it('keeps the queue, the terrace tables and the pier crowd beside the lanes, not across them', () => {
    const hits = (b: Box) => [...APPROACHES, ...LANES].filter((l) => overlap(l, b)).map((l) => l.name);
    expect(hits(QUEUE_BOX), 'queue').toEqual([]);
    for (const t of TABLES) expect(hits(t), t.name).toEqual([]);
  });
});
