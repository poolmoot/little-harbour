import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import {
  buyUpgrade, castLine, dispatchBoat, dockCrates, handCrates, hook, initialState, pickUp, sellAll, startGame, step, unloadBoat,
} from './sim';

describe('whole-sim playthrough', () => {
  it('survives 12 in-game days of scripted play with sane state', () => {
    const rng = new Rng(77);
    const s = initialState();
    startGame(s, rng);
    expect(s.orders).toHaveLength(2);
    let days = 0;
    for (let t = 0; t < 360 * 12; t += 0.1) {
      for (const e of step(s, 0.1, rng)) if (e.type === 'dayEnded') days++;
      if (Math.round(t * 10) % 20 === 0) {
        for (const b of s.boats) {
          if (b.status === 'returned') unloadBoat(s, b.id);
          else if (b.status === 'docked') dispatchBoat(s, b.id, s.upgrades.hull ? 'reef' : 'shallows');
        }
        for (const c of dockCrates(s)) pickUp(s, c.id);
        sellAll(s);
        castLine(s, rng);
        hook(s, rng);
        for (const u of ['handcart', 'hold1', 'hull', 'boat2', 'hold2', 'icebox'] as const) buyUpgrade(s, u);
      }
      if (t % 60 === 0) expect(Number.isFinite(s.money)).toBe(true);
    }
    expect(days).toBe(12);
    expect(s.money).toBeGreaterThan(0);
    expect(s.orders.length).toBeLessThanOrEqual(2);
    expect(handCrates(s).length).toBeLessThanOrEqual(4);
    expect(s.crates.every((c) => c.freshness >= 0 && c.freshness <= 100)).toBe(true);
    expect(Object.values(s.demand).every((d) => d >= 0.5 && d <= 1)).toBe(true);
  });
});
