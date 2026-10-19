import { describe, expect, it } from 'vitest';
import { initialState } from '../../sim/state';
import { marketScreen } from './market';
import { MARKET_TEXT } from '../screenText';

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
});
