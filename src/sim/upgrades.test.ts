import { describe, expect, it } from 'vitest';
import { carryCapacity } from './crates';
import { holdSize, initialState } from './state';
import { zoneUnlocked } from './boats';
import { buyUpgrade, canBuy } from './upgrades';

describe('upgrades', () => {
  it('cannot buy without enough money, and spends the cost when bought', () => {
    const s = initialState();
    expect(buyUpgrade(s, 'icebox')[0].type).toBe('denied');
    s.money = 130;
    expect(buyUpgrade(s, 'icebox')[0].type).toBe('upgradeBought');
    expect(s.money).toBe(10);
    expect(s.upgrades.icebox).toBe(true);
    expect(canBuy(s, 'icebox').ok).toBe(false);
  });
  it('applies effects', () => {
    const s = initialState();
    s.money = 5000;
    buyUpgrade(s, 'handcart');
    expect(carryCapacity(s)).toBe(4);
    expect(buyUpgrade(s, 'hold2')[0].type).toBe('denied'); // needs Hold I
    buyUpgrade(s, 'hold1');
    expect(holdSize(s)).toBe(6);
    buyUpgrade(s, 'hold2');
    expect(holdSize(s)).toBe(8);
    expect(zoneUnlocked(s, 'reef')).toBe(false);
    buyUpgrade(s, 'hull');
    expect(zoneUnlocked(s, 'reef')).toBe(true);
    buyUpgrade(s, 'boat2');
    expect(s.boats).toHaveLength(2);
    expect(s.boats[1].berth).toBe(1);
  });
});
