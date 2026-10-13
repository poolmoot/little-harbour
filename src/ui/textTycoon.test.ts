import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, GOALS, WEATHER_IDS } from '../sim/config';
import { BUILDING_DESC, BUILDING_LEVELS, BUILDING_NAME, GOAL_TEXT, WEATHER, contractText, specialDesc, specialName } from './text';

describe('tycoon wording', () => {
  it('has a line for every goal, building and weather', () => {
    for (const g of GOALS) expect(GOAL_TEXT[g.id], g.id).toBeTruthy();
    for (const b of BUILDING_IDS) {
      expect(BUILDING_NAME[b]).toBeTruthy();
      expect(BUILDING_DESC[b]).toBeTruthy();
      expect(BUILDING_LEVELS[b].length).toBeGreaterThan(0);
    }
    for (const w of WEATHER_IDS) expect(WEATHER[w].name).toBeTruthy();
  });
  it('words special days and contracts in plain English', () => {
    expect(specialName({ kind: 'market' })).toBe('Market day');
    expect(specialName({ kind: 'bigcatch', zone: 'reef' })).toContain('Coral Reef');
    expect(specialDesc({ kind: 'market' })).toContain('1.5');
    expect(contractText({ id: 1, species: 'cod', smoked: true, qty: 8, filled: 0, days: 2, deadline: 0, reward: 1200, baseValue: 480 })).toBe('Bring 8 crates of Cod (smoked) to the market in 2 days. Reward: $1200.');
  });
});
