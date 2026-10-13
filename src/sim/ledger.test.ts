import { describe, expect, it } from 'vitest';
import { step } from './sim';
import { Rng } from './rng';
import { initialState } from './state';
import { addCrate } from './crates';
import { sellCrate } from './market';
import { buyBoatUpgrade, trackCost } from './fleet';
import { creditOrder } from './orders';
import { netProfit } from './ledger';

describe('ledger', () => {
  it('records income by fish, bonuses, spending, wages, spoilage and the best sale', () => {
    const s = initialState();
    s.money = 1000;
    s.lifetime = 3000;
    s.boats[0].captain = { id: 5, name: 'A', trait: 'swift', wage: 40 };
    for (const sp of ['herring', 'lobster', 'lobster'] as const) sellCrate(s, addCrate(s, sp, 'hand').id);
    s.orders = [{ id: 9, species: 'herring', qty: 1, filled: 0, deadline: 999, name: 'Marta', baseValue: 100 }];
    creditOrder(s, 'herring');
    const cost = trackCost(s.boats[0], 'hold')!;
    buyBoatUpgrade(s, 1, 'hold');
    s.stats.spoiled = 2;
    s.dayTime = 359.9;
    s.lastPhase = 'night';
    const end = step(s, 0.2, new Rng(1)).find((e) => e.type === 'dayEnded');
    if (!end || end.type !== 'dayEnded') throw new Error('no dayEnded');
    const st = end.stats;
    expect(st.income.herring).toBe(6);
    expect(st.income.lobster).toBeGreaterThan(100);
    expect(st.bonus).toBe(50);
    expect(st.spent).toBe(cost);
    expect(st.wages).toBe(40);
    expect(st.spoiled).toBe(2);
    expect(st.best).toEqual({ species: 'lobster', price: 90 });
    expect(netProfit(st)).toBe(st.earned - 40 - cost);
    expect(s.stats.earned).toBe(0);
    expect(s.stats.income.lobster).toBe(0);
  });
});
