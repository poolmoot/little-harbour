import { describe, expect, it } from 'vitest';
import { LAYOUT } from '../sim/config';
import { APPROACHES, BOXES, LANES, QUEUE_BOX, inside, overlap } from '../sim/layoutBoxes';
import { CROWD_SPOTS, QUEUE_SLOTS } from './townPlaces';

describe('town life stands beside the lanes', () => {
  it('keeps every queue slot inside the queue zone', () => {
    for (const s of QUEUE_SLOTS) expect(inside(QUEUE_BOX, s.x, s.z, 0.01)).toBe(true);
  });
  it('keeps the pier-head crowd off the approaches and the buildings', () => {
    for (const s of CROWD_SPOTS) {
      const me = { name: 'person', cx: s.x, cz: s.z, hx: 0.3, hz: 0.3, a: 0 };
      for (const l of [...APPROACHES, ...LANES]) if (s.z > 0.4) expect(overlap(l, me), `crowd spot ${s.x},${s.z} in ${l.name}`).toBe(false);
      for (const b of BOXES) expect(inside(b, s.x, s.z, 0.3), `crowd spot in ${b.name}`).toBe(false);
      expect(Math.abs(s.x) > LAYOUT.crowdGap || s.z < 0, 'crowd keeps the middle clear').toBe(true);
    }
  });
});
