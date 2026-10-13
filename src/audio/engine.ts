/**
 * The audio engine: the AudioContext and the shared mixing buses.
 *
 *   effects ─┐
 *   music ───┼─► master ─► limiter ─► speakers
 *   ambience ┘      ▲
 *   (effects/music) ─► reverb ─┘
 *
 * Nothing is created until unlock() is called from a user input. Every call is
 * safe if the browser refuses audio: `ready` just stays false.
 */
import { busGains } from './settings';
import type { AudioSettings } from './settings';

/** Fixed trims that leave headroom under the limiter. */
const TRIM = { master: 0.8, effects: 0.9, music: 0.7, ambience: 0.6 };
/** Most effect voices that may sound at once. Low-priority sounds (steps, ambience) stop earlier. */
const MAX_VOICES = 28;
const MAX_LOW_VOICES = 18;

export class AudioEngine {
  ctx: AudioContext | null = null;
  ready = false;
  master!: GainNode;
  fx!: GainNode;
  music!: GainNode;
  amb!: GainNode;
  noise!: AudioBuffer;
  private active = 0;
  private settings: Readonly<AudioSettings> | null = null;
  private wantRunning = false;

  /** Call from the first keydown / pointerdown. Safe to call again. */
  unlock(): boolean {
    try {
      if (!this.ctx) this.build();
      this.wantRunning = true;
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
      return this.ready;
    } catch {
      this.ctx = null;
      this.ready = false;
      return false;
    }
  }

  private build(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 6;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(limiter);

    this.fx = this.bus(ctx, 0.2);
    this.music = this.bus(ctx, 0.32);
    this.amb = this.bus(ctx, 0);

    // Reverb: a generated impulse response, shared by effects and music.
    const verb = ctx.createConvolver();
    verb.buffer = this.makeImpulse(ctx, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 1;
    verb.connect(wet).connect(this.master);
    this.reverbIn = verb;
    // (bus() connected sends to reverbIn lazily below)
    for (const [b, send] of this.sends) {
      const g = ctx.createGain();
      g.gain.value = send;
      b.connect(g).connect(verb);
    }

    // A few seconds of white noise, used by effects and ambience beds.
    const n = Math.floor(ctx.sampleRate * 4);
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    this.ready = true;
    if (this.settings) this.applySettings(this.settings);
  }

  reverbIn: ConvolverNode | null = null;
  private sends: Array<[GainNode, number]> = [];

  private bus(ctx: AudioContext, reverbSend: number): GainNode {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    if (reverbSend > 0) this.sends.push([g, reverbSend]);
    return g;
  }

  private makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.45 * t); // darker as it decays
        d[i] = lp * Math.pow(1 - t, 2.6) * 0.9;
      }
    }
    return buf;
  }

  /** Push the user's volumes onto the buses (smoothly, so nothing clicks). */
  applySettings(s: Readonly<AudioSettings>): void {
    this.settings = s;
    if (!this.ready || !this.ctx) return;
    const g = busGains(s);
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(g.master * TRIM.master, t, 0.05);
    this.fx.gain.setTargetAtTime(g.effects * TRIM.effects, t, 0.05);
    this.music.gain.setTargetAtTime(g.music * TRIM.music, t, 0.08);
    this.amb.gain.setTargetAtTime(g.ambience * TRIM.ambience, t, 0.08);
  }

  /** Stop work when the tab is hidden, carry on when it is back. */
  setHidden(hidden: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.wantRunning) return;
    if (hidden) {
      if (ctx.state === 'running') void ctx.suspend().catch(() => {});
    } else if (ctx.state !== 'running') {
      void ctx.resume().catch(() => {});
    }
  }

  get running(): boolean {
    return this.ready && this.ctx?.state === 'running';
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Reserve a voice slot. Returns false when too many sounds are playing. */
  takeVoice(low = false): boolean {
    if (!this.running) return false;
    if (this.active >= (low ? MAX_LOW_VOICES : MAX_VOICES)) return false;
    this.active++;
    return true;
  }

  releaseVoice(): void {
    if (this.active > 0) this.active--;
  }
}
