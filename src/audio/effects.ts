/**
 * Sound effects. Every sound is a few short, soft voices (sine / triangle tones and
 * filtered noise) with a little random pitch and timing so repeats never grate.
 * Each voice stops and disconnects itself; the engine caps how many play at once.
 */
import type { AudioEngine } from './engine';
import { midiToHz } from './random';
import { Voices } from './voices';
import { splashChance } from './town';

export interface ToneOpts {
  f: number;
  /** Glide to this frequency over the sound. */
  f2?: number;
  dur: number;
  g: number;
  type?: OscillatorType;
  /** Delay in seconds from now. */
  at?: number;
  attack?: number;
  /** Random pitch change as a fraction (0.02 = plus or minus 2 percent). */
  jit?: number;
  pan?: number;
  bus?: GainNode;
  /** Low priority voices are dropped first when it gets busy. */
  low?: boolean;
}

export interface NoiseOpts {
  dur: number;
  g: number;
  f0: number;
  f1?: number;
  q?: number;
  filter?: BiquadFilterType;
  at?: number;
  attack?: number;
  pan?: number;
  bus?: GainNode;
  low?: boolean;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const N = midiToHz;

export type Surface = 'stone' | 'wood';

export class Effects {
  private last: Record<string, number> = {};
  private voices: Voices;

  constructor(private e: AudioEngine) {
    this.voices = new Voices(e, this);
  }

  // ---- building blocks ------------------------------------------------------

  tone(o: ToneOpts): void {
    const e = this.e;
    if (!e.takeVoice(o.low)) return;
    try {
      const c = e.ctx!;
      const t = c.currentTime + (o.at ?? 0) + Math.random() * 0.006;
      const k = 1 + (Math.random() * 2 - 1) * (o.jit ?? 0.01);
      const osc = c.createOscillator();
      osc.type = o.type ?? 'sine';
      osc.frequency.setValueAtTime(o.f * k, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2 * k, t + o.dur);
      const g = c.createGain();
      const atk = Math.min(o.attack ?? 0.006, o.dur * 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.g, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      osc.connect(g);
      let pan: StereoPannerNode | null = null;
      if (o.pan) {
        pan = c.createStereoPanner();
        pan.pan.value = o.pan;
        g.connect(pan).connect(o.bus ?? e.fx);
      } else {
        g.connect(o.bus ?? e.fx);
      }
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        pan?.disconnect();
        e.releaseVoice();
      };
      osc.start(t);
      osc.stop(t + o.dur + 0.05);
    } catch {
      e.releaseVoice();
    }
  }

