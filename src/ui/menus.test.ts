import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../audio/settings';
import { initialState } from '../sim/sim';
import { HINTS, HOWTO, SETTINGS } from './menuText';
import { howtoScreen } from './screens/howto';
import { logbookScreen } from './screens/logbook';
import { pauseScreen } from './screens/pause';
import { settingsScreen } from './screens/settings';
import { titleScreen } from './screens/title';
import type { ScreenCtx } from './screens/types';

const ctx = (over: Partial<ScreenCtx> = {}): ScreenCtx => ({
  state: initialState(), arg: 0, tab: '', confirmReset: false, quality: 'auto', summary: null,
  hasSave: false, confirmNew: false, audio: { ...DEFAULT_SETTINGS }, ...over,
});
const acts = (html: string) => [...html.matchAll(/data-act="([a-z]+)"/g)].map((m) => m[1]);

describe('title screen', () => {
  it('offers New game, Settings and How to play, but not Continue, without a save', () => {
    expect(acts(titleScreen(ctx()).body)).toEqual(['newgame', 'settings', 'howto']);
  });

  it('offers Continue first, with the day and money, when a save exists', () => {
    const state = initialState();
    state.day = 4;
    state.money = 1234;
    const v = titleScreen(ctx({ state, hasSave: true }));
    expect(acts(v.body)).toEqual(['continue', 'newgame', 'settings', 'howto']);
    expect(v.body).toContain('Day 4');
    expect(v.body).toContain('$1,234');
  });

  it('asks before deleting a save for a new game', () => {
    const v = titleScreen(ctx({ hasSave: true, confirmNew: true }));
    expect(acts(v.body)).toEqual(['newyes', 'newno']);
  });

  it('is a menu without a close button or header', () => {
    const v = titleScreen(ctx());
    expect(v.menu).toBe(true);
    expect(v.bare).toBe(true);
  });
});

describe('pause menu', () => {
  it('has Resume, Settings, How to play and Back to title', () => {
    const v = pauseScreen(ctx());
    expect(acts(v.body)).toEqual(['resume', 'settings', 'howto', 'totitle']);
    expect(v.menu).toBe(true);
  });
});

describe('settings screen', () => {
  it('has one slider per volume, in order', () => {
    const h = settingsScreen(ctx()).body;
    expect([...h.matchAll(/data-slider="(\w+)"/g)].map((m) => m[1])).toEqual(['master', 'music', 'ambience', 'effects']);
  });

  it('shows the saved volumes', () => {
    const h = settingsScreen(ctx({ audio: { ...DEFAULT_SETTINGS, music: 0.3 } })).body;
    expect(h).toMatch(/value="30"[^>]*data-slider="music"/);
  });

  it('shows the mute switch as on or off', () => {
    expect(settingsScreen(ctx()).body).toContain(`>${SETTINGS.on}</button>`);
    expect(settingsScreen(ctx({ audio: { ...DEFAULT_SETTINGS, muted: true } })).body).toContain(`>${SETTINGS.off}</button>`);
  });

  it('has the four picture quality choices and marks the current one', () => {
    const h = settingsScreen(ctx({ quality: 'low' })).body;
    expect(h.match(/data-act="quality"/g)).toHaveLength(4);
    expect(h).toMatch(/class="btn ol sm"[^>]*data-act="quality" data-a="low"/);
  });

  it('asks before resetting', () => {
    expect(acts(settingsScreen(ctx()).body)).toContain('reset');
    const a = acts(settingsScreen(ctx({ confirmReset: true })).body);
    expect(a).toContain('resetyes');
    expect(a).toContain('resetno');
    expect(a).not.toContain('reset');
  });

  it('can go back', () => {
    expect(acts(settingsScreen(ctx()).foot ?? '')).toEqual(['menuback']);
  });
});

describe('how to play', () => {
  it('lists every key and all the tips', () => {
    const h = howtoScreen(ctx()).body;
    for (const k of ['W', 'A', 'S', 'D', 'E', 'L', 'M', 'Esc']) expect(h).toContain(`<span class="kbd">${k}</span>`);
    expect(h.match(/class="item"/g)).toHaveLength(HOWTO.tips.length);
    expect(HOWTO.tips.length).toBeGreaterThanOrEqual(5);
    expect(HOWTO.tips.length).toBeLessThanOrEqual(6);
  });

  it('describes the game in two sentences', () => {
    expect(HOWTO.about).toHaveLength(2);
  });
});

describe('fish book and hints', () => {
  it('no longer holds picture quality or reset', () => {
    const v = logbookScreen(ctx());
    expect(v.body + (v.foot ?? '')).not.toMatch(/data-act="(quality|reset)/);
  });

  it('mentions sound and the menu in the controls hint, kept short enough for one line', () => {
    expect(HINTS).toContain('M sound');
    expect(HINTS).toContain('Esc menu');
    expect(HINTS.length).toBeLessThan(70);
  });
});
