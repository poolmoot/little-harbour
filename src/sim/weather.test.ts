import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { initialState } from './state';
import { startGame, step } from './sim';
import { bigCatchExtra, marketMult, rollNewDay, rollSpecial, rollWeather } from './weather';
import { dispatchBoat, stepBoats } from './boats';
import { WEATHER_CHANCE } from './config';
import type { WeatherId } from './config';

describe('weather', () => {
  it('rolls close to the table chances and never a storm before day 4', () => {
    const r = new Rng(3);
    const n = 6000;
    const counts: Record<string, number> = { calm: 0, wind: 0, fog: 0, storm: 0 };
    for (let i = 0; i < n; i++) counts[rollWeather(10, r)]++;
    for (const w of Object.keys(counts) as WeatherId[]) expect(Math.abs(counts[w] / n - WEATHER_CHANCE[w] / 100)).toBeLessThan(0.03);
    for (let i = 0; i < 500; i++) expect(rollWeather(3, r)).not.toBe('storm');
  });
  it('rolls special days about one in six and one in five', () => {
    const r = new Rng(4);
    let market = 0, big = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const sp = rollSpecial(r);
      if (sp?.kind === 'market') market++;
      if (sp?.kind === 'bigcatch') big++;
    }
    expect(Math.abs(market / n - 1 / 6)).toBeLessThan(0.03);
    expect(Math.abs(big / n - 1 / 5)).toBeLessThan(0.03);
  });
  it('moves tomorrow into today at the new day and reports the forecast', () => {
    const s = initialState();
    const r = new Rng(5);
    startGame(s, r);
    s.nextWeather = 'fog';
    s.nextSpecial = { kind: 'market' };
    s.dayTime = 359.9;
    s.lastPhase = 'night';
    const evs = step(s, 0.2, r);
    expect(s.weather).toBe('fog');
    expect(s.special).toEqual({ kind: 'market' });
    const end = evs.find((e) => e.type === 'dayEnded');
    expect(end && end.type === 'dayEnded' && end.forecast?.weather).toBe('fog');
    expect(end && end.type === 'dayEnded' && end.forecast?.tomorrowWeather).toBe(s.nextWeather);
    expect(evs.some((e) => e.type === 'weatherChanged')).toBe(true);
    expect(rollNewDay(s, r).forecast.weather).toBe(s.weather);
  });
  it('changes trip length: good wind shorter, fog longer', () => {
    const times: Record<string, number> = {};
    for (const w of ['calm', 'wind', 'fog'] as WeatherId[]) {
      const s = initialState();
      s.weather = w;
      dispatchBoat(s, 1, 'shallows');
      times[w] = s.boats[0].tripTime;
    }
    expect(times.wind).toBeCloseTo(times.calm * 0.8);
    expect(times.fog).toBeCloseTo(times.calm * 1.25);
  });
  it('market day lifts prices, big catch adds crates in its zone only', () => {
    const s = initialState();
    s.special = { kind: 'market' };
    expect(marketMult(s)).toBe(1.5);
    s.special = { kind: 'bigcatch', zone: 'reef' };
    expect(bigCatchExtra(s, 'reef')).toBe(2);
    expect(bigCatchExtra(s, 'shallows')).toBe(0);
    s.boats[0].hull = 1;
    dispatchBoat(s, 1, 'reef');
    stepBoats(s, 999, new Rng(1));
    expect(s.boats[0].catch).toHaveLength(6); // 4 + 2
  });
});
