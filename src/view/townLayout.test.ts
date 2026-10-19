import { describe, expect, it } from 'vitest';
import { LAYOUT } from '../sim/config';
import { APPROACHES, BOXES, QUEUE_BOX, STREET_LANE, inside } from '../sim/layoutBoxes';
import { CROWD_SPOTS, QUEUE_SLOTS } from './townPlaces';

describe('town life stands beside the lanes', () => {
  const lanes = [STREET_LANE, ...APPROACHES];
  it('keeps every queue slot inside the queue zone', () => {
    for (const s of QUEUE_SLOTS) expect(inside(QUEUE_BOX, s.x, s.z, 0.01)).toBe(true);
  });
  it('keeps the pier-head crowd off the street, the approaches and the buildings', () => {
    for (const s of CROWD_SPOTS) {
      for (const l of lanes) expect(s.x + 0.3 > l.x0 && s.x - 0.3 < l.x1 && s.z + 0.3 > l.z0 && s.z - 0.3 < l.z1, `crowd spot ${s.x},${s.z} in ${l.name}`).toBe(false);
      for (const b of BOXES) expect(inside(b, s.x, s.z, 0.3), `crowd spot in ${b.name}`).toBe(false);
      expect(Math.abs(s.x) > LAYOUT.crowdGap || s.z < 0, 'crowd keeps the middle clear').toBe(true);
    }
  });
});
