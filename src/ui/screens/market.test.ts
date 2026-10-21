import { describe, expect, it } from 'vitest';
import { initialState } from '../../sim/state';
import { marketScreen } from './market';
import { MARKET_TEXT } from '../screenText';
import { crateValue, priceParts } from '../../sim/market';

const ctx = (state: ReturnType<typeof initialState>) => ({ state, arg: 0, tab: '', confirmReset: false, summary: null }) as unknown as Parameters<typeof marketScreen>[0];

describe('market window', () => {
  it('shows two boxes: the fish you carry and today\'s prices', () => {
    const v = marketScreen(ctx(initialState()));
    expect(v.body).toContain(MARKET_TEXT.yourFish);
    expect(v.body).toContain(MARKET_TEXT.prices);
    expect(v.tabs).toBeUndefined();
  });

  it('explains how to get fish when the hands are empty, and has no Sell all', () => {
    const v = marketScreen(ctx(initialState()));
    expect(v.body).toContain(MARKET_TEXT.emptyTitle);
    expect(v.foot).not.toContain('sellall');
  });

  it('gives each carried crate its own Sell button and offers Sell all as the main action', () => {
    const s = initialState();
    s.crates.push({ id: 900, species: 'herring', freshness: 90, loc: 'hand' } as (typeof s.crates)[number]);
    const v = marketScreen(ctx(s));
    expect(v.body).toContain('data-act="sell"');
    expect(v.foot).toContain('data-act="sellall"');
    expect(v.foot).toMatch(/\bhero\b/);
  });

  it('shows the big "Here you sell your fish" message until the first sale', () => {
    const s = initialState();
    expect(marketScreen(ctx(s)).body).toContain(MARKET_TEXT.helloTitle);
    s.tally.sold = 1;
    expect(marketScreen(ctx(s)).body).not.toContain(MARKET_TEXT.helloTitle);
  });

  it('writes a crate price out as money lines that add up to what you get', () => {
    const s = initialState();
    s.demand.cod = 0.9;
    const c = { id: 901, species: 'cod', freshness: 70, loc: 'hand', size: 100 } as (typeof s.crates)[number];
    s.crates.push(c);
    const parts = priceParts(s, c);
    expect(parts[0]).toEqual({ kind: 'base', amount: 60 });
    expect(parts.some((p) => p.kind === 'fresh' && p.amount < 0)).toBe(true);
    expect(parts.some((p) => p.kind === 'demand' && p.amount < 0)).toBe(true);
    expect(parts.reduce((a, p) => a + p.amount, 0)).toBe(crateValue(s, c));
    const body = marketScreen(ctx(s)).body;
    expect(body).toContain(MARKET_TEXT.part.demand);
    expect(body.replace(/<[^>]*>/g, ' ')).not.toMatch(/\d%(?! fresh)/); // no percentages in the words, except freshness
  });
});

