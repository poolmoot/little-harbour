import { describe, expect, it } from 'vitest';
import { START_MONEY, ZONES, ZONE_IDS } from './config';
import { dispatchBoat, stepBoats } from './boats';
import { tripCostFor } from './fleet';
import { netProfit } from './ledger';
import { Rng } from './rng';
import { loadGame } from './save';
import { step } from './sim';
import { hireCaptain, refreshCandidates, stepCaptains } from './staff';
import { initialState } from './state';

describe('trip costs', () => {
  it('a new game starts with a little money and costs rise by zone', () => {
    expect(initialState().money).toBe(START_MONEY);
    const costs = ZONE_IDS.map((z) => tripCostFor(z));
    expect(costs).toEqual([3, 10, 30, 80]);
    expect(costs.every((c, i) => i === 0 || c > costs[i - 1])).toBe(true);
    expect(ZONES.shallows.tripCost).toBe(3);
  });

  it('sending a boat pays the cost and records it in the day report', () => {
    const s = initialState();
    s.money = 50;
    const ev = dispatchBoat(s, 1, 'shallows');
    expect(ev[0]).toMatchObject({ type: 'boatDispatched', cost: 3 });
    expect(s.money).toBe(47);
    expect(s.stats.tripCosts).toBe(3);
    expect(netProfit(s.stats)).toBe(-3);
  });

  it('a boat cannot leave when the player cannot pay, and nothing changes', () => {
    const s = initialState();
    s.money = 2;
    const ev = dispatchBoat(s, 1, 'shallows');
    expect(ev[0].type).toBe('denied');
    expect(s.money).toBe(2);
    expect(s.boats[0].status).toBe('docked');
    expect(s.stats.tripCosts).toBe(0);
  });

  it('the start money pays for the first trips', () => {
    const s = initialState();
    expect(dispatchBoat(s, 1, 'shallows')[0].type).toBe('boatDispatched');
  });

  it('a captained boat waits at its spot until it can pay, then leaves', () => {
    const s = initialState();
    s.lifetime = 5000;
    s.rank = 2;
    s.money = 0;
    const rng = new Rng(3);
    refreshCandidates(s, rng);
    hireCaptain(s, s.candidates[0].id, 1);
    s.boats[0].captain!.unpaid = false;
    s.boats[0].target = 'shallows';
    expect(stepCaptains(s)).toHaveLength(0);
    expect(s.boats[0].status).toBe('docked');
    s.money = 3;
    expect(stepCaptains(s)[0]).toMatchObject({ type: 'boatDispatched', auto: true, cost: 3 });
    expect(s.money).toBe(0);
    // back home with a catch and no money: unloaded, then waits again
    stepBoats(s, 200, rng);
    stepCaptains(s);
    expect(s.boats[0].status).toBe('docked');
    expect(step(s, 0.25, rng).some((e) => e.type === 'boatDispatched')).toBe(false);
  });

  it('old saves without trip costs load with a zero cost line', () => {
    const old = initialState();
    const raw = JSON.parse(JSON.stringify(old));
    raw.version = 2;
    delete raw.stats.tripCosts;
    const mem = new Map<string, string>([['harbour-game-save', JSON.stringify(raw)]]);
    const l = loadGame({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) }, new Rng(1))!;
    expect(l.version).toBe(5);
    expect(l.stats.tripCosts).toBe(0);
  });
});
