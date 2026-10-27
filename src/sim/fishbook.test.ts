import { describe, expect, it } from 'vitest';
import { BOOK_REWARD_CAUGHT, BOOK_REWARD_STARS, FISH_SIZE, GOLDEN_MULT, SPECIES } from './config';
import { addCrate } from './crates';
import { bookCompletion, crateStars, goldenChance, midSize, recordCatch, rollSize, sizeMult, starsFor, stepBookRewards } from './fishbook';
import { crateValue } from './market';
import { Rng } from './rng';
import { loadGame, saveGame } from './save';
import type { StorageLike } from './save';
import { initialState } from './state';
import { smokeCrate } from './buildings';
import { destFor } from './routing';
import { rollBoatCatch } from './boats';
import { hook, castLine } from './fishing';

describe('sizes and stars', () => {
  it('rolls sizes inside the species range, middle sizes common, top rare', () => {
    const rng = new Rng(4);
    const [lo, hi] = FISH_SIZE.tuna;
    let top = 0, mid = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const sz = rollSize('tuna', rng);
      expect(sz).toBeGreaterThanOrEqual(lo);
      expect(sz).toBeLessThanOrEqual(hi);
      if (starsFor('tuna', sz) === 3) top++;
      if (sz > lo + (hi - lo) * 0.35 && sz < lo + (hi - lo) * 0.65) mid++;
    }
    expect(top / n).toBeGreaterThan(0.03);
    expect(top / n).toBeLessThan(0.09);
    expect(mid / n).toBeGreaterThan(0.4);
  });
  it('price nudge runs from -10% to +20%, normal in the middle', () => {
    const [lo, hi] = FISH_SIZE.cod;
    expect(sizeMult('cod', lo)).toBeCloseTo(0.9);
    expect(sizeMult('cod', hi)).toBeCloseTo(1.2);
    expect(sizeMult('cod', midSize('cod'))).toBeCloseTo(1, 1);
  });
  it('stars: top 10% of the range is 3 stars', () => {
    const [lo, hi] = FISH_SIZE.cod;
    expect(starsFor('cod', lo)).toBe(1);
    expect(starsFor('cod', lo + (hi - lo) * 0.7)).toBe(2);
    expect(starsFor('cod', lo + (hi - lo) * 0.9)).toBe(3);
    expect(starsFor('cod', hi)).toBe(3);
  });
  it('a bigger crate sells for more, a golden one for five times more', () => {
    const s = initialState();
    const plain = addCrate(s, 'tuna', 'hand');
    const big = addCrate(s, 'tuna', 'hand', 0, { size: FISH_SIZE.tuna[1] });
    const gold = addCrate(s, 'tuna', 'hand', 0, { golden: true });
    expect(crateValue(s, big)).toBeGreaterThan(crateValue(s, plain));
    expect(crateValue(s, gold)).toBe(Math.round(crateValue(s, plain) * GOLDEN_MULT));
    expect(crateStars(big)).toBe(3);
  });
  it('golden chance rises with Nets and a Lucky captain, and is 2% at base', () => {
    expect(goldenChance(1)).toBeCloseTo(0.02);
    expect(goldenChance(2.2 * 1.25)).toBeGreaterThan(goldenChance(2.2));
  });
  it('about 2% of boat crates are golden at base', () => {
    const s = initialState();
    s.boats[0].hold = 3;
    const rng = new Rng(9);
    let g = 0, n = 0;
    for (let i = 0; i < 400; i++) {
      s.boats[0].zone = 'shallows';
      rollBoatCatch(s, s.boats[0], rng);
      for (const f of s.boats[0].catchInfo!) { n++; if (f.golden) g++; }
    }
    expect(g / n).toBeGreaterThan(0.01);
    expect(g / n).toBeLessThan(0.035);
  });
  it('golden fish are never smoked, by hand or by workers', () => {
    const s = initialState();
    s.buildings.smokehouse = 1;
    const c = addCrate(s, 'herring', 'hand', 0, { golden: true });
    expect(smokeCrate(s, c.id)[0].type).toBe('denied');
    const d = addCrate(s, 'herring', 'dock', 0, { golden: true });
    expect(destFor(s, d)).toBe('market');
    expect(destFor(s, addCrate(s, 'herring', 'dock'))).toBe('smoke');
  });
  it('the pier gives sizes too', () => {
    const s = initialState();
    const rng = new Rng(3);
    castLine(s, rng);
    s.fishing = { phase: 'bite', timer: 1 };
    hook(s, rng);
    const c = s.crates[0];
    expect(c.size).toBeGreaterThanOrEqual(FISH_SIZE[c.species][0]);
    expect(s.book[c.species].biggest).toBe(c.size);
  });
});

