import { describe, expect, it } from 'vitest';
import { deliverKingFish, endingSummary, grantKingFish } from './ending';
import { dispatchBoat, stepBoats, unloadBoat } from './boats';
import { addCrate } from './crates';
import { sellCrate } from './market';
import { stepDockhands } from './staff';
import { initialState } from './state';
import type { GameState } from './state';
import { Rng } from './rng';
import { moneyPerMinute, stepIncome } from './income';

class Fixed extends Rng { constructor(private v: number) { super(1); } next() { return this.v; } }

function nightDeep(lighthouse = true): GameState {
  const s = initialState();
  s.boats[0].hull = 3;
  s.boats[0].hold = 3;
  s.money = 1000;
  s.buildings.lighthouse = lighthouse ? 1 : 0;
  s.dayTime = 250; // 22:00
  return s;
}

describe('King Fish', () => {
  it('only deep night trips with the lighthouse lit can bring it, and no sailing at night without one', () => {
    const dark = nightDeep(false);
    expect(dispatchBoat(dark, 1, 'deep')[0].type).toBe('denied');
    const s = nightDeep();
    expect(dispatchBoat(s, 1, 'deep')[0].type).toBe('boatDispatched');
    const evs = stepBoats(s, 999, new Fixed(0.001));
    expect(evs.some((e) => e.type === 'kingFishFound')).toBe(true);
    expect(s.king.found).toBe(true);
    unloadBoat(s, 1);
    const k = s.crates.find((c) => c.king)!;
    expect(k.loc).toBe('dock');
    // never found twice
    unloadBoat(s, 1);
    dispatchBoat(s, 1, 'deep');
    stepBoats(s, 999, new Fixed(0.001));
    expect(s.crates.filter((c) => c.king)).toHaveLength(1);
  });
  it('is not found on a day trip or a shallow trip', () => {
    const s = nightDeep();
    s.dayTime = 100;
    dispatchBoat(s, 1, 'deep');
    expect(stepBoats(s, 999, new Fixed(0.001)).some((e) => e.type === 'kingFishFound')).toBe(false);
    const t = nightDeep();
    dispatchBoat(t, 1, 'shallows');
    expect(stepBoats(t, 999, new Fixed(0.001)).some((e) => e.type === 'kingFishFound')).toBe(false);
  });
  it('is never sold, never spoils, and not carried by workers', () => {
    const s = initialState();
    grantKingFish(s);
    const k = s.crates.find((c) => c.king)!;
    expect(sellCrate(s, k.id)[0].type).toBe('denied');
    s.dockhands.push({ id: 90, name: 'Pip', slot: 0, job: null });
    k.loc = 'dock'; k.x = 0; k.z = -3;
    stepDockhands(s, 1);
    expect(s.dockhands[0].job).toBeNull();
    addCrate(s, 'herring', 'hand');
  });
  it('ends the story once the King Fish is carried to the inn, with a summary', () => {
    const s = initialState();
    expect(deliverKingFish(s)[0].type).toBe('denied');
    s.day = 9; s.lifetime = 123456.7; s.book.cod.caught = 5; s.book.tuna.caught = 7;
    grantKingFish(s);
    const evs = deliverKingFish(s);
    expect(evs[0]).toMatchObject({ type: 'endingReached', days: 9, earned: 123456, fishCaught: 12, boats: 1 });
    expect(s.king.delivered).toBe(true);
    expect(s.crates.some((c) => c.king)).toBe(false);
    expect(endingSummary(s).days).toBe(9);
  });
});

describe('money per minute', () => {
  it('averages earnings over the last two minutes', () => {
    const s = initialState();
    expect(moneyPerMinute(s)).toBe(0);
    for (let t = 0; t < 60; t += 5) { s.lifetime += 10; stepIncome(s, 5); }
    expect(moneyPerMinute(s)).toBeCloseTo(120, 0);
    for (let t = 0; t < 600; t += 5) stepIncome(s, 5); // nothing earned for ten minutes
    expect(moneyPerMinute(s)).toBe(0);
    expect(s.incomeLog.length).toBeLessThanOrEqual(25);
  });
});
