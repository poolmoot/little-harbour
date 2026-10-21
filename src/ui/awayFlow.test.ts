import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../audio/settings';
import { initialState } from '../sim/sim';
import { awayPlan, countedUp, COUNT_SECONDS } from './awayFlow';
import { awayScreen } from './screens/away';
import type { ScreenCtx } from './screens/types';
import { AWAY, durationText } from './text';

const ctx = (over: Partial<ScreenCtx> = {}): ScreenCtx => ({
  state: initialState(), arg: 0, tab: '', confirmReset: false, quality: 'auto', summary: null,
  hasSave: false, confirmNew: false, audio: { ...DEFAULT_SETTINGS }, ...over,
});

describe('time away in plain words', () => {
  it('says minutes, hours and both', () => {
    expect(durationText(30)).toBe('1 minute');
    expect(durationText(120)).toBe('2 minutes');
    expect(durationText(3600)).toBe('1 hour');
    expect(durationText(7800)).toBe('2 hours 10 minutes');
    expect(durationText(3660)).toBe('1 hour 1 minute');
    expect(durationText(8 * 3600)).toBe('8 hours');
  });
  it('is used in the welcome line', () => {
    expect(AWAY.away(7800)).toBe('You were away for 2 hours 10 minutes.');
  });
});

describe('what happens when the player comes back', () => {
  const captained = () => { const s = initialState(); s.boats[0].captain = { id: 99, name: 'Ann', trait: 'swift' }; return s; };
  const ranked = () => { const s = initialState(); s.lifetime = 1_000_000; return s; };

  it('shows the welcome window when money was earned', () => {
    expect(awayPlan({ seconds: 600, earned: 40, perMinute: 4 }, captained(), false)).toBe('welcome');
  });
  it('shows nothing for a short absence', () => {
    expect(awayPlan(null, ranked(), false)).toBe('none');
  });
  it('gives the captain tip once, after more than 10 minutes with nothing earned and nobody hired', () => {
    expect(awayPlan({ seconds: 700, earned: 0, perMinute: 0 }, ranked(), false)).toBe('tip');
    expect(awayPlan({ seconds: 700, earned: 0, perMinute: 0 }, ranked(), true)).toBe('none');
    expect(awayPlan({ seconds: 500, earned: 0, perMinute: 0 }, ranked(), false)).toBe('none');
  });
  it('gives no tip when captains are not unlocked yet, or one is already hired', () => {
    expect(awayPlan({ seconds: 700, earned: 0, perMinute: 0 }, initialState(), false)).toBe('none');
    const s = captained();
    s.lifetime = 1_000_000;
    expect(awayPlan({ seconds: 700, earned: 0, perMinute: 0 }, s, false)).toBe('none');
  });
  it('counts up from 0 to the total and stays there', () => {
    expect(countedUp(500, 0)).toBe(0);
    expect(countedUp(500, COUNT_SECONDS / 2)).toBeGreaterThan(250);
    expect(countedUp(500, COUNT_SECONDS)).toBe(500);
    expect(countedUp(500, 99)).toBe(500);
  });
});

describe('welcome-back window', () => {
  const away = { seconds: 7800, earned: 1234, perMinute: 9.5 };
  it('shows the time, the money counter and the half-speed line', () => {
    const v = awayScreen(ctx({ away, age: 99 }));
    expect(v.body).toContain('2 hours 10 minutes');
    expect(v.body).toContain('+$1,234');
    expect(v.body).toContain('data-count="1234"');
    expect(v.body).toContain('half speed');
    expect(v.body).toContain('8 hours');
    expect(v.foot).toContain('data-act="close"');
  });
  it('starts the counter at zero', () => {
    expect(awayScreen(ctx({ away, age: 0 })).body).toContain('+$0');
  });
  it('shows the captain tip instead of money when asked', () => {
    const v = awayScreen(ctx({ away: { seconds: 900, earned: 0, perMinute: 0 }, arg: 1 }));
    expect(v.body).toContain('Hire a captain');
    expect(v.body).not.toContain('data-count');
  });
});
