import { describe, expect, it } from 'vitest';
import { LAYOUT } from '../sim/config';
import { initialState } from '../sim/state';
import { hintFor } from './coach';
import { TUTORIAL } from './tutorialText';

const boat = LAYOUT.berths[0];

describe('tutorial hints', () => {
  it('walks the player to the boat, then asks for E, then rings Send out', () => {
    const s = initialState();
    s.money = 50;
    expect(hintFor('send', s, null, 30, 12).text).toBe(TUTORIAL.walkToBoat);
    expect(hintFor('send', s, null, boat.edgeX, boat.edgeZ).text).toBe(TUTORIAL.openBoat);
    const inWindow = hintFor('send', s, 'boat', boat.edgeX, boat.edgeZ);
    expect(inWindow.text).toBe(TUTORIAL.pressSend);
    expect(inWindow.press).toContain('send');
  });

  it('sends the player fishing from the pier when the trip cannot be paid', () => {
    const s = initialState();
    s.money = 0;
    const h = hintFor('send', s, null, 0, 0);
    expect(h.text).toBe(TUTORIAL.toPierEnd);
    expect(h.need?.have).toBe(0);
  });

  it('does not ask for crate space the player cannot afford: it shows the gap and how to earn it', () => {
    const s = initialState();
    s.money = 86;
    const h = hintFor('space', s, null, 0, 0);
    expect(h.need).toBeDefined();
    expect(h.need!.cost).toBeGreaterThan(86);
    expect(h.text).toContain(TUTORIAL.saveUp(h.need!.cost));
    expect(h.press).toBeUndefined();
  });

  it('guides the upgrade through the shipyard window once it is affordable', () => {
    const s = initialState();
    s.money = 100000;
    expect(hintFor('space', s, null, 0, 0).text).toBe(TUTORIAL.toShipyard);
    expect(hintFor('space', s, 'shipyard', 0, 0).press).toContain('openboat');
    expect(hintFor('space', s, 'boat', 0, 0).press).toContain('hold');
  });
});