describe('fish book', () => {
  it('records biggest, best stars, golden count and completion', () => {
    const s = initialState();
    recordCatch(s, 'herring', 20, false);
    recordCatch(s, 'herring', 30, true);
    expect(s.book.herring).toMatchObject({ caught: 2, biggest: 30, bestStars: 3, golden: 1 });
    expect(bookCompletion(s)).toEqual({ total: SPECIES.length, seen: 1, threeStar: 1, golden: 1 });
  });
  it('pays each zone reward once: all caught, then 3 stars on all', () => {
    const s = initialState();
    for (const sp of ['herring', 'mackerel', 'flounder'] as const) recordCatch(s, sp, FISH_SIZE[sp][0], false);
    const l0 = s.lifetime;
    const ev = stepBookRewards(s);
    expect(ev).toEqual([{ type: 'bookReward', zone: 'shallows', kind: 'caught', amount: BOOK_REWARD_CAUGHT.shallows }]);
    expect(s.lifetime - l0).toBe(BOOK_REWARD_CAUGHT.shallows);
    expect(stepBookRewards(s)).toEqual([]);
    for (const sp of ['herring', 'mackerel', 'flounder'] as const) recordCatch(s, sp, FISH_SIZE[sp][1], false);
    expect(stepBookRewards(s)).toEqual([{ type: 'bookReward', zone: 'shallows', kind: 'stars', amount: BOOK_REWARD_STARS.shallows }]);
    expect(stepBookRewards(s)).toEqual([]);
  });
});

describe('version 4 saves', () => {
  it('load intact: crates get a middle size and are not golden, complete zones are not paid again', () => {
    const d = new Map<string, string>();
    const st: StorageLike = { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
    const s = initialState();
    s.money = 777;
    s.lifetime = 4000;
    addCrate(s, 'cod', 'dock');
    s.book.herring.caught = 5; s.book.mackerel.caught = 5; s.book.flounder.caught = 5;
    saveGame(s, st);
    const raw = JSON.parse(d.get('harbour-game-save')!);
    raw.version = 4;
    delete raw.savedAt; delete raw.bookClaims;
    for (const c of raw.crates) delete c.size;
    for (const sp of Object.keys(raw.book)) raw.book[sp] = { caught: raw.book[sp].caught, bestSale: raw.book[sp].bestSale };
    d.set('harbour-game-save', JSON.stringify(raw));
    const l = loadGame(st, new Rng(1))!;
    expect(l.version).toBe(9);
    expect(l.money).toBe(777);
    expect(l.crates[0].size).toBe(midSize('cod'));
    expect(l.crates[0].golden).toBeUndefined();
    expect(l.book.herring).toMatchObject({ caught: 5, biggest: 0, bestStars: 0, golden: 0 });
    expect(l.savedAt).toBe(0);
    expect(l.bookClaims.shallows.caught).toBe(true);
    const before = l.money;
    expect(stepBookRewards(l)).toEqual([]);
    expect(l.money).toBe(before);
    expect(crateValue(l, l.crates[0])).toBeGreaterThan(0);
  });
});