  noise(o: NoiseOpts): void {
    const e = this.e;
    if (!e.takeVoice(o.low)) return;
    try {
      const c = e.ctx!;
      const t = c.currentTime + (o.at ?? 0) + Math.random() * 0.006;
      const src = c.createBufferSource();
      src.buffer = e.noise;
      const f = c.createBiquadFilter();
      f.type = o.filter ?? 'bandpass';
      f.Q.value = o.q ?? 0.8;
      f.frequency.setValueAtTime(o.f0, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      const g = c.createGain();
      const atk = Math.min(o.attack ?? 0.004, o.dur * 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.g, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      src.connect(f).connect(g);
      let pan: StereoPannerNode | null = null;
      if (o.pan) {
        pan = c.createStereoPanner();
        pan.pan.value = o.pan;
        g.connect(pan).connect(o.bus ?? e.fx);
      } else {
        g.connect(o.bus ?? e.fx);
      }
      src.onended = () => {
        src.disconnect();
        f.disconnect();
        g.disconnect();
        pan?.disconnect();
        e.releaseVoice();
      };
      src.start(t, Math.random() * Math.max(0.1, e.noise.duration - o.dur - 0.2));
      src.stop(t + o.dur + 0.05);
    } catch {
      e.releaseVoice();
    }
  }

  /** True if this named sound may play now (stops the same sound piling up). */
  private ok(name: string, minGap: number): boolean {
    if (!this.e.running) return false;
    const t = this.e.now();
    if (t - (this.last[name] ?? -99) < minGap) return false;
    this.last[name] = t;
    return true;
  }

  /** A soft bell: a sine with two quiet inharmonic partials. */
  private bell(f: number, g: number, at: number, dur = 1.4): void {
    this.tone({ f, dur, g, at, attack: 0.004, jit: 0.003 });
    this.tone({ f: f * 2.76, dur: dur * 0.55, g: g * 0.35, at, attack: 0.004, jit: 0.003 });
    this.tone({ f: f * 5.4, dur: dur * 0.25, g: g * 0.12, at, attack: 0.004, jit: 0.003 });
  }

  /** A gentle note: sine plus a soft triangle octave. */
  private note(midi: number, g: number, at: number, dur = 0.9): void {
    this.tone({ f: N(midi), dur, g, at, attack: 0.01, jit: 0.002 });
    this.tone({ f: N(midi) * 2, dur: dur * 0.6, g: g * 0.25, at, attack: 0.01, type: 'triangle', jit: 0.002 });
  }

  // ---- movement and carrying ------------------------------------------------

  /** One footstep. `wet` (0..1) is how wet the cobbles are: duller, with the odd splash. */
  step(surface: Surface, wet = 0): void {
    if (!this.ok('step', 0.08)) return;
    if (surface === 'stone') {
      const w = wet * 0.6;
      this.noise({ dur: 0.05 + 0.03 * w, g: 0.07, f0: rnd(1500, 2200) * (1 - 0.35 * w), f1: 800 * (1 - 0.3 * w), q: 1.3, low: true });
      this.tone({ f: rnd(150, 190), f2: 100, dur: 0.06, g: 0.04, low: true });
      if (wet > 0.2) {
        // A wet slap, and now and then a little splash.
        this.noise({ dur: 0.07, g: 0.025 * wet, f0: 2800, q: 0.8, filter: 'highpass', at: 0.02, low: true });
        if (Math.random() < splashChance(wet)) this.splash();
      }
    } else {
      this.noise({ dur: 0.08, g: 0.11, f0: rnd(480, 620), f1: 280, q: 3, low: true });
      this.tone({ f: rnd(120, 150), f2: 80, dur: 0.1, g: 0.08, low: true });
    }
  }

  /** A small splash: a burst of bright noise and a quick bubbly drop. */
  splash(): void {
    this.noise({ dur: 0.22, g: 0.05, f0: 3200, f1: 1400, q: 0.7, attack: 0.01, low: true });
    this.tone({ f: rnd(500, 700), f2: rnd(1000, 1300), dur: 0.08, g: 0.02, at: 0.02, low: true });
  }

  // ---- town sounds -----------------------------------------------------------

  /** Harbour bell: `strokes` soft strokes, `gain` 0..1 for distance, `pan` -1..1. Plays on the ambience bus. */
  hourBell(strokes: number, gain: number, pan = 0): void {
    if (!this.ok('hourBell', 3)) return;
    const f = N(67); // G4, mellow
    for (let i = 0; i < strokes; i++) {
      const at = i * 1.6;
      const g = 0.08 * gain;
      const o = { at, pan, bus: this.e.amb, jit: 0.002 };
      this.tone({ f, dur: 2.4, g, attack: 0.005, ...o });
      this.tone({ f: f * 2.01, dur: 1.5, g: g * 0.35, attack: 0.005, ...o });
      this.tone({ f: f * 2.76, dur: 0.9, g: g * 0.2, attack: 0.005, ...o });
      this.tone({ f: f * 5.4, dur: 0.35, g: g * 0.07, attack: 0.005, ...o });
    }
  }

  /** The fish seller's friendly call. `level` 0..1 (distance), `pan` -1..1. */
  sellerCall(level: number, pan = 0): void {
    if (level < 0.03 || !this.ok('sellerCall', 8)) return;
    this.voices.sellerCall(level, pan);
  }

  /** A townsperson calling out a greeting ("hello!"), as a tone-based impression. */
  wave(level = 1, pan = 0): void {
    if (!this.ok('wave', 2)) return;
    this.voices.wave(level, pan);
  }

  /** A crowd cheer: 1 small (a big catch), 2 bigger (a golden fish), 3 biggest (the King Fish). */
  cheer(size: 1 | 2 | 3): void {
    if (!this.ok('cheer', 4)) return;
    this.voices.cheer(size);
  }

  /** Diners at the tables: one short burst of quiet chatter. Call every second or two; `level` 0..1. */
  tableChatter(level: number): void {
    if (!this.ok('tableChatter', 0.8)) return;
    this.voices.tableChatter(level);
  }

  /** Gulls on the ground bursting into the air: wing flaps and a few startled calls. */
  gullsTakeOff(level = 1): void {
    if (!this.ok('gullsTakeOff', 1.5)) return;
    for (let i = 0; i < 6; i++) {
      this.noise({ dur: 0.07, g: 0.04 * level, f0: rnd(900, 1500), q: 0.9, at: i * 0.07 + Math.random() * 0.03, pan: rnd(-0.5, 0.5), low: true });
    }
    for (let i = 0; i < 2; i++) {
      const top = rnd(1500, 2000);
      this.tone({ f: top, f2: top * 0.6, dur: 0.22, g: 0.04 * level, type: 'triangle', attack: 0.03, at: 0.08 + i * 0.2, pan: rnd(-0.5, 0.5), low: true, jit: 0.03 });
    }
  }

  /** A cat purring: low noise throbbing about 25 times a second, about `dur` seconds. */
  catPurr(dur = 2.2): void {
    if (!this.ok('catPurr', 3) || !this.e.takeVoice(true)) return;
    try {
      const c = this.e.ctx!;
      const t = c.currentTime + 0.02;
      const src = c.createBufferSource();
      src.buffer = this.e.noise;
      const lp = c.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 150;
      lp.Q.value = 1.2;
      const throb = c.createGain();
      throb.gain.value = 0.5;
      const lfo = c.createOscillator();
      lfo.frequency.value = rnd(22, 28);
      const depth = c.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth).connect(throb.gain);
      const env = c.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.1, t + 0.5);
      env.gain.setValueAtTime(0.1, t + dur - 0.6);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(lp).connect(throb).connect(env).connect(this.e.fx);
      src.onended = () => {
        src.disconnect(); lp.disconnect(); throb.disconnect(); lfo.disconnect(); depth.disconnect(); env.disconnect();
        this.e.releaseVoice();
      };
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.05);
    } catch {
      this.e.releaseVoice();
    }
  }

