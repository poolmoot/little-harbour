import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, LAYOUT, PLOT_HALF, toWorld } from './config';
import { walkPath } from './staff';

interface Box { name: string; cx: number; cz: number; hx: number; hz: number; a: number }
const L = LAYOUT;
const box = (name: string, o: { x: number; z: number; rot?: number }, lx: number, lz: number, hx: number, hz: number): Box => {
  const c = toWorld(o, lx, lz);
  return { name, cx: c.x, cz: c.z, hx, hz, a: o.rot ?? 0 };
};
const BOXES: Box[] = [
  box('market', { x: L.market.x, z: L.market.z }, 0, 0, 4.4, 1.15),
  box('shipyard', L.shipyard, 0, 0, 3, 2), box('shipyard hull', L.shipyard, -0.6, -3.1, 1.7, 0.8),
  box('inn', { x: L.inn.x, z: L.inn.z }, 0, 0, 3.5, 2.5),
  box('tower', { x: L.bellTower.x, z: L.bellTower.z }, 0, 0, 1.3, 1.3),
  box('board', { x: L.noticeBoard.x, z: L.noticeBoard.z }, 0, 0, 1, 0.3),
  box('icebox', { x: L.iceBox.x, z: L.iceBox.z }, 0, 0, 0.9, 0.7),
  ...BUILDING_IDS.map((id) => box(id, L.plots[id], 0, 0, PLOT_HALF[id][0], PLOT_HALF[id][1])),
];
const axes = (b: Box) => [[Math.cos(b.a), -Math.sin(b.a)], [Math.sin(b.a), Math.cos(b.a)]];
function overlap(p: Box, q: Box, gap = 0): boolean {
  for (const b of [p, q]) for (const [ax, az] of axes(b)) {
    const proj = (o: Box) => {
      const c = o.cx * ax + o.cz * az;
      const r = o.hx * Math.abs(axes(o)[0][0] * ax + axes(o)[0][1] * az) + o.hz * Math.abs(axes(o)[1][0] * ax + axes(o)[1][1] * az);
      return [c - r, c + r];
    };
    const [a0, a1] = proj(p), [b0, b1] = proj(q);
    if (a1 + gap <= b0 || b1 + gap <= a0) return false;
  }
  return true;
}
const inside = (b: Box, x: number, z: number, pad = 0) => {
  const dx = x - b.cx, dz = z - b.cz, c = Math.cos(b.a), s = Math.sin(b.a);
  return Math.abs(dx * c - dz * s) < b.hx + pad && Math.abs(dx * s + dz * c) < b.hz + pad;
};

describe('town layout', () => {
  it('keeps buildings apart with a little room between', () => {
    for (let i = 0; i < BOXES.length; i++) for (let j = i + 1; j < BOXES.length; j++) {
      if (BOXES[i].name.startsWith('shipyard') && BOXES[j].name.startsWith('shipyard')) continue;
      expect(overlap(BOXES[i], BOXES[j], 0.3), `${BOXES[i].name} / ${BOXES[j].name}`).toBe(false);
    }
  });
  it('keeps every building on the quay or the point', () => {
    for (const b of BOXES) {
      const r = Math.hypot(b.hx, b.hz);
      expect(b.cx - r, b.name).toBeGreaterThanOrEqual(L.quayMinX - 0.5);
      expect(b.cx + r, b.name).toBeLessThanOrEqual(L.quayMaxX + 0.5);
      expect(b.cz + r, b.name).toBeLessThanOrEqual(L.quayMaxZ + 0.5);
    }
  });
  it('puts every door within about 20 units of the pier head', () => {
    const head = { x: 0, z: 1 };
    const doors = [
      ...BUILDING_IDS.map((id) => [id, L.plots[id].doorX, L.plots[id].doorZ] as const),
      ['shipyard', ...Object.values(toWorld(L.shipyard, -0.5, 3.0))] as const,
      ['inn', L.inn.x + 0.8, L.inn.z + 3.6] as const,
    ];
    for (const [name, x, z] of doors) expect(Math.hypot(x - head.x, z - head.z), name).toBeLessThanOrEqual(21);
  });
  it('lets workers walk to every door without crossing a building', () => {
    for (const id of BUILDING_IDS) {
      const d = L.plots[id];
      const path = walkPath(L.dockhandHome, { x: d.doorX, z: d.doorZ });
      for (let i = 1; i < path.length; i++) {
        for (let t = 0; t <= 1; t += 0.02) {
          const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t, z = path[i - 1].z + (path[i].z - path[i - 1].z) * t;
          for (const b of BOXES) expect(inside(b, x, z, 0.15), `${id} worker crosses ${b.name} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
        }
      }
    }
  });
  it('keeps the queue space in front of the market free', () => {
    const q = L.queueZone;
    for (const b of BOXES) {
      const r: Box = { name: 'queue', cx: (q.x0 + q.x1) / 2, cz: (q.z0 + q.z1) / 2, hx: (q.x1 - q.x0) / 2, hz: (q.z1 - q.z0) / 2, a: 0 };
      expect(overlap(r, b), b.name).toBe(false);
    }
  });
});
