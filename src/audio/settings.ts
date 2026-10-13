/** Audio settings: volumes, mute, and saving them. Pure logic, no Web Audio. */

export type VolumeKey = 'master' | 'music' | 'ambience' | 'effects';

export interface AudioSettings {
  master: number;
  music: number;
  ambience: number;
  effects: number;
  muted: boolean;
}

/** Own localStorage key, apart from the game save and the quality setting. */
export const SETTINGS_KEY = 'harbour-audio-settings';

export const DEFAULT_SETTINGS: Readonly<AudioSettings> = {
  master: 0.8,
  music: 0.7,
  ambience: 0.8,
  effects: 0.8,
  muted: false,
};

/** The small part of localStorage we need (so tests can pass a fake). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/** Turns anything read from storage into valid settings; bad fields fall back to defaults. */
export function sanitizeSettings(raw: unknown): AudioSettings {
  const out: AudioSettings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const k of ['master', 'music', 'ambience', 'effects'] as const) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = clamp01(v);
  }
  if (typeof r.muted === 'boolean') out.muted = r.muted;
  return out;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage: KeyValueStorage | null = defaultStorage()): AudioSettings {
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AudioSettings, storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked: the setting just won't persist
  }
}

/** Slider position (0..1) to loudness. A squared curve feels even to the ear. */
export function volumeToGain(v: number): number {
  const c = clamp01(v);
  return c * c;
}

export interface BusGains {
  master: number;
  music: number;
  ambience: number;
  effects: number;
}

/** The gain each bus should have. Mute silences everything. */
export function busGains(s: AudioSettings): BusGains {
  if (s.muted) return { master: 0, music: 0, ambience: 0, effects: 0 };
  return {
    master: volumeToGain(s.master),
    music: volumeToGain(s.music),
    ambience: volumeToGain(s.ambience),
    effects: volumeToGain(s.effects),
  };
}

/** Holds the current settings, saves changes, and tells listeners. */
export class SettingsStore {
  private s: AudioSettings;
  private listeners: Array<(s: Readonly<AudioSettings>) => void> = [];

  constructor(private storage: KeyValueStorage | null = defaultStorage()) {
    this.s = loadSettings(storage);
  }

  get(): Readonly<AudioSettings> {
    return this.s;
  }

  setVolume(key: VolumeKey, v: number): void {
    this.s = { ...this.s, [key]: clamp01(v) };
    this.changed();
  }

  setMuted(muted: boolean): void {
    if (muted === this.s.muted) return;
    this.s = { ...this.s, muted };
    this.changed();
  }

  /** Returns the new muted state. */
  toggleMuted(): boolean {
    this.setMuted(!this.s.muted);
    return this.s.muted;
  }

  /** Called now with the current settings and again on every change. Returns an unsubscribe function. */
  subscribe(fn: (s: Readonly<AudioSettings>) => void): () => void {
    this.listeners.push(fn);
    fn(this.s);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private changed(): void {
    saveSettings(this.s, this.storage);
    for (const l of this.listeners) l(this.s);
  }
}
