import { describe, expect, it } from 'vitest';
import {
  buyBuilding, canBuyBuilding, collectSmoked, restaurantPrice, sellToRestaurant, setSmokeList, smokeCrate, stepSmokehouse,
} from './buildings';
import { addCrate, decayCrates, handCrates } from './crates';
import { sellCrate } from './market';
import { SMOKE_SECONDS } from './config';
import { Rng } from './rng';
import { initialState } from './state';
import type { GameState } from './state';
import { step, startGame } from './sim';

function rich(life = 70000): GameState {
  const s = initialState();
  s.lifetime = life;
  s.money = 100000;
  return s;
}

describe('buildings', () => {
  it('need the right rank and money, and have three levels (lighthouse one)', () => {
    const s = initialState();
    s.money = 100000;
    expect(canBuyBuilding(s, 'smokehouse')).toMatchObject({ ok: false, needRank: 1 });
    s.lifetime = 600;
    expect(buyBuilding(s, 'smokehouse')[0].type).toBe('buildingBuilt');
    expect(s.money).toBe(100000 - 900);
    expect(canBuyBuilding(s, 'restaurant')).toMatchObject({ ok: false, needRank: 2 });
    buyBuilding(s, 'smokehouse');
    buyBuilding(s, 'smokehouse');
    expect(s.buildings.smokehouse).toBe(3);
    expect(canBuyBuilding(s, 'smokehouse').ok).toBe(false);
    s.lifetime = 20000;
    buyBuilding(s, 'lighthouse');
    expect(s.buildings.lighthouse).toBe(1);
    expect(canBuyBuilding(s, 'lighthouse').reason).toBe('Maxed');
    s.money = 0;
    expect(canBuyBuilding(initialStateAt(1), 'smokehouse').reason).toBe('Not enough money');
  });
  it('smokehouse turns a crate into a smoked crate that sells for 1.6x and never spoils', () => {
    const s = rich();
    buyBuilding(s, 'smokehouse');
    const c = addCrate(s, 'tuna', 'hand');
    c.freshness = 40;
    expect(smokeCrate(s, c.id)[0].type).toBe('crateSmoking');
    decayCrates(s, 500);
    expect(c.freshness).toBe(40);
    stepSmokehouse(s, SMOKE_SECONDS[1] - 1);
    expect(collectSmoked(s, c.id)[0].type).toBe('denied');
    expect(stepSmokehouse(s, 2)[0].type).toBe('crateSmoked');
    expect(c.freshness).toBe(100);
    decayCrates(s, 5000);
    expect(c.freshness).toBe(100);
    expect(collectSmoked(s, c.id)[0].type).toBe('crateTaken');
    const before = s.money;
    sellCrate(s, c.id);
    expect(s.money - before).toBe(Math.round(110 * 1.6));
    expect(smokeCrate(s, addCrate(s, 'cod', 'hand').id)[0].type).toBe('crateSmoking');
  });
  it('limits racks and refuses a smoked crate being smoked twice', () => {
    const s = rich();
    buyBuilding(s, 'smokehouse');
    const a = addCrate(s, 'cod', 'hand'), b = addCrate(s, 'cod', 'hand'), c = addCrate(s, 'cod', 'hand');
    smokeCrate(s, a.id);
    smokeCrate(s, b.id);
    expect(smokeCrate(s, c.id)[0].type).toBe('denied');
    stepSmokehouse(s, 100);
    collectSmoked(s, a.id);
    expect(smokeCrate(s, a.id)[0]).toMatchObject({ reason: 'That is already smoked.' });
    expect(handCrates(s).length).toBeGreaterThan(0);
  });
  it('smoke list is a toggle list starting with herring and mackerel', () => {
    const s = initialState();
    s.tally.sold = 1;
    expect(s.smokeList).toEqual(['herring', 'mackerel']);
    setSmokeList(s, 'cod', true);
    setSmokeList(s, 'herring', false);
    expect(s.smokeList).toEqual(['mackerel', 'cod']);
  });
  it('restaurant pays 2x for fresh fish, 10% more per other fish served, up to a daily limit', () => {
    const s = rich();
    s.lifetime = 5000;
    buyBuilding(s, 'restaurant');
    const stale = addCrate(s, 'cod', 'hand');
    stale.freshness = 79;
    expect(sellToRestaurant(s, stale.id)[0].type).toBe('denied');
    const demandBefore = s.demand.cod;
    const m = s.money;
    const c1 = addCrate(s, 'cod', 'hand');
    expect(restaurantPrice(s, c1)).toBe(120);
    sellToRestaurant(s, c1.id);
    expect(s.money - m).toBe(120);
    expect(s.demand.cod).toBe(demandBefore);
    const c2 = addCrate(s, 'tuna', 'hand');
    expect(restaurantPrice(s, c2)).toBe(Math.round(110 * 2 * 1.1));
    for (let i = 0; i < 4; i++) sellToRestaurant(s, addCrate(s, 'cod', 'hand').id);
    expect(s.restaurant.served).toBe(5);
    sellToRestaurant(s, c2.id);
    expect(sellToRestaurant(s, addCrate(s, 'cod', 'hand').id)[0].type).toBe('denied'); // 6 a day at level 1
  });
  it('the restaurant starts again each day', () => {
    const s = rich();
    buyBuilding(s, 'restaurant');
    const r = new Rng(1);
    startGame(s, r);
    s.restaurant = { served: 6, kinds: ['cod'] };
    s.dayTime = 359.9;
    s.lastPhase = 'night';
    step(s, 0.2, r);
    expect(s.restaurant).toEqual({ served: 0, kinds: [] });
  });
});

function initialStateAt(rank: number): GameState {
  const s = initialState();
  s.lifetime = [0, 600][rank];
  return s;
}
