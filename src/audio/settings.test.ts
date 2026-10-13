import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, SETTINGS_KEY, SettingsStore, busGains, loadSettings, sanitizeSettings, saveSettings, volumeToGain,
} from './settings';
import type { KeyValueStorage } from './settings';

function fakeStorage(init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

describe('audio settings', () => {
  it('uses defaults when nothing is saved', () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('saves under its own key and loads back', () => {
    const st = fakeStorage();
    saveSettings({ master: 0.3, music: 0.2, ambience: 0.9, effects: 0.1, muted: true }, st);
    expect(Object.keys(st.data)).toEqual([SETTINGS_KEY]);
    expect(loadSettings(st)).toEqual({ master: 0.3, music: 0.2, ambience: 0.9, effects: 0.1, muted: true });
  });

  it('survives broken or odd saved data', () => {
    expect(loadSettings(fakeStorage({ [SETTINGS_KEY]: 'not json' }))).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ master: 5, music: -2, ambience: 'loud', effects: NaN, muted: 'yes' });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, master: 1, music: 0 });
  });

  it('does not throw when storage fails', () => {
    const bad: KeyValueStorage = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(loadSettings(bad)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, bad)).not.toThrow();
  });

  it('turns slider positions into gains and mute into silence', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(0.5)).toBeCloseTo(0.25);
    expect(volumeToGain(2)).toBe(1);
    expect(busGains({ ...DEFAULT_SETTINGS, muted: true })).toEqual({ master: 0, music: 0, ambience: 0, effects: 0 });
    expect(busGains({ ...DEFAULT_SETTINGS, music: 0.5 }).music).toBeCloseTo(0.25);
  });

  it('store clamps, saves and notifies', () => {
    const st = fakeStorage();
    const store = new SettingsStore(st);
    const seen: number[] = [];
    store.subscribe((s) => seen.push(s.music));
    store.setVolume('music', 3);
    store.setVolume('music', 0.4);
    expect(store.get().music).toBe(0.4);
    expect(seen).toEqual([DEFAULT_SETTINGS.music, 1, 0.4]);
    expect(store.toggleMuted()).toBe(true);
    expect(store.toggleMuted()).toBe(false);
    expect(loadSettings(st).music).toBe(0.4);
  });
});
