import { describe, expect, it } from 'vitest';
import { runBot } from './bot';
import { GOALS } from './config';

// Guards the economy: a greedy scripted player must reach each rank in a sane window.
// Also checks that trip costs never leave the player stuck (money stays positive) and that the Trawler is bought.
// Design targets (active play): 5 / 15 / 35 / 75 minutes for the four ranks, and the King Fish at the inn at about 90-100.
// The bounds here are deliberately loose so only real balance breakage fails; the tuned medians are in the
// Costs section of the business-stage spec and the Final numbers section of the tycoon-stage spec.
const WINDOWS: [number, number][] = [[2, 9], [9, 30], [22, 62], [45, 105]];

describe('pacing (scripted player)', () => {
  for (const seed of [11, 12]) {
    it(`reaches every rank in its window and the King Fish in time (seed ${seed})`, () => {
      const r = runBot(seed, 150);
      WINDOWS.forEach(([lo, hi], i) => {
        const m = r.rankMinutes[i + 1];
        expect(m, `rank ${i + 1} reached`).not.toBeNull();
        expect(m!).toBeGreaterThanOrEqual(lo);
        expect(m!).toBeLessThanOrEqual(hi);
      });
      expect(r.state.money).toBeGreaterThanOrEqual(0);
      // The biggest boat must be worth buying: the scripted player owns a Trawler by the top rank.
      expect(r.state.boats.filter((b) => b.hull === 3).length, 'trawlers bought').toBeGreaterThanOrEqual(1);
      // The tycoon stage: buildings, contracts and the King Fish are all used.
      expect(r.state.buildings.smokehouse, 'smokehouse').toBeGreaterThanOrEqual(1);
      expect(r.state.buildings.restaurant, 'restaurant').toBeGreaterThanOrEqual(1);
      expect(r.state.buildings.lighthouse, 'lighthouse').toBe(1);
      expect(r.state.tally.contracts, 'contracts finished').toBeGreaterThanOrEqual(1);
      expect(r.deliveredMinutes, 'King Fish at the inn').not.toBeNull();
      expect(r.deliveredMinutes!).toBeGreaterThanOrEqual(60);
      expect(r.deliveredMinutes!).toBeLessThanOrEqual(140);
      // Most goals are met on the way (a storm goal can wait for the weather).
      expect(r.state.goal).toBeGreaterThanOrEqual(GOALS.length - 7);
    }, 30000);
  }
});
