import { describe, expect, it } from 'vitest';
import { addCrate } from './crates';
import { crateValue, recoverDemand, sellAll, sellCrate, unitPrice } from './market';
import { initialState } from './state';

describe('market', () => {
  it('price = base x freshness x demand', () => {
    const s = initialState();
    s.demand.mackerel = 0.8;
    expect(unitPrice(s, 'mackerel', 50)).toBeCloseTo(10 * 0.65 * 0.8);
  });
  it('each sale drops demand by 0.06 down to a floor of 0.5, and pays money', () => {
    const s = initialState();
    const c = addCrate(s, 'lobster', 'hand');
    sellCrate(s, c.id);
    expect(s.money).toBe(90);
    expect(s.demand.lobster).toBeCloseTo(0.94);
    expect(s.book.lobster.bestSale).toBe(90);
    s.demand.lobster = 0.52;
    sellCrate(s, addCrate(s, 'lobster', 'hand').id);
    expect(s.demand.lobster).toBe(0.5);
  });
  it('demand recovers 0.02 per 10 s up to 1.0', () => {
    const s = initialState();
    s.demand.herring = 0.9;
    recoverDemand(s, 10);
    expect(s.demand.herring).toBeCloseTo(0.92);
    recoverDemand(s, 100);
    expect(s.demand.herring).toBe(1);
  });
  it('spoiled crates are worth nothing and are binned on sale', () => {
    const s = initialState();
    const c = addCrate(s, 'lobster', 'hand');
    c.freshness = 0;
    expect(crateValue(s, c)).toBe(0);
    sellAll(s);
    expect(s.money).toBe(0);
    expect(s.crates).toHaveLength(0);
  });
  it('sell all with nothing in hand is denied', () => {
    expect(sellAll(initialState())[0].type).toBe('denied');
  });
});
