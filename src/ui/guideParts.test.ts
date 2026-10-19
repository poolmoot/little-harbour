import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS, UNLOCKS } from '../sim/guide';
import { initialState } from '../sim/state';
import { GUIDE, STEP_TEXT, UNLOCK_TEXT } from './guideText';
import { helpEntries, stepCardHtml, unlockCardHtml, unlockTarget } from './guideParts';
import { helpScreen, tipsScreen, welcomeScreen } from './screens/guide';
import { settingsScreen } from './screens/settings';
import { loadGuideTips, saveGuideTips } from './guideSetting';
import { escapeAction } from './menuFlow';

describe('guide wording and cards', () => {
  it('has text for every step and every unlock', () => {
    for (const s of GUIDE_STEPS) expect(STEP_TEXT[s.id].line.length).toBeGreaterThan(5);
    for (const u of UNLOCKS) expect(UNLOCK_TEXT[u.id].title).toBeTruthy();
  });
  it('draws keycaps on a step card and a close button on an unlock card', () => {
    expect(stepCardHtml(0)).toContain('class="kbd">W<');
    expect(unlockCardHtml('workers')).toContain('data-guide="close"');
    expect(unlockTarget('workers')).toBe('inn');
    expect(unlockTarget('weather')).toBeNull();
  });
  it('the help list grows as the player is told things and each entry can be shown again', () => {
    const s = initialState();
    expect(helpEntries(s).map((e) => e.key)).toEqual(['step:0']);
    s.guide.welcomed = true; s.guide.step = 8; s.guide.seen.push('workers');
    const keys = helpEntries(s).map((e) => e.key);
    expect(keys).toContain('welcome');
    expect(keys).toContain('unlock:workers');
    expect(keys.filter((k) => k.startsWith('step:'))).toHaveLength(GUIDE_STEPS.length);
    const ctx = { state: s, guideTips: true } as never;
    expect(helpScreen(ctx).body).toContain('data-act="guidereplay"');
    expect(tipsScreen(ctx).menu).toBe(true);
  });
});

describe('guide screens and switch', () => {
  it('welcome has a go button and a skip button', () => {
    const f = welcomeScreen({} as never).foot!;
    expect(f).toContain('data-act="close"');
    expect(f).toContain('welcomeskip');
  });
  it('settings has the Show guide tips switch', () => {
    expect(settingsScreen({ state: initialState(), audio: { master: 1, music: 1, ambience: 1, effects: 1, muted: false }, quality: 'auto', confirmReset: false, guideTips: false } as never).body).toContain('data-act="guidetips"');
    expect(GUIDE.settingsTitle).toBe('Show guide tips');
  });
  it('the switch is on unless saved as off, and survives blocked storage', () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(loadGuideTips(st)).toBe(true);
    saveGuideTips(st, false);
    expect(loadGuideTips(st)).toBe(false);
    expect(loadGuideTips({ getItem: () => { throw new Error('x'); } })).toBe(true);
  });
  it('Esc steps back out of the tips list', () => {
    expect(escapeAction('paused', 'tips')).toBe('back');
  });
});
