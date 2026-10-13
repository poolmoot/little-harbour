/**
 * Music: plays what MusicPlanner decides, using look-ahead scheduling on the audio
 * clock (tick() is called every frame; notes are placed a little into the future).
 * A day and a night bus crossfade with the clock. Soft pads, a quiet bass and a
 * sparse bell-like melody with a dreamy echo.
 */
import type { AudioEngine } from './engine';
import { dayness } from './mix';
import { MusicPlanner } from './musicPlan';
import type { BarPlan, MusicMode, PlanNote } from './musicPlan';
import { midiToHz } from './random';

const LOOK_AHEAD = 1.2;

export class Music {
  private planner: MusicPlanner;
  private dayBus: GainNode | null = null;
  private nightBus: GainNode | null = null;
  private echoIn: GainNode | null = null;
  private nextBarAt = 0;
  private mode: MusicMode = 'day';
  private enabled = true;
  private started = false;

  constructor(private e: AudioEngine, seed = (Date.now() & 0xffffff) || 1) {
    this.planner = new MusicPlanner(seed);
  }

  start(): void {
    if (this.started || !this.e.ready) return;
    this.started = true;
    const c = this.e.ctx!;
    this.dayBus = c.createGain();
    this.nightBus = c.createGain();
    this.dayBus.gain.value = 0;
    this.nightBus.gain.value = 0;
    this.dayBus.connect(this.e.music);
    this.nightBus.connect(this.e.music);
    // Echo: a slow feedback delay, darker with each repeat.
    this.echoIn = c.createGain();
    this.echoIn.gain.value = 0.32;
    const delay = c.createDelay(1.5);
    delay.delayTime.value = 0.46;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    this.echoIn.connect(delay);
    delay.connect(damp).connect(fb).connect(delay);
    damp.connect(this.e.music);
  }

  /** Music is skipped entirely (no scheduling work) while muted or turned right down. */
  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  /** Call every frame. */
  tick(hour: number): void {
    if (!this.started || !this.e.running || !this.dayBus || !this.nightBus) return;
    const now = this.e.now();
    const d = dayness(hour);
    this.dayBus.gain.setTargetAtTime(Math.sqrt(d), now, 3);
    this.nightBus.gain.setTargetAtTime(Math.sqrt(1 - d), now, 3);
    if (!this.enabled) {
      this.nextBarAt = 0;
      return;
    }
    if (this.nextBarAt === 0 || this.nextBarAt < now - 0.5) this.nextBarAt = now + 0.4;
    while (this.nextBarAt < now + LOOK_AHEAD) {
      this.mode = d >= 0.5 ? 'day' : 'night';
      const plan = this.planner.next(this.mode);
      this.schedule(plan, this.nextBarAt);
      this.nextBarAt += plan.barSeconds;
    }
  }

  private schedule(plan: BarPlan, t: number): void {
    const c = this.e.ctx!;
    const bus = plan.mode === 'day' ? this.dayBus! : this.nightBus!;
    const bar = plan.barSeconds;
    const release = 2.6;
    const life = bar + release + 0.2;

    // One soft filter per bar; it is removed when the last voice has ended.
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = plan.mode === 'day' ? 1400 : 900;
    lp.connect(bus);
    let live = 0;
    const done = (): void => {
      if (--live === 0) lp.disconnect();
    };

    const voice = (midi: number, peak: number, type: OscillatorType, detune: number): void => {
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.value = midiToHz(midi);
      osc.detune.value = detune;
      const g = c.createGain();
      const atk = Math.min(2.4, bar * 0.28);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + atk);
      g.gain.setValueAtTime(peak, t + bar * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + bar + release);
      osc.connect(g).connect(lp);
      live++;
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        done();
      };
      osc.start(t);
      osc.stop(t + life);
    };

    const padPeak = plan.mode === 'day' ? 0.03 : 0.024;
    for (const m of plan.chord) {
      voice(m, padPeak, 'sine', -4);
      voice(m, padPeak * 0.5, 'triangle', 5);
    }
    if (plan.bass !== null) voice(plan.bass, padPeak * 1.1, 'sine', 0);

    for (const n of plan.melody) this.melodyNote(n, t, bus, plan.mode);
  }

  private melodyNote(n: PlanNote, barStart: number, bus: GainNode, mode: MusicMode): void {
    const c = this.e.ctx!;
    const t = barStart + n.at + (Math.random() - 0.5) * 0.04;
    const f = midiToHz(n.midi);
    const peak = (mode === 'day' ? 0.06 : 0.045) * n.vel;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur + 0.8);
    g.connect(bus);
    if (this.echoIn) g.connect(this.echoIn);
    const a = c.createOscillator();
    a.frequency.value = f;
    const b = c.createOscillator();
    b.type = 'triangle';
    b.frequency.value = f * 2;
    const bg = c.createGain();
    bg.gain.value = 0.18;
    a.connect(g);
    b.connect(bg).connect(g);
    a.onended = () => {
      a.disconnect();
      b.disconnect();
      bg.disconnect();
      g.disconnect();
    };
    a.start(t);
    b.start(t);
    a.stop(t + n.dur + 0.9);
    b.stop(t + n.dur + 0.9);
  }

  /** A short gentle sting for the morning. Bells that ring out and fade. */
  dawnSting(): void {
    if (!this.started || !this.e.running) return;
    const c = this.e.ctx!;
    const t0 = c.currentTime + 0.1;
    [67, 72, 76, 79].forEach((m, i) => {
      const t = t0 + i * 0.32;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      g.connect(this.e.music);
      if (this.echoIn) g.connect(this.echoIn);
      const o = c.createOscillator();
      o.frequency.value = midiToHz(m);
      const o2 = c.createOscillator();
      o2.frequency.value = midiToHz(m) * 2.01;
      const g2 = c.createGain();
      g2.gain.value = 0.12;
      o.connect(g);
      o2.connect(g2).connect(g);
      o.onended = () => {
        o.disconnect();
        o2.disconnect();
        g2.disconnect();
        g.disconnect();
      };
      o.start(t);
      o2.start(t);
      o.stop(t + 2.5);
      o2.stop(t + 2.5);
    });
  }
}
