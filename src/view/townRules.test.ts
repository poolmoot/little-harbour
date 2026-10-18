import { describe, expect, it } from 'vitest';
import { wetnessStep } from '../audio/town';
import {
  CAPS, brushImpulse, catRub, catWantsPlayer, crowdSize, dinerCount, gullSettleDelay, gullTakeOffLevel, puddleSize,
  queueLength, raisesDust, strollerCount, terraceOpen, townIsAwake, weatherRain, wetLook,
} from './townRules';

const base = { stall: 0, recentSales: 0, demand: 1, hour: 12, weather: 'calm' as const, marketDay: false };

describe('market queue', () => {
  it('is empty at night and in a storm', () => {
    expect(queueLength({ ...base, hour: 23 }, 4)).toBe(0);
    expect(queueLength({ ...base, hour: 3 }, 4)).toBe(0);
    expect(queueLength({ ...base, weather: 'storm' }, 4)).toBe(0);
  });
  it('grows with stall level, sales and prices, and respects the cap', () => {
    const quiet = queueLength({ ...base, demand: 0.5 }, 4);
    const busy = queueLength({ ...base, stall: 2, recentSales: 12, demand: 1, marketDay: true }, 4);
    expect(quiet).toBeGreaterThanOrEqual(1);
    expect(busy).toBeGreaterThan(quiet);
    expect(busy).toBeLessThanOrEqual(4);
    expect(queueLength({ ...base, stall: 2, recentSales: 12, marketDay: true }, 2)).toBe(2);
  });
});

describe('restaurant terrace', () => {
  const t = { level: 3, served: 20, hour: 13, weather: 'calm' as const, recentServe: false };
  it('has nobody without a restaurant, when closed, or in a storm', () => {
    expect(dinerCount({ ...t, level: 0 }, 6)).toBe(0);
    expect(dinerCount({ ...t, hour: 4 }, 6)).toBe(0);
    expect(dinerCount({ ...t, weather: 'storm' }, 6)).toBe(0);
  });
  it('has two seats per table and fills in proportion to how many were served', () => {
    expect(dinerCount({ ...t, served: 0 }, 6)).toBe(0);
    expect(dinerCount({ ...t, served: 0, recentServe: true }, 6)).toBe(1);
    expect(dinerCount({ ...t, served: 10 }, 6)).toBeGreaterThan(dinerCount({ ...t, served: 3 }, 6));
    expect(dinerCount(t, 6)).toBe(6);
    expect(dinerCount({ ...t, level: 1, served: 6 }, 6)).toBe(2);
    expect(dinerCount(t, 2)).toBe(2);
  });
  it('is open into the evening', () => {
    expect(terraceOpen(20)).toBe(true);
    expect(townIsAwake(20)).toBe(false);
  });
});

describe('crowds', () => {
  it('only a big catch draws people, and a bigger one a bigger crowd', () => {
    expect(crowdSize('big', 4, 8)).toBe(0);
    expect(crowdSize('big', 5, 8)).toBe(3);
    expect(crowdSize('big', 11, 8)).toBe(6);
    expect(crowdSize('golden', 1, 8)).toBe(6);
    expect(crowdSize('king', 1, 8)).toBe(8);
    expect(crowdSize('king', 1, 3)).toBe(3);
  });
  it('strollers grow with rank, only by day, and thin out on lower quality', () => {
    expect(strollerCount(0, 12, 4)).toBe(0);
    expect(strollerCount(3, 12, 4)).toBe(3);
    expect(strollerCount(4, 12, 4)).toBe(4);
    expect(strollerCount(4, 12, CAPS.low.strollers)).toBe(0);
    expect(strollerCount(4, 22, 4)).toBe(0);
  });
  it('caps shrink as quality drops', () => {
    for (const k of ['queue', 'diners', 'crowd', 'strollers', 'particles'] as const) {
      expect(CAPS.high[k]).toBeGreaterThanOrEqual(CAPS.medium[k]);
      expect(CAPS.medium[k]).toBeGreaterThanOrEqual(CAPS.low[k]);
    }
  });
});

describe('wet cobbles', () => {
  it('rain comes only from a storm, and wetness follows the audio maths', () => {
    expect(weatherRain('storm')).toBe(1);
    expect(weatherRain('fog')).toBe(0);
    let wet = 0;
    for (let i = 0; i < 100; i++) wet = wetnessStep(wet, weatherRain('storm'), 0.25);
    expect(wet).toBe(1);
    for (let i = 0; i < 400; i++) wet = wetnessStep(wet, weatherRain('calm'), 0.25);
    expect(wet).toBe(0);
  });
  it('the stone darkens as it gets wet and puddles shrink away as it dries', () => {
    expect(wetLook(0).rough).toBeGreaterThan(wetLook(1).rough);
    expect(wetLook(1).tint[0]).toBeLessThan(wetLook(0).tint[0]);
    expect(puddleSize(1, 0.2)).toBe(1);
    expect(puddleSize(0.1, 0.2)).toBe(0);
    expect(puddleSize(0.4, 0.2)).toBeGreaterThan(0);
    expect(puddleSize(0.4, 0.2)).toBeLessThan(1);
    // a puddle with a high threshold is the first to dry
    expect(puddleSize(0.5, 0.4)).toBeLessThan(puddleSize(0.5, 0.1));
  });
  it('dust only on dry stone at a brisk pace', () => {
    expect(raisesDust(0, 5)).toBe(true);
    expect(raisesDust(0.6, 5)).toBe(false);
    expect(raisesDust(0, 1)).toBe(false);
  });
});

describe('reactions', () => {
  it('gulls leave louder when startled closer, and come back after a while', () => {
    expect(gullTakeOffLevel(0.5)).toBeGreaterThan(gullTakeOffLevel(1.8));
    expect(gullSettleDelay(0)).toBeGreaterThan(15);
    expect(gullSettleDelay(1)).toBeGreaterThan(gullSettleDelay(0));
  });
  it('a brush past swings a sign only when close and moving', () => {
    expect(brushImpulse(0.3, 1.5, 5)).toBeGreaterThan(brushImpulse(1.2, 1.5, 5));
    expect(brushImpulse(2, 1.5, 5)).toBe(0);
    expect(brushImpulse(0.3, 1.5, 0.1)).toBe(0);
  });
  it('the cat rubs side to side and only comes to a player near the market without fish', () => {
    const sides = Array.from({ length: 40 }, (_, i) => catRub(i * 0.1).side);
    expect(Math.min(...sides)).toBeLessThan(-0.3);
    expect(Math.max(...sides)).toBeGreaterThan(0.3);
    expect(catWantsPlayer(4, true, false, 60)).toBe(true);
    expect(catWantsPlayer(4, true, true, 60)).toBe(false);
    expect(catWantsPlayer(4, false, false, 60)).toBe(false);
    expect(catWantsPlayer(4, true, false, 5)).toBe(false);
    expect(catWantsPlayer(0.5, true, false, 60)).toBe(false);
  });
});
