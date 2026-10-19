import { describe, expect, it } from 'vitest';
import { BUILDING_IDS } from './sim/config';
import { BOXES, L, ROUNDS, inside, insideRound } from './sim/layoutBoxes';
import { STATIONS } from './interaction';

describe('interaction spots', () => {
  it('has every interaction spot and door standing on open ground, on the quay or the point', () => {
    const spots: [string, number, number][] = [
      ...Object.entries(STATIONS).filter(([k]) => k !== 'fishing').map(([k, v]) => [k, v.x, v.z] as [string, number, number]),
      ...BUILDING_IDS.map((id) => [id, L.plots[id].doorX, L.plots[id].doorZ] as [string, number, number]),
      ['start', L.playerStart.x, L.playerStart.z],
    ];
    for (const [name, x, z] of spots) {
      for (const b of BOXES) expect(inside(b, x, z, 0), `${name} is inside ${b.name}`).toBe(false);
      for (const r of ROUNDS) expect(insideRound(r, x, z, 0), `${name} is inside ${r.name}`).toBe(false);
      const onPoint = x >= L.point.x0 && x <= L.point.x1 && z >= L.point.z0;
      expect(Math.hypot(x - L.ring.cx, z - L.ring.cz) <= L.ring.front || onPoint, name).toBe(true);
    }
  });
});
