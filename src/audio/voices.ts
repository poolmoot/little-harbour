/**
 * Vocal-like town sounds made from formant-filtered tones (a buzzing tone shaped by
 * three band-pass filters, like a vowel). It is never real speech, just the shape of
 * a call. Each syllable uses one engine voice and cleans up after itself.
 */
import type { AudioEngine } from './engine';
import type { Effects } from './effects';

type Vowel = readonly [number, number, number];
export const VOWELS = {
  a: [700, 1100, 2500], e: [450, 1900, 2600], i: [300, 2200, 3000],
  o: [450, 800, 2600], u: [325, 700, 2500], ae: [600, 1700, 2500],
} as const satisfies Record<string, Vowel>;
export type VowelName = keyof typeof VOWELS;

export interface Syllable {
  from: VowelName;
  to?: VowelName;
  f: number;
  f2?: number;
  dur: number;
  g: number;
  at?: number;
  pan?: number;
  bus?: GainNode;
  /** Wobble the pitch a little (crowds, chatter). */
  jit?: number;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export class Voices {
  constructor(private e: AudioEngine, private fx: Effects) {}

  /** One vowel-like syllable. */
  syllable(s: Syllable): void {
    const e = this.e;
    if (!e.takeVoice()) return;
    try {
      const c = e.ctx!;
      const t = c.currentTime + (s.at ?? 0) + Math.random() * 0.006;
      const k = 1 + (Math.random() * 2 - 1) * (s.jit ?? 0.02);
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(s.f * k, t);
      if (s.f2) osc.frequency.linearRampToValueAtTime(s.f2 * k, t + s.dur);
      const env = c.createGain();
      const atk = Math.min(0.04, s.dur * 0.3);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(s.g, t + atk);
      env.gain.setValueAtTime(s.g, t + s.dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
      const filters: BiquadFilterNode[] = [];
      const a = VOWELS[s.from], b = VOWELS[s.to ?? s.from];
      const weights = [1.6, 1.0, 0.5];
      for (let i = 0; i < 3; i++) {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 7;
        bp.frequency.setValueAtTime(a[i], t);
        bp.frequency.linearRampToValueAtTime(b[i], t + s.dur);
        const w = c.createGain();
        w.gain.value = weights[i];
        osc.connect(bp).connect(w).connect(env);
        filters.push(bp);
      }
      let pan: StereoPannerNode | null = null;
      const out = s.bus ?? e.fx;
      if (s.pan) {
        pan = c.createStereoPanner();
        pan.pan.value = s.pan;
        env.connect(pan).connect(out);
      } else {
        env.connect(out);
      }
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
        pan?.disconnect();
        for (const f of filters) f.disconnect();
        e.releaseVoice();
      };
      osc.start(t);
      osc.stop(t + s.dur + 0.05);
    } catch {
      e.releaseVoice();
    }
  }

  /** "Fre-esh fi-ish!" in three bobbing syllables with a soft hiss between them. */
  sellerCall(level: number, pan: number): void {
    const base = rnd(120, 175);
    const g = 0.05 * level;
    const o = { pan, jit: 0.03 };
    const kind = Math.floor(Math.random() * 2);
    if (kind === 0) {
      this.syllable({ from: 'e', to: 'i', f: base * 1.2, f2: base * 1.5, dur: 0.22, g, ...o });
      this.fx.noise({ dur: 0.1, g: g * 0.4, f0: 5000, filter: 'highpass', at: 0.22, pan });
      this.syllable({ from: 'i', to: 'e', f: base * 1.6, f2: base * 1.1, dur: 0.3, g, at: 0.3, ...o });
      this.syllable({ from: 'ae', to: 'o', f: base * 1.5, f2: base * 0.85, dur: 0.45, g: g * 1.1, at: 0.65, ...o });
    } else {
      this.syllable({ from: 'ae', f: base * 1.3, f2: base * 1.6, dur: 0.18, g, ...o });
      this.syllable({ from: 'ae', to: 'i', f: base * 1.7, f2: base * 1.3, dur: 0.22, g, at: 0.24, ...o });
      this.fx.noise({ dur: 0.12, g: g * 0.4, f0: 4500, filter: 'highpass', at: 0.5, pan });
      this.syllable({ from: 'e', to: 'a', f: base * 1.5, f2: base * 0.9, dur: 0.5, g: g * 1.1, at: 0.55, ...o });
    }
  }

  /** A townsperson calling "hel-lo!": two bright syllables going up then down. */
  wave(level = 1, pan = 0): void {
    const base = rnd(150, 230);
    const g = 0.045 * level;
    this.syllable({ from: 'e', to: 'ae', f: base, f2: base * 1.25, dur: 0.16, g, pan });
    this.syllable({ from: 'o', to: 'u', f: base * 1.35, f2: base * 1.0, dur: 0.34, g, at: 0.2, pan });
  }

  /** Crowd cheer: a pile of detuned "aah" voices rising, plus clapping. size 1 small, 2 bigger, 3 biggest. */
  cheer(size: 1 | 2 | 3): void {
    const voices = size === 1 ? 3 : size === 2 ? 5 : 7;
    const dur = size === 1 ? 1.2 : size === 2 ? 2.0 : 3.0;
    const g = 0.022;
    for (let i = 0; i < voices; i++) {
      const f = rnd(120, 280);
      this.syllable({
        from: 'o', to: 'a', f, f2: f * rnd(1.15, 1.35), dur: dur * rnd(0.75, 1), g,
        at: Math.random() * 0.25, pan: rnd(-0.6, 0.6), jit: 0.04,
      });
    }
    const claps = size === 1 ? 5 : size === 2 ? 9 : 12;
    for (let i = 0; i < claps; i++) {
      this.fx.noise({
        dur: 0.04, g: 0.03, f0: rnd(1500, 2600), q: 1.5, at: 0.3 + Math.random() * dur,
        pan: rnd(-0.6, 0.6), low: true,
      });
    }
    // A couple of bright whoops on the biggest cheers.
    if (size >= 2) {
      for (let i = 0; i < 2; i++) {
        const f = rnd(300, 380);
        this.syllable({ from: 'u', to: 'i', f, f2: f * 1.6, dur: 0.4, g: g * 0.9, at: 0.2 + i * 0.35, pan: rnd(-0.5, 0.5) });
      }
    }
  }

  /** Soft diner chatter: a few quiet mumbling syllables and a glass clink. `level` 0..1 scales it. */
  tableChatter(level: number): void {
    const v = Math.max(0, Math.min(1, level));
    if (v < 0.02) return;
    const names: VowelName[] = ['a', 'e', 'o', 'u', 'ae'];
    const n = 2 + Math.floor(v * 4);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const f = rnd(110, 230);
      this.syllable({
        from: names[Math.floor(Math.random() * 5)], to: names[Math.floor(Math.random() * 5)],
        f, f2: f * rnd(0.85, 1.2), dur: rnd(0.12, 0.25), g: 0.012 * v, at, pan: rnd(-0.4, 0.4), jit: 0.05,
        bus: this.e.amb,
      });
      at += rnd(0.12, 0.35);
    }
    if (Math.random() < 0.35 * v) {
      this.fx.tone({ f: rnd(2600, 3400), dur: 0.35, g: 0.008 * v, at: rnd(0, at), bus: this.e.amb, low: true, pan: rnd(-0.4, 0.4) });
    }
  }
}
