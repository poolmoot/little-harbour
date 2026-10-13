import { describe, expect, it } from 'vitest';
import { runBot } from './bot';

// Guards the economy: a greedy scripted player must reach each rank in a sane window.
// Also checks that trip costs never leave the player stuck (money stays positive) and that the Trawler is bought.
// Design targets (active play): 5 / 15 / 35 / 70 minutes. The bounds here are deliberately loose
// so only real balance breakage fails; the tuned medians are in the spec's Costs section.
const WINDOWS: [number, number][] = [[2, 9], [9, 30], [22, 62], [45, 105]];

describe('pacing (scripted player)', () => {
  for (const seed of [11, 12]) {
    it(`reaches every rank in its window (seed ${seed})`, () => {
      const r = runBot(seed, 115);
      WINDOWS.forEach(([lo, hi], i) => {
        const m = r.rankMinutes[i + 1];
        expect(m, `rank ${i + 1} reached`).not.toBeNull();
        expect(m!).toBeGreaterThanOrEqual(lo);
        expect(m!).toBeLessThanOrEqual(hi);
      });
      expect(r.state.money).toBeGreaterThanOrEqual(0);
      // The biggest boat must be worth buying: the scripted player owns a Trawler by the top rank.
      expect(r.state.boats.filter((b) => b.hull === 3).length, 'trawlers bought').toBeGreaterThanOrEqual(1);
    }, 30000);
  }
});
