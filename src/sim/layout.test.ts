import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, toWorld } from './config';
import { BOXES, L, inside, overlap } from './layoutBoxes';
import type { Box } from './layoutBoxes';
import { walkPath } from './staff';

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
      ['inn', L.inn.x - 1.8, L.inn.z + 3.4] as const,
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
  it('leaves room on the restaurant terrace for three tables', () => {
    const t = L.terrace, r = L.plots.restaurant;
    for (const [lx, lz] of [[t.x0, t.z0], [t.x1, t.z0], [t.x0, t.z1], [t.x1, t.z1]]) {
      const p = toWorld(r, lx, lz);
      expect(p.z, 'terrace corner on the quay').toBeLessThanOrEqual(L.quayMaxZ);
      for (const b of BOXES) if (b.name !== 'restaurant') expect(inside(b, p.x, p.z), `terrace in ${b.name}`).toBe(false);
    }
  });
});
