import { describe, expect, it } from 'vitest';
import { GOALS } from './config';
import { catchUpGoals, currentGoal, goalProgress, stepGoals } from './goals';
import { initialState } from './state';
import { addCrate } from './crates';
import { sellCrate } from './market';
import { dispatchBoat, stepBoats, unloadBoat } from './boats';
import { Rng } from './rng';

describe('goals', () => {
  it('has about 25 goals, the first six for the guided start with arrows', () => {
    expect(GOALS.length).toBeGreaterThanOrEqual(24);
    expect(GOALS.length).toBeLessThanOrEqual(26);
    for (const g of GOALS.slice(0, 6)) expect(g.arrow).toBeDefined();
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(GOALS.length);
    expect(GOALS.slice(0, 6).every((g) => g.reward >= 10 && g.reward <= 50)).toBe(true);
  });
  it('shows the first goal and moves on when it is done, paying the reward', () => {
    const s = initialState();
    expect(currentGoal(s)).toMatchObject({ id: 'send', index: 0, reward: 10 });
    expect(stepGoals(s)).toHaveLength(0);
    dispatchBoat(s, 1, 'shallows');
    const m = s.money;
    const evs = stepGoals(s);
    expect(evs[0]).toMatchObject({ type: 'goalDone', id: 'send', reward: 10 });
    expect(s.money).toBe(m + 10);
    expect(currentGoal(s)!.id).toBe('unload');
    stepBoats(s, 999, new Rng(1));
    unloadBoat(s, 1);
    stepGoals(s);
    expect(currentGoal(s)!.id).toBe('sell');
    sellCrate(s, addCrate(s, 'herring', 'hand').id);
    stepGoals(s);
    expect(currentGoal(s)!.id).toBe('pier');
  });
  it('goals that are already met complete at once, several in one step', () => {
    const s = initialState();
    s.tally.dispatched = s.tally.unloaded = s.tally.sold = s.tally.pier = s.tally.orders = 1;
    s.boats[0].hold = 1;
    s.lifetime = 600;
    const evs = stepGoals(s);
    expect(evs.filter((e) => e.type === 'goalDone').length).toBeGreaterThanOrEqual(7);
    expect(currentGoal(s)!.id).toBe('worker');
  });
  it('reports progress for counting goals and zone fish', () => {
    const s = initialState();
    const sell100 = GOALS.find((g) => g.id === 'sell100')!;
    s.tally.sold = 40;
    expect(goalProgress(s, sell100)).toEqual({ have: 40, need: 100 });
    const reef = GOALS.find((g) => g.id === 'reeffish')!;
    s.book.seabass.caught = 1;
    s.book.lobster.caught = 2;
    expect(goalProgress(s, reef)).toEqual({ have: 2, need: 3 });
  });
  it('catch-up skips met goals without paying', () => {
    const s = initialState();
    s.tally.dispatched = s.tally.unloaded = s.tally.sold = 1;
    const m = s.money;
    catchUpGoals(s);
    expect(s.goal).toBe(3);
    expect(s.money).toBe(m);
  });
  it('ends with the King Fish goal and then shows nothing', () => {
    const s = initialState();
    s.goal = GOALS.length - 1;
    expect(currentGoal(s)!.id).toBe('king');
    s.king.found = true;
    stepGoals(s);
    expect(currentGoal(s)).toBeNull();
  });
});
