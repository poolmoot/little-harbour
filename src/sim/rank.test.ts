import { describe, expect, it } from 'vitest';
import { rankIndex, rankProgress, stepRank } from './rank';
import { initialState } from './state';
import { sellCrate } from './market';
import { addCrate } from './crates';
import { creditOrder } from './orders';

describe('rank', () => {
  it('maps lifetime earnings to the five ranks', () => {
    expect([0, 499, 500, 3299, 3300, 17999, 18000, 71999, 72000].map(rankIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  });
  it('sales and order bonuses add to lifetime earnings; spending does not subtract', () => {
    const s = initialState();
    const c = addCrate(s, 'lobster', 'hand');
    sellCrate(s, c.id);
    expect(s.lifetime).toBe(90);
    s.orders = [{ id: 9, species: 'herring', qty: 1, filled: 0, deadline: 999, name: 'Marta', baseValue: 100 }];
    creditOrder(s, 'herring');
    expect(s.lifetime).toBe(140);
    s.money = 0;
    expect(s.lifetime).toBe(140);
  });
  it('announces each new rank once, and reports progress', () => {
    const s = initialState();
    expect(stepRank(s)).toHaveLength(0);
    s.lifetime = 3500;
    const evs = stepRank(s);
    expect(evs.map((e) => e.type === 'rankUp' && e.rank)).toEqual([1, 2]);
    expect(stepRank(s)).toHaveLength(0);
    expect(rankProgress(s)!.frac).toBeCloseTo(200 / 14700);
    s.lifetime = 80000;
    expect(rankProgress(s)).toBeNull();
  });
});
