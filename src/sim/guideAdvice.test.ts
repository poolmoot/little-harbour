import { describe, expect, it } from 'vitest';
import { HOUR_SECONDS, START_HOUR } from './config';
import { tripCostFor } from './fleet';
import { addCrate } from './crates';
import { guideAdvice } from './guideAdvice';
import { GUIDE_STEPS } from './guide';
import { initialState } from './state';

const at = (id: string) => { const s = initialState(); s.guide.step = GUIDE_STEPS.findIndex((x) => x.id === id); s.dayTime = (12 - START_HOUR) * HOUR_SECONDS; return s; };

describe('guide advice', () => {
  it('has none when the step can just be done', () => {
    expect(guideAdvice(at('send'))).toBeNull();
    expect(guideAdvice(at('walk'))).toBeNull();
  });
  it('send: too poor for the trip means fish from the pier, with the gap', () => {
    const s = at('send');
    s.money = tripCostFor('shallows') - 1;
    expect(guideAdvice(s)).toMatchObject({ why: 'cost', how: 'pier', target: 'pierEnd', need: { have: s.money } });
  });
  it('send: night makes no difference, boats can sail', () => {
    const s = at('send');
    s.dayTime = (23 - START_HOUR) * HOUR_SECONDS;
    expect(guideAdvice(s)).toBeNull();
  });
  it('space: not enough money shows the gap and how to earn, in order', () => {
    const s = at('space');
    s.money = 20;
    expect(guideAdvice(s)).toMatchObject({ why: 'cost', how: 'send', need: { have: 20, cost: 110 } });
    s.money = 0;
    expect(guideAdvice(s)).toMatchObject({ how: 'pier', need: { have: 0 } });
    s.money = 50;
    s.boats[0].status = 'docked';
    addCrate(s, 'cod', 'dock');
    expect(guideAdvice(s)!.how).toBe('pickup');
    addCrate(s, 'cod', 'hand');
    expect(guideAdvice(s)!.how).toBe('carry');
    s.boats[0].status = 'returned';
    expect(guideAdvice(s)!.how).toBe('unload');
  });
  it('space: affordable means no advice', () => {
    const s = at('space');
    s.money = 500;
    expect(guideAdvice(s)).toBeNull();
  });
});
