import { describe, expect, it } from 'vitest';
import {
  bellLevel, bellRings, bellStrokes, catchCheer, crowdLevel, decaySales, townMurmur,
  nextCallDelay, panFor, sellerCalls, sellerLevel, splashChance, wetnessStep,
} from './town';
import { LAYOUT } from '../sim/config';

describe('hour bell', () => {
  it('rings by day only, with one to four strokes', () => {
    expect(bellRings(3)).toBe(false);
    expect(bellRings(22)).toBe(false);
    expect(bellRings(12)).toBe(true);
    for (let h = 0; h < 24; h++) {
      expect(bellStrokes(h)).toBeGreaterThanOrEqual(1);
      expect(bellStrokes(h)).toBeLessThanOrEqual(4);
    }
    expect(new Set([8, 9, 10, 11].map(bellStrokes)).size).toBeGreaterThan(1);
  });
  it('is quieter far away but never silent', () => {
    expect(bellLevel(0)).toBeCloseTo(1);
    expect(bellLevel(60)).toBeCloseTo(0.2);
    expect(bellLevel(15)).toBeLessThan(bellLevel(5));
  });
});

describe('crowd', () => {
  it('grows with rank, sales and market day, and stays within 0..1', () => {
    expect(crowdLevel(0, 0, false)).toBeLessThan(crowdLevel(3, 0, false));
    expect(crowdLevel(0, 0, false)).toBeLessThan(crowdLevel(0, 8, false));
    expect(crowdLevel(0, 0, false)).toBeLessThan(crowdLevel(0, 0, true));
    expect(crowdLevel(99, 99, true)).toBe(1);
  });
  it('lets sales fade', () => {
    expect(decaySales(10, 40)).toBeCloseTo(5);
    expect(decaySales(10, 0)).toBe(10);
  });
  it('murmurs louder near the market than far away', () => {
    const m = LAYOUT.market;
    expect(townMurmur(0.5, m.x, m.z, 1)).toBeGreaterThan(townMurmur(0.5, m.x, m.z - 20, 1));
    expect(townMurmur(1, m.x, m.z, 1)).toBeLessThanOrEqual(1.5);
    expect(townMurmur(1, m.x, m.z, 0)).toBe(0);
    expect(townMurmur(0.5, LAYOUT.plots.restaurant.x, LAYOUT.plots.restaurant.z, 1)).toBeGreaterThan(0.3);
    expect(townMurmur(0.9, m.x, m.z, 1)).toBeGreaterThan(townMurmur(0.1, m.x, m.z, 1));
  });
});

describe('seller calls', () => {
  it('happen by day, louder close to the market, 20 to 60 seconds apart, sooner when busy', () => {
    expect(sellerCalls(12, 0)).toBe(true);
    expect(sellerCalls(23, 0)).toBe(false);
    expect(sellerCalls(12, 1)).toBe(false);
    const m = LAYOUT.market;
    expect(sellerLevel(m.x, m.z)).toBeGreaterThan(sellerLevel(m.x + 20, m.z));
    expect(sellerLevel(m.x + 50, m.z)).toBe(0);
    expect(nextCallDelay(1, 0)).toBeGreaterThanOrEqual(10);
    expect(nextCallDelay(0, 1)).toBeLessThanOrEqual(75);
    expect(nextCallDelay(1, 0.5)).toBeLessThan(nextCallDelay(0, 0.5));
  });
  it('pans towards the source', () => {
    expect(panFor(0, 20)).toBeGreaterThan(0);
    expect(panFor(0, -20)).toBeLessThan(0);
    expect(Math.abs(panFor(0, 500))).toBeLessThanOrEqual(0.7);
  });
});

describe('wet cobbles', () => {
  it('get wet in rain and dry over a few hours', () => {
    let w = 0;
    for (let i = 0; i < 100; i++) w = wetnessStep(w, 1, 1);
    expect(w).toBe(1);
    const dry = wetnessStep(w, 0, 15 * 1.5);
    expect(dry).toBeLessThan(1);
    expect(dry).toBeGreaterThan(0);
    expect(wetnessStep(1, 0, 3 * 15)).toBeCloseTo(0);
  });
  it('splashes only when wet, and not every step', () => {
    expect(splashChance(0.1)).toBe(0);
    expect(splashChance(1)).toBeGreaterThan(0);
    expect(splashChance(1)).toBeLessThan(0.5);
  });
});

describe('cheers', () => {
  it('only a big catch gets one', () => {
    expect(catchCheer(2)).toBe(0);
    expect(catchCheer(6)).toBe(1);
  });
});
