import { describe, expect, it } from 'vitest';
import { dispatchBoat, stepBoats, unloadBoat } from './boats';
import { Rng } from './rng';
import { initialState } from './state';
import type { GameState } from './state';
import { canRepair, repairBoat, repairCost, setStayInStorms, stepRepairs } from './storm';
import { REPAIR_SECONDS } from './config';

function stormState(hull = 2): GameState {
  const s = initialState();
  s.weather = 'storm';
  s.day = 10;
  s.money = 1000;
  s.boats[0].hull = hull;
  s.boats[0].stayInStorms = false;
  return s;
}
/** A rng whose next() is fixed, so the damage roll is decided. */
class Fixed extends Rng { constructor(private v: number) { super(1); } next() { return this.v; } }

describe('storms', () => {
  it('boats stay home in storms by default, but only for Open Sea and Deep Sea', () => {
    const s = stormState();
    s.boats[0].stayInStorms = true;
    expect(dispatchBoat(s, 1, 'opensea')[0].type).toBe('denied');
    expect(dispatchBoat(s, 1, 'reef')[0].type).toBe('boatDispatched');
    expect(initialState().boats[0].stayInStorms).toBe(true);
  });
  it('the player can untick the stay-home choice', () => {
    const s = stormState();
    s.boats[0].stayInStorms = true;
    setStayInStorms(s, 1, false);
    expect(dispatchBoat(s, 1, 'opensea')[0].type).toBe('boatDispatched');
  });
  it('a safe storm trip brings 50% more crates and counts as survived', () => {
    const s = stormState();
    dispatchBoat(s, 1, 'opensea');
    stepBoats(s, 999, new Fixed(0.9));
    expect(s.boats[0].catch).toHaveLength(6); // 4 crates x 1.5
    expect(s.tally.storm).toBe(1);
  });
  it('a damaged boat comes back with nothing and cannot sail until fixed', () => {
    const s = stormState();
    dispatchBoat(s, 1, 'opensea');
    const evs = stepBoats(s, 999, new Fixed(0.1));
    expect(evs.some((e) => e.type === 'boatDamaged')).toBe(true);
    expect(s.boats[0].catch).toHaveLength(0);
    unloadBoat(s, 1);
    expect(dispatchBoat(s, 1, 'shallows')[0].type).toBe('denied');
    const before = s.money;
    const cost = repairCost(s.boats[0]);
    expect(cost).toBe(Math.round((700 + 400 + 2500) * 0.05));
    expect(repairBoat(s, 1)[0].type).toBe('boatRepairStarted');
    expect(s.money).toBe(before - cost);
    expect(canRepair(s, 1).ok).toBe(false);
    stepRepairs(s, REPAIR_SECONDS - 1);
    expect(s.boats[0].damaged).toBe(true);
    expect(stepRepairs(s, 2)[0].type).toBe('boatRepaired');
    expect(dispatchBoat(s, 1, 'shallows')[0].type).toBe('boatDispatched');
  });
});
