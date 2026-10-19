import { describe, expect, it } from 'vitest';
import { LAYOUT } from '../sim/config';
import { initialState } from '../sim/state';
import { hintFor } from './coach';
import { TUTORIAL } from './tutorialText';

describe('tutorial hints', () => {
  const s = initialState();
  const far = { x: 30, z: 12 };
  const boat = LAYOUT.berths[0];

  it('walks the player to the boat, then asks for E, then rings Send out', () => {
    expect(hintFor('send', s, null, far.x, far.z).text).toBe(TUTORIAL.walkToBoat);
    expect(hintFor('send', s, null, boat.edgeX, boat.edgeZ).text).toBe(TUTORIAL.openBoat);
    const inWindow = hintFor('send', s, 'boat', boat.edgeX, boat.edgeZ);
    expect(inWindow.text).toBe(TUTORIAL.pressSend);
    expect(inWindow.press).toContain('send');
  });

  it('points at the market while carrying, and rings Sell in the market window', () => {
    expect(hintFor('sell', s, 'market', 0, 0).press).toContain('sell');
    expect(hintFor('sell', s, null, 0, 0).at).toBeDefined();
  });

  it('guides the boat upgrade through the shipyard window', () => {
    expect(hintFor('space', s, null, 0, 0).text).toBe(TUTORIAL.toShipyard);
    expect(hintFor('space', s, 'shipyard', 0, 0).press).toContain('openboat');
    expect(hintFor('space', s, 'boat', 0, 0).press).toContain('hold');
  });
});