  cratePickUp(): void {
    if (!this.ok('cratePickUp', 0.06)) return;
    this.noise({ dur: 0.1, g: 0.09, f0: 700, f1: 1100, q: 1.5 });
    this.tone({ f: rnd(210, 240), f2: 150, dur: 0.12, g: 0.1 });
  }

  crateDown(at = 0): void {
    if (!this.ok('crateDown' + at, 0.05)) return;
    this.tone({ f: rnd(130, 160), f2: 75, dur: 0.16, g: 0.15, at });
    this.noise({ dur: 0.07, g: 0.1, f0: 600, f1: 300, q: 2.5, at });
  }

  /** Crate into the ice box: a thump and a little icy tinkle. */
  crateIce(): void {
    this.crateDown();
    this.tone({ f: rnd(2600, 3100), dur: 0.25, g: 0.025, at: 0.05 });
  }

  boatLeave(): void {
    if (!this.ok('boatLeave', 0.4)) return;
    this.noise({ dur: 1.1, g: 0.06, f0: 300, f1: 900, q: 0.7, filter: 'lowpass', attack: 0.4 });
    this.tone({ f: rnd(170, 190), f2: 230, dur: 0.3, g: 0.035, type: 'triangle', attack: 0.05 });
    this.tone({ f: N(55), dur: 1.2, g: 0.05, at: 0.1, attack: 0.25 });
    this.tone({ f: N(55) * 2, dur: 1.0, g: 0.012, at: 0.1, attack: 0.25 });
  }

  boatReturn(): void {
    if (!this.ok('boatReturn', 0.5)) return;
    this.bell(784, 0.13, 0);
    this.bell(784 * 1.003, 0.1, 0.6);
    this.noise({ dur: 0.9, g: 0.04, f0: 500, f1: 300, filter: 'lowpass', attack: 0.3, at: 0.1 });
  }

  unload(): void {
    if (!this.ok('unload', 0.2)) return;
    for (let i = 0; i < 3; i++) this.crateDown(i * rnd(0.11, 0.16));
  }

  // ---- money ----------------------------------------------------------------

