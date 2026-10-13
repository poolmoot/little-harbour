import { describe, expect, it } from 'vitest';
import { addCrate } from './crates';
import { sellAll } from './market';
import { fillOrders, matchingOrder, reachableSpecies, spawnOrder, stepOrders } from './orders';
import { Rng } from './rng';
import { initialState } from './state';

describe('orders', () => {
  it('starts with two orders, qty 2-5, deadline 8-14 hours out', () => {
    const s = initialState();
    fillOrders(s, new Rng(1));
    expect(s.orders).toHaveLength(2);
    for (const o of s.orders) {
      expect(o.qty).toBeGreaterThanOrEqual(2);
      expect(o.qty).toBeLessThanOrEqual(5);
      expect(o.deadline).toBeGreaterThanOrEqual(120);
      expect(o.deadline).toBeLessThanOrEqual(210);
    }
    expect(spawnOrder(s, new Rng(2))).toHaveLength(0); // never more than 2
  });
  it('only asks for reachable species (no reef fish without the hull)', () => {
    const s = initialState();
    expect(reachableSpecies(s)).not.toContain('lobster');
    s.boats[0].hull = 1;
    expect(reachableSpecies(s)).toContain('lobster');
  });
  it('a matching sale pays double and completion pays a 50% bonus', () => {
    const s = initialState();
    s.money = 0;
    s.orders = [{ id: 99, species: 'mackerel', qty: 2, filled: 0, deadline: 1000, name: 'Marta', baseValue: 20 }];
    addCrate(s, 'mackerel', 'hand');
    addCrate(s, 'mackerel', 'hand');
    const evs = sellAll(s);
    // two crates: 20 each with the double (demand dips on the second: 10*0.94*2 -> 19)
    expect(evs.some((e) => e.type === 'orderFilled')).toBe(true);
    expect(s.money).toBe(20 + 19 + 10);
    expect(s.orders).toHaveLength(0);
    expect(s.stats.filled).toBe(1);
    expect(s.orderCooldowns).toEqual([20]);
  });
  it('non-matching species do not count', () => {
    const s = initialState();
    s.orders = [{ id: 1, species: 'mackerel', qty: 2, filled: 0, deadline: 1000, name: 'A', baseValue: 20 }];
    expect(matchingOrder(s, 'herring')).toBeNull();
  });
  it('a missed deadline removes the order, counts it, and a new one appears 20 s later', () => {
    const s = initialState();
    const rng = new Rng(4);
    fillOrders(s, rng);
    s.clock = 1000;
    const evs = stepOrders(s, 0, rng);
    expect(evs.filter((e) => e.type === 'orderMissed')).toHaveLength(2);
    expect(s.stats.missed).toBe(2);
    expect(s.orders).toHaveLength(0);
    stepOrders(s, 19, rng);
    expect(s.orders).toHaveLength(0);
    stepOrders(s, 1.5, rng);
    expect(s.orders).toHaveLength(2);
  });
});
