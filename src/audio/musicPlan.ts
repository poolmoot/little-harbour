/**
 * The music "composer": decides, bar by bar, which chord plays and which few melody
 * notes (if any) go on top. Pure and seeded, so it can be unit tested.
 * Everything is in C major / A minor pentatonic so day and night versions blend.
 */
import { makeRandom } from './random';

export type MusicMode = 'day' | 'night';

export interface PlanNote {
  /** Seconds from the start of the bar. */
  at: number;
  midi: number;
  dur: number;
  vel: number;
}

export interface BarPlan {
  mode: MusicMode;
  barSeconds: number;
  /** Pad chord notes (midi). */
  chord: number[];
  /** Soft bass note (midi), or null to leave it out. */
  bass: number | null;
  melody: PlanNote[];
}

export const PENTATONIC = [0, 2, 4, 7, 9]; // C D E G A

interface Chord { root: number; tones: number[] }
const C: Chord = { root: 0, tones: [0, 4, 7] };
const AM: Chord = { root: 9, tones: [0, 3, 7] };
const F: Chord = { root: 5, tones: [0, 4, 7] };
const G: Chord = { root: 7, tones: [0, 4, 7] };
const EM: Chord = { root: 4, tones: [0, 3, 7] };

const DAY_PROGRESSIONS: Chord[][] = [
  [C, AM, F, G],
  [C, G, AM, F],
  [F, C, G, AM],
  [C, EM, F, C],
  [AM, F, C, G],
];
const NIGHT_PROGRESSIONS: Chord[][] = [
  [AM, F, C, G],
  [AM, EM, F, C],
  [F, C, AM, AM],
  [C, G, AM, F],
];

export const BAR_SECONDS: Record<MusicMode, number> = { day: 8, night: 12 };
const RANGE: Record<MusicMode, [number, number]> = { day: [69, 88], night: [60, 79] };
const SLOTS = 8; // melody notes land on eighths of the bar
const P_PHRASE: Record<MusicMode, number> = { day: 0.7, night: 0.5 };
const MAX_NOTES: Record<MusicMode, number> = { day: 4, night: 3 };

interface Phrase { slots: number[]; steps: number[] }

export class MusicPlanner {
  private rand: () => number;
  private prog: Chord[] = [];
  private barInProg = 4;
  private lastMelodyIdx = -1;
  private silentRun = 0;
  private lastPhrase: Phrase | null = null;
  private deepSilence = 0;

  constructor(seed: number) {
    this.rand = makeRandom(seed);
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rand() * arr.length)];
  }

  private candidates(mode: MusicMode): number[] {
    const [lo, hi] = RANGE[mode];
    const out: number[] = [];
    for (let m = lo; m <= hi; m++) if (PENTATONIC.includes(m % 12)) out.push(m);
    return out;
  }

  next(mode: MusicMode): BarPlan {
    const bar = BAR_SECONDS[mode];
    if (this.barInProg >= 4) {
      this.prog = this.pick(mode === 'day' ? DAY_PROGRESSIONS : NIGHT_PROGRESSIONS);
      this.barInProg = 0;
    }
    const chord = this.prog[this.barInProg++];
    const base = mode === 'day' ? 48 : 43;
    const root = base + ((chord.root - base) % 12 + 12) % 12;
    const notes = chord.tones.map((t) => root + t);
    const bass = mode === 'night' && this.rand() < 0.4 ? null : root - 12;
    const melody = this.melody(mode, bar, notes);
    return { mode, barSeconds: bar, chord: notes, bass, melody };
  }

  private melody(mode: MusicMode, bar: number, chordNotes: number[]): PlanNote[] {
    if (this.deepSilence > 0) {
      this.deepSilence--;
      this.silentRun++;
      return [];
    }
    let p = P_PHRASE[mode];
    if (this.silentRun >= 3) p = 1;
    else if (this.silentRun >= 2) p = 0.85;
    if (this.rand() >= p) {
      this.silentRun++;
      if (this.silentRun < 2 && this.rand() < 0.1) this.deepSilence = 1;
      return [];
    }
    this.silentRun = 0;

    const cands = this.candidates(mode);
    const chordPcs = chordNotes.map((n) => n % 12);
    let phrase: Phrase;
    if (this.lastPhrase && this.rand() < 0.3) {
      phrase = this.lastPhrase; // echo the last phrase from a new start note
    } else {
      const count = 1 + Math.floor(this.rand() * MAX_NOTES[mode]);
      const slots: number[] = [];
      let s = this.rand() < 0.6 ? 0 : 1 + Math.floor(this.rand() * 2);
      for (let i = 0; i < count && s < SLOTS; i++) {
        slots.push(s);
        s += 1 + Math.floor(this.rand() * 3);
      }
      const steps = slots.map(() => Math.floor(this.rand() * 5) - 2);
      phrase = { slots, steps };
      this.lastPhrase = phrase;
    }

    // First note: a chord tone near the previous note (or the middle of the range).
    const mid = this.lastMelodyIdx >= 0 ? this.lastMelodyIdx : Math.floor(cands.length / 2);
    const near = cands
      .map((m, i) => ({ m, i }))
      .filter((c) => Math.abs(c.i - mid) <= 3)
      .map((c) => ({ ...c, w: chordPcs.includes(c.m % 12) ? 3 : 1 }));
    let total = 0;
    for (const c of near) total += c.w;
    let r = this.rand() * total;
    let idx = near[0].i;
    for (const c of near) {
      r -= c.w;
      if (r <= 0) { idx = c.i; break; }
    }

    const out: PlanNote[] = [];
    const slotLen = bar / SLOTS;
    for (let i = 0; i < phrase.slots.length; i++) {
      if (i > 0) {
        let step = phrase.steps[i];
        if (step === 0) step = this.rand() < 0.5 ? 1 : -1;
        idx = Math.min(cands.length - 1, Math.max(0, idx + step));
      }
      const nextAt = i + 1 < phrase.slots.length ? phrase.slots[i + 1] * slotLen : bar;
      const at = phrase.slots[i] * slotLen;
      out.push({
        at,
        midi: cands[idx],
        dur: Math.min(nextAt - at + 1.2, mode === 'day' ? 3 : 4),
        vel: 0.55 + this.rand() * 0.4,
      });
    }
    this.lastMelodyIdx = idx;
    return out;
  }
}
