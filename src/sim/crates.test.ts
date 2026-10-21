import { describe, expect, it } from 'vitest';
import { DOCK_BIN_SIZE } from './config';
import { addCrate, binCrates, carryCapacity, pickUpBin, decayCrates, discardSpoiled, freshnessMultiplier, handCrates, pickUp, storeInIce, takeFromIce, iceCrates } from './crates';
import { initialState } from './state';

describe('crates', () => {
  it('price multiplier runs 1.0 -> 0.3', () => {
    expect(freshnessMultiplier(100)).toBe(1);
    expect(freshnessMultiplier(0)).toBeCloseTo(0.3);
    expect(freshnessMultiplier(50)).toBeCloseTo(0.65);
  });
  it('decays over 150 s on the dock and in hand, 600 s in the ice box', () => {
    const s = initialState();
    s.tally.sold = 1; // past the gentle start
    s.upgrades.icebox = true;
    const dock = addCrate(s, 'herring', 'dock');
    const hand = addCrate(s, 'herring', 'hand');
    const ice = addCrate(s, 'herring', 'ice');
    decayCrates(s, 75);
    expect(dock.freshness).toBeCloseTo(50);
    expect(hand.freshness).toBeCloseTo(50);
    expect(ice.freshness).toBeCloseTo(87.5);
  });
  it('spoils at zero, counts it once, and discards at rollover', () => {
    const s = initialState();
    s.tally.sold = 1;
    const c = addCrate(s, 'lobster', 'dock');
    const evs = decayCrates(s, 200);
    expect(evs.filter((e) => e.type === 'crateSpoiled')).toHaveLength(1);
    expect(decayCrates(s, 10)).toHaveLength(0);
    expect(s.stats.spoiled).toBe(1);
    expect(c.freshness).toBe(0);
    discardSpoiled(s);
    expect(s.crates).toHaveLength(0);
  });
  it('carry limit is 2, or 4 with the handcart', () => {
    const s = initialState();
    const ids = [1, 2, 3].map(() => addCrate(s, 'herring', 'dock').id);
    expect(pickUp(s, ids[0])[0].type).toBe('cratePicked');
    pickUp(s, ids[1]);
    expect(pickUp(s, ids[2])[0].type).toBe('denied');
    s.upgrades.handcart = true;
    expect(carryCapacity(s)).toBe(4);
    expect(pickUp(s, ids[2])[0].type).toBe('cratePicked');
  });
  it('picking up a spoiled crate discards it', () => {
    const s = initialState();
    const c = addCrate(s, 'herring', 'dock');
    c.freshness = 0;
    expect(pickUp(s, c.id)[0].type).toBe('crateDiscarded');
    expect(s.crates).toHaveLength(0);
  });
  it('ice box needs buying, holds 6, and swaps with the hand', () => {
    const s = initialState();
    const c = addCrate(s, 'herring', 'hand');
    expect(storeInIce(s, c.id)[0].type).toBe('denied');
    s.upgrades.icebox = true;
    expect(storeInIce(s, c.id)[0].type).toBe('crateStored');
    expect(handCrates(s)).toHaveLength(0);
    for (let i = 0; i < 5; i++) addCrate(s, 'herring', 'ice');
    const extra = addCrate(s, 'herring', 'hand');
    expect(storeInIce(s, extra.id)[0].type).toBe('denied');
    expect(iceCrates(s)).toHaveLength(6);
    expect(takeFromIce(s, c.id)[0].type).toBe('crateTaken');
  });
  it('dock crates share a spot up to the bin size, then start the next spot', () => {
    const s = initialState();
    const first = Array.from({ length: DOCK_BIN_SIZE }, () => addCrate(s, 'herring', 'dock', 0));
    expect(first.every((c) => c.x === first[0].x && c.z === first[0].z)).toBe(true);
    expect(binCrates(s, first[0].x, first[0].z)).toHaveLength(DOCK_BIN_SIZE);
    const next = addCrate(s, 'herring', 'dock', 0);
    expect(next.x === first[0].x && next.z === first[0].z).toBe(false);
  });
  it('E on a spot picks up as many crates as the hands hold, freshest first, and a gap is filled again', () => {
    const s = initialState();
    const cs = Array.from({ length: 4 }, () => addCrate(s, 'herring', 'dock', 0));
    cs[2].freshness = 50;
    const evs = pickUpBin(s, cs[0].id);
    expect(evs.filter((e) => e.type === 'cratePicked')).toHaveLength(carryCapacity(s));
    expect(handCrates(s).some((c) => c.id === cs[2].id)).toBe(false); // the stale one stays
    const again = addCrate(s, 'mackerel', 'dock', 0);
    expect(again.x === cs[2].x && again.z === cs[2].z).toBe(true);
  });
});
