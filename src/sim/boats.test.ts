import { describe, expect, it } from 'vitest';
import { dispatchBoat, stepBoats, unloadBoat } from './boats';
import { ZONES } from './config';
import { dockCrates } from './crates';
import { Rng } from './rng';
import { initialState } from './state';

describe('boat lifecycle', () => {
  it('dispatch -> trip -> return with a full hold -> unload onto the dock', () => {
    const s = initialState();
    const rng = new Rng(1);
    expect(dispatchBoat(s, 1, 'shallows')[0].type).toBe('boatDispatched');
    expect(dispatchBoat(s, 1, 'shallows')[0].type).toBe('denied');
    expect(stepBoats(s, ZONES.shallows.trip - 1, rng)).toHaveLength(0);
    const ev = stepBoats(s, 2, rng);
    expect(ev[0].type).toBe('boatReturned');
    expect(s.boats[0].catch).toHaveLength(4);
    expect(s.book.herring.caught + s.book.mackerel.caught + s.book.flounder.caught).toBe(4);
    expect(dispatchBoat(s, 1, 'shallows')[0].type).toBe('denied'); // must unload first
    unloadBoat(s, 1);
    expect(dockCrates(s)).toHaveLength(4);
    expect(dockCrates(s).every((c) => c.freshness === 100)).toBe(true);
    expect(s.boats[0].status).toBe('docked');
  });
  it('can sail at night, and the lighthouse makes a night trip 30% shorter', () => {
    const s = initialState();
    const rng = new Rng(1);
    s.dayTime = 220;
    expect(dispatchBoat(s, 1, 'shallows')[0].type).toBe('boatDispatched');
    expect(s.boats[0].tripTime).toBeCloseTo(ZONES.shallows.trip);
    expect(stepBoats(s, 60, rng)[0].type).toBe('boatReturned');
    unloadBoat(s, 1);
    s.buildings.lighthouse = 1;
    dispatchBoat(s, 1, 'shallows');
    expect(s.boats[0].tripTime).toBeCloseTo(ZONES.shallows.trip * 0.7);
    unloadBoat(s, 1);
    s.dayTime = 100;
    s.boats[0].status = 'docked';
    dispatchBoat(s, 1, 'shallows');
    expect(s.boats[0].tripTime).toBeCloseTo(ZONES.shallows.trip); // day trips do not change
  });
  it('reef needs the hull and takes its own time', () => {
    const s = initialState();
    expect(dispatchBoat(s, 1, 'reef')[0].type).toBe('denied');
    s.boats[0].hull = 1;
    dispatchBoat(s, 1, 'reef');
    expect(s.boats[0].tripTime).toBe(ZONES.reef.trip);
  });
  it('hold upgrades change the catch size', () => {
    const s = initialState();
    s.boats[0].hold = 2;
    dispatchBoat(s, 1, 'shallows');
    stepBoats(s, 60, new Rng(2));
    expect(s.boats[0].catch).toHaveLength(8);
  });
});