  /** Coins. More coins and a warm low chord for a bigger sale. */
  coins(total: number): void {
    if (!this.ok('coins', 0.05)) return;
    const n = total < 15 ? 2 : total < 50 ? 3 : total < 150 ? 4 : total < 400 ? 6 : 8;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const f = rnd(1800, 2500);
      this.tone({ f, dur: 0.28, g: 0.045, at: t, attack: 0.003, jit: 0.01 });
      this.tone({ f: f * 1.5, dur: 0.18, g: 0.02, at: t + 0.015, attack: 0.003 });
      t += rnd(0.05, 0.09);
    }
    if (total >= 150) {
      this.note(72, 0.05, t, 1.1);
      this.note(79, 0.04, t + 0.05, 1.1);
    }
  }

  orderFilled(): void {
    if (!this.ok('orderFilled', 0.3)) return;
    this.note(76, 0.06, 0.05, 0.7);
    this.note(79, 0.06, 0.2, 0.7);
    this.note(84, 0.07, 0.35, 1.1);
  }

  orderMissed(): void {
    if (!this.ok('orderMissed', 0.3)) return;
    this.tone({ f: N(67), f2: N(66), dur: 0.5, g: 0.06, type: 'triangle', attack: 0.03 });
    this.tone({ f: N(64), f2: N(63), dur: 0.7, g: 0.06, type: 'triangle', at: 0.22, attack: 0.03 });
  }

  upgrade(): void {
    if (!this.ok('upgrade', 0.3)) return;
    this.note(72, 0.055, 0, 0.6);
    this.note(76, 0.055, 0.1, 0.6);
    this.note(79, 0.055, 0.2, 0.6);
    this.note(84, 0.06, 0.3, 1.2);
    for (let i = 0; i < 3; i++) this.tone({ f: rnd(3000, 4200), dur: 0.2, g: 0.012, at: 0.3 + i * 0.07 });
  }

  hire(): void {
    if (!this.ok('hire', 0.3)) return;
    this.tone({ f: N(72), dur: 0.35, g: 0.07, type: 'triangle', attack: 0.015 });
    this.tone({ f: N(79), dur: 0.6, g: 0.07, type: 'triangle', at: 0.15, attack: 0.015 });
  }

  fire(): void {
    if (!this.ok('fire', 0.3)) return;
    this.tone({ f: N(67), f2: N(64), dur: 0.5, g: 0.06, type: 'triangle', attack: 0.03 });
  }

  // ---- fishing --------------------------------------------------------------

  cast(): void {
    if (!this.ok('cast', 0.2)) return;
    this.noise({ dur: 0.32, g: 0.07, f0: 500, f1: 2400, q: 1, attack: 0.08 });
    this.tone({ f: rnd(1200, 1500), f2: 700, dur: 0.15, g: 0.012, at: 0.3 });
    this.noise({ dur: 0.35, g: 0.09, f0: 1800, f1: 500, q: 0.8, at: 0.4 });
  }

  bite(): void {
    if (!this.ok('bite', 0.2)) return;
    this.plop(0);
    this.plop(0.13);
  }

  private plop(at: number): void {
    this.tone({ f: rnd(380, 460), f2: 190, dur: 0.12, g: 0.1, at });
    this.noise({ dur: 0.16, g: 0.07, f0: 1600, f1: 500, q: 1.2, at });
  }

  land(): void {
    if (!this.ok('land', 0.3)) return;
    this.noise({ dur: 0.4, g: 0.12, f0: 2200, f1: 450, q: 0.8 });
    this.tone({ f: 320, f2: 120, dur: 0.18, g: 0.1 });
    this.note(79, 0.05, 0.22, 0.7);
  }

  lose(): void {
    if (!this.ok('lose', 0.3)) return;
    this.noise({ dur: 0.35, g: 0.05, f0: 1500, f1: 400, q: 0.8 });
    this.tone({ f: 420, f2: 230, dur: 0.4, g: 0.045, type: 'triangle', attack: 0.02, at: 0.05 });
  }

  spoil(): void {
    if (!this.ok('spoil', 0.3)) return;
    this.tone({ f: 180, f2: 90, dur: 0.4, g: 0.07, type: 'triangle', attack: 0.02 });
  }

  // ---- big moments ----------------------------------------------------------

  rankUp(): void {
    if (!this.ok('rankUp', 1)) return;
    [72, 76, 79, 84].forEach((m, i) => this.note(m, 0.07, i * 0.14, 0.9));
    [72, 79, 88].forEach((m, i) => this.tone({ f: N(m), dur: 2.2, g: 0.04, at: 0.6 + i * 0.03, attack: 0.15 }));
    this.bell(N(96), 0.02, 0.62, 1.8);
  }

  dayReport(): void {
    if (!this.ok('dayReport', 1)) return;
    this.noise({ dur: 0.3, g: 0.04, f0: 5000, f1: 3000, filter: 'highpass', q: 0.5, attack: 0.05 });
    this.note(72, 0.045, 0.05, 1.0);
    this.note(79, 0.045, 0.2, 1.4);
  }

  deny(): void {
    if (!this.ok('deny', 0.18)) return;
    this.tone({ f: 230, f2: 190, dur: 0.14, g: 0.06, type: 'triangle', attack: 0.01 });
    this.tone({ f: 200, f2: 165, dur: 0.18, g: 0.055, type: 'triangle', attack: 0.01, at: 0.1 });
  }

  // ---- interface ------------------------------------------------------------

  panelOpen(): void {
    if (!this.ok('panelOpen', 0.12)) return;
    this.tone({ f: 520, f2: 700, dur: 0.12, g: 0.04, attack: 0.01 });
    this.noise({ dur: 0.06, g: 0.025, f0: 3000, q: 1 });
  }

  panelClose(): void {
    if (!this.ok('panelClose', 0.12)) return;
    this.tone({ f: 640, f2: 440, dur: 0.12, g: 0.035, attack: 0.01 });
  }

  click(): void {
    if (!this.ok('click', 0.05)) return;
    this.tone({ f: rnd(640, 720), f2: 560, dur: 0.05, g: 0.04, attack: 0.004 });
    this.noise({ dur: 0.02, g: 0.015, f0: 3500, q: 1 });
  }

  // ---- creatures ------------------------------------------------------------

  meow(): void {
    if (!this.ok('meow', 4)) return;
    const c = this.e.ctx!;
    if (!this.e.takeVoice()) return;
    try {
      const t = c.currentTime + 0.01;
      const base = rnd(480, 560);
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * 1.55, t + 0.18);
      osc.frequency.linearRampToValueAtTime(base * 1.05, t + 0.55);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.linearRampToValueAtTime(1700, t + 0.2);
      bp.frequency.linearRampToValueAtTime(1000, t + 0.55);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(bp).connect(g).connect(this.e.fx);
      osc.onended = () => {
        osc.disconnect();
        bp.disconnect();
        g.disconnect();
        this.e.releaseVoice();
      };
      osc.start(t);
      osc.stop(t + 0.65);
    } catch {
      this.e.releaseVoice();
    }
  }

  /** A gull call: two or three falling "kee-ah" glides. `bus` and `pan` let ambience place it. */
  gull(bus?: GainNode, pan = 0, level = 0.05): void {
    if (!this.ok('gull', 0.5)) return;
    const n = 2 + Math.floor(Math.random() * 2);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const top = rnd(1700, 2200) * (1 - i * 0.06);
      const dur = rnd(0.2, 0.3);
      this.tone({ f: top, f2: top * 0.62, dur, g: level, type: 'triangle', attack: 0.04, at, pan, bus, low: true, jit: 0.03 });
      this.tone({ f: top * 2, f2: top * 1.2, dur: dur * 0.8, g: level * 0.2, at, pan, bus, low: true, jit: 0.03 });
      at += dur + rnd(0.05, 0.14);
    }
  }

  // ---- coming features: ready-made sounds, not wired to events yet ------------------

  goalComplete(): void {
    if (!this.ok('goalComplete', 0.8)) return;
    [67, 72, 76, 79].forEach((m, i) => this.note(m, 0.06, i * 0.11, 1.0));
    this.bell(N(91), 0.03, 0.5, 1.6);
  }

  buildingBuilt(): void {
    if (!this.ok('buildingBuilt', 0.8)) return;
    for (let i = 0; i < 3; i++) {
      const at = i * 0.17 + Math.random() * 0.02;
      this.noise({ dur: 0.06, g: 0.14, f0: 1800, f1: 1200, q: 4, at });
      this.tone({ f: 260 + i * 15, f2: 200, dur: 0.1, g: 0.08, at });
    }
    [60, 67, 72, 76].forEach((m, i) => this.tone({ f: N(m), dur: 1.8, g: 0.04, at: 0.7 + i * 0.05, attack: 0.1 }));
  }

  buildingUpgraded(): void {
    if (!this.ok('buildingUpgraded', 0.8)) return;
    this.noise({ dur: 0.06, g: 0.12, f0: 1800, f1: 1200, q: 4 });
    this.tone({ f: 270, f2: 200, dur: 0.1, g: 0.07 });
    this.note(72, 0.055, 0.25, 0.7);
    this.note(79, 0.06, 0.4, 0.7);
    this.note(84, 0.06, 0.55, 1.3);
  }

  stormWarning(): void {
    if (!this.ok('stormWarning', 3)) return;
    this.noise({ dur: 2.5, g: 0.07, f0: 150, f1: 300, q: 0.7, filter: 'lowpass', attack: 1.2 });
    this.tone({ f: N(45), f2: N(43), dur: 1.8, g: 0.09, type: 'triangle', attack: 0.5 });
    this.tone({ f: N(52), f2: N(50), dur: 1.8, g: 0.04, at: 2.0, attack: 0.5 });
    this.tone({ f: N(45), f2: N(42), dur: 2.4, g: 0.09, at: 2.0, type: 'triangle', attack: 0.5 });
  }

  boatDamaged(): void {
    if (!this.ok('boatDamaged', 0.5)) return;
    this.noise({ dur: 0.1, g: 0.14, f0: 900, f1: 500, q: 3 });
    this.tone({ f: 110, f2: 55, dur: 0.35, g: 0.13 });
    this.tone({ f: 190, f2: 140, dur: 0.5, g: 0.04, type: 'triangle', attack: 0.05, at: 0.12 });
    this.noise({ dur: 0.5, g: 0.05, f0: 800, f1: 300, q: 5, at: 0.15 });
  }

  contractAccepted(): void {
    if (!this.ok('contractAccepted', 0.5)) return;
    this.noise({ dur: 0.2, g: 0.04, f0: 4000, f1: 2500, q: 1, attack: 0.03 });
    this.note(67, 0.055, 0.15, 0.7);
    this.note(74, 0.06, 0.3, 1.0);
  }

  contractDone(): void {
    if (!this.ok('contractDone', 0.8)) return;
    this.coins(300);
    this.note(72, 0.05, 0.1, 0.9);
    this.note(76, 0.05, 0.25, 0.9);
    this.note(79, 0.05, 0.4, 0.9);
    this.note(84, 0.06, 0.55, 1.4);
  }

  contractMissed(): void {
    if (!this.ok('contractMissed', 0.8)) return;
    this.tone({ f: N(64), f2: N(62), dur: 0.7, g: 0.06, type: 'triangle', attack: 0.04 });
    this.tone({ f: N(60), f2: N(58), dur: 1.0, g: 0.06, type: 'triangle', attack: 0.04, at: 0.3 });
    this.noise({ dur: 0.5, g: 0.03, f0: 400, f1: 200, filter: 'lowpass', q: 0.7, at: 0.2 });
  }

  marketDay(): void {
    if (!this.ok('marketDay', 1)) return;
    this.bell(1046, 0.09, 0, 1.2);
    this.bell(1046, 0.08, 0.35, 1.2);
    this.bell(1318, 0.08, 0.7, 1.4);
    [72, 74, 76, 79, 81, 84].forEach((m, i) => this.note(m, 0.04, 1.0 + i * 0.09, 0.6));
  }

  kingFishCaught(): void {
    if (!this.ok('kingFishCaught', 2)) return;
    this.noise({ dur: 0.6, g: 0.14, f0: 2400, f1: 400, q: 0.8 });
    this.tone({ f: 300, f2: 100, dur: 0.3, g: 0.12 });
    [72, 76, 79, 84, 88, 91].forEach((m, i) => this.note(m, 0.065, 0.4 + i * 0.12, 1.2));
    [72, 79, 84, 88].forEach((m, i) => this.tone({ f: N(m), dur: 3.2, g: 0.045, at: 1.2 + i * 0.03, attack: 0.2 }));
    this.bell(N(100), 0.02, 1.25, 2.4);
    this.bell(N(96), 0.02, 1.55, 2.4);
  }

  ending(): void {
    if (!this.ok('ending', 5)) return;
    const chord = [48, 55, 60, 64, 67, 72];
    chord.forEach((m, i) => this.tone({ f: N(m), dur: 7, g: 0.045, at: i * 0.8, attack: 1.5 }));
    [72, 76, 79, 84, 79, 76, 72, 67, 72].forEach((m, i) => this.note(m, 0.045, 1.0 + i * 0.7, 1.8));
    this.bell(N(96), 0.02, 7.4, 3);
  }
}
