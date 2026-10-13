import { describe, expect, it } from 'vitest';
import { carryCapacity } from './crates';
import { initialState } from './state';
import { zoneUnlocked } from './boats';
import { buyUpgrade, canBuy } from './upgrades';
import { buyBoat, buyBoatUpgrade, canBuyBoat, holdSize, trackCost, tripTimeFor, rareMult } from './fleet';
import { stallLevel } from './market';
import { DEMAND_DROPS } from './config';
import { sellCrate } from './market';
import { addCrate } from './crates';

describe('harbour upgrades', () => {
  it('cannot buy without enough money, and spends the cost when bought', () => {
    const s = initialState();
    expect(buyUpgrade(s, 'icebox')[0].type).toBe('denied');
    s.money = 130;
    expect(buyUpgrade(s, 'icebox')[0].type).toBe('upgradeBought');
    expect(s.money).toBe(10);
    expect(s.stats.spent).toBe(120);
    expect(canBuy(s, 'icebox').ok).toBe(false);
  });
  it('handcart raises carrying capacity', () => {
    const s = initialState();
    s.money = 500;
    buyUpgrade(s, 'handcart');
    expect(carryCapacity(s)).toBe(4);
  });
  it('market stall is rank-gated, sequential and softens the demand drop', () => {
    const s = initialState();
    s.money = 20000;
    expect(buyUpgrade(s, 'stall1')[0].type).toBe('denied'); // rank 0
    s.lifetime = 3000;
    expect(buyUpgrade(s, 'stall2')[0].type).toBe('denied'); // needs stall I (and rank 3)
    expect(buyUpgrade(s, 'stall1')[0].type).toBe('upgradeBought');
    expect(stallLevel(s)).toBe(1);
    s.lifetime = 15000;
    buyUpgrade(s, 'stall2');
    expect(stallLevel(s)).toBe(2);
    const c = addCrate(s, 'herring', 'hand');
    sellCrate(s, c.id);
    expect(s.demand.herring).toBeCloseTo(1 - DEMAND_DROPS[2]);
  });
});

describe('per-boat upgrades', () => {
  it('each track changes that boat only', () => {
    const s = initialState();
    s.lifetime = 3000;
    s.money = 100000;
    expect(buyBoat(s)[0].type).toBe('boatBought');
    expect(s.boats).toHaveLength(2);
    expect(s.boats[1].berth).toBe(1);
    buyBoatUpgrade(s, 1, 'hold');
    buyBoatUpgrade(s, 1, 'hold');
    expect(holdSize(s.boats[0])).toBe(8);
    expect(holdSize(s.boats[1])).toBe(4);
    buyBoatUpgrade(s, 1, 'sails');
    expect(tripTimeFor(s.boats[0], 'shallows')).toBeCloseTo(25 * 0.85);
    buyBoatUpgrade(s, 1, 'gear');
    expect(rareMult(s.boats[0])).toBe(1.5);
  });
  it('hull tier unlocks zones for that boat and needs rank', () => {
    const s = initialState();
    s.money = 100000;
    expect(buyBoatUpgrade(s, 1, 'hull')[0].type).toBe('denied'); // rank 0
    s.lifetime = 500;
    expect(buyBoatUpgrade(s, 1, 'hull')[0].type).toBe('boatUpgraded');
    expect(zoneUnlocked(s, 'reef')).toBe(true);
    expect(buyBoatUpgrade(s, 1, 'hull')[0].type).toBe('denied'); // cutter needs rank 2
    s.lifetime = 3000;
    buyBoatUpgrade(s, 1, 'hull');
    s.lifetime = 15000;
    buyBoatUpgrade(s, 1, 'hull');
    expect(s.boats[0].hull).toBe(3);
    expect(zoneUnlocked(s, 'deep')).toBe(true);
    expect(buyBoatUpgrade(s, 1, 'hull')[0].type).toBe('denied'); // maxed
  });
  it('upgrade costs rise with the hull tier and a boat must be in harbour', () => {
    const s = initialState();
    const base = trackCost(s.boats[0], 'hold')!;
    s.boats[0].hull = 2;
    expect(trackCost(s.boats[0], 'hold')!).toBeGreaterThan(base);
    s.money = 100000;
    s.boats[0].status = 'out';
    expect(buyBoatUpgrade(s, 1, 'hold')[0].type).toBe('denied');
  });
  it('boat count is gated by rank and capped at four', () => {
    const s = initialState();
    s.money = 100000;
    expect(canBuyBoat(s).ok).toBe(false);
    for (const [life, n] of [[500, 2], [3000, 3], [15000, 4]] as const) {
      s.lifetime = life;
      buyBoat(s);
      expect(s.boats).toHaveLength(n);
    }
    expect(buyBoat(s)[0].type).toBe('denied');
    expect(new Set(s.boats.map((b) => b.berth)).size).toBe(4);
  });
});
