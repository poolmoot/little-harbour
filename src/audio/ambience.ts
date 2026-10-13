/**
 * Ambience: looping filtered-noise beds (sea, wind, murmur, rain, storm, fog) whose
 * levels follow the player's position, the game clock and the weather, plus
 * occasional one-shot gulls, crickets and a foghorn.
 */
import type { Effects } from './effects';
import type { AudioEngine } from './engine';
import { ambienceTargets } from './mix';
import type { Weather } from './mix';
import { midiToHz } from './random';

interface Bed {
  level: GainNode;
  /** Level when the layer is at 1. */
  base: number;
}

interface BedSpec {
  filters: Array<{ type: BiquadFilterType; f: number; q: number }>;
  /** Slow swell: LFO rate in Hz and depth 0..0.5. */
  swell?: { hz: number; depth: number };
  base: number;
}

const BEDS = {
  // Sea: a deep wash and a soft hiss, each swelling at its own slow rate.
  seaWash: { filters: [{ type: 'lowpass', f: 520, q: 0.5 }], swell: { hz: 0.1, depth: 0.4 }, base: 1.1 },
  seaHiss: { filters: [{ type: 'bandpass', f: 1900, q: 0.4 }], swell: { hz: 0.16, depth: 0.45 }, base: 0.07 },
  wind: { filters: [{ type: 'bandpass', f: 380, q: 0.6 }], swell: { hz: 0.06, depth: 0.45 }, base: 0.8 },
  murmur: {
    filters: [{ type: 'bandpass', f: 460, q: 1.1 }, { type: 'lowpass', f: 1300, q: 0.5 }],
    swell: { hz: 0.37, depth: 0.45 },
    base: 0.8,
  },
  rain: { filters: [{ type: 'highpass', f: 1400, q: 0.5 }, { type: 'lowpass', f: 9000, q: 0.5 }], base: 0.22 },
  stormWind: { filters: [{ type: 'bandpass', f: 520, q: 0.7 }], swell: { hz: 0.13, depth: 0.45 }, base: 1.6 },
  stormHowl: { filters: [{ type: 'bandpass', f: 800, q: 7 }], swell: { hz: 0.09, depth: 0.5 }, base: 1.5 },
  fog: { filters: [{ type: 'lowpass', f: 260, q: 0.5 }], base: 0.9 },
} satisfies Record<string, BedSpec>;

type BedName = keyof typeof BEDS;

export class Ambience {
  private beds = {} as Record<BedName, Bed>;
  private weather: Weather = { rain: 0, storm: 0, fog: 0 };
  private nextGull = 6;
  private nextCricket = [0, 0, 0];
  private cricketPitch = [4250, 4480, 4120];
  private nextHorn = 10;
  private built = false;

  constructor(private e: AudioEngine, private fx: Effects) {}

  setRain(v: number): void { this.weather.rain = clamp(v); }
  setStorm(v: number): void { this.weather.storm = clamp(v); }
  setFog(v: number): void { this.weather.fog = clamp(v); }
  getWeather(): Readonly<Weather> { return this.weather; }

  /** Build the looping beds. Call once, after the engine is ready. */
  start(): void {
    if (this.built || !this.e.ready) return;
    this.built = true;
    const c = this.e.ctx!;
    for (const name of Object.keys(BEDS) as BedName[]) {
      const spec: BedSpec = BEDS[name];
      const src = c.createBufferSource();
      src.buffer = this.e.noise;
      src.loop = true;
      let node: AudioNode = src;
      for (const f of spec.filters) {
        const bq = c.createBiquadFilter();
        bq.type = f.type;
        bq.frequency.value = f.f;
        bq.Q.value = f.q;
        node.connect(bq);
        node = bq;
      }
      if (spec.swell) {
        const swell = c.createGain();
        swell.gain.value = 1 - spec.swell.depth;
        const lfo = c.createOscillator();
        lfo.frequency.value = spec.swell.hz * (0.9 + Math.random() * 0.2);
        const depth = c.createGain();
        depth.gain.value = spec.swell.depth;
        lfo.connect(depth).connect(swell.gain);
        lfo.start();
        node.connect(swell);
        node = swell;
      }
      const level = c.createGain();
      level.gain.value = 0;
      node.connect(level).connect(this.e.amb);
      src.start(0, Math.random() * 2);
      this.beds[name] = { level, base: spec.base };
    }
  }

  private setLevel(name: BedName, v: number): void {
    const b = this.beds[name];
    b.level.gain.setTargetAtTime(Math.max(0, v) * b.base, this.e.now(), 1.6);
  }

  /** Called about ten times a second. */
  update(x: number, z: number, hour: number): void {
    if (!this.built || !this.e.running) return;
    const w = this.weather;
    const t = ambienceTargets(x, z, hour, w);
    this.setLevel('seaWash', t.sea);
    this.setLevel('seaHiss', t.sea);
    this.setLevel('wind', t.wind);
    this.setLevel('murmur', t.murmur);
    this.setLevel('rain', w.rain);
    this.setLevel('stormWind', w.storm);
    this.setLevel('stormHowl', w.storm * w.storm);
    this.setLevel('fog', w.fog);

    const now = this.e.now();
    // Gulls by day, further apart in bad weather.
    if (t.gulls > 0.25 && now >= this.nextGull) {
      this.fx.gull(this.e.amb, (Math.random() * 2 - 1) * 0.7, 0.05 + 0.03 * Math.random());
      this.nextGull = now + 6 + Math.random() * 12 / Math.max(0.3, t.gulls);
    } else if (now >= this.nextGull) {
      this.nextGull = now + 3;
    }
    // Crickets at night: a few separate voices, each a short run of tiny pips.
    if (t.crickets > 0.15) {
      for (let i = 0; i < 3; i++) {
        if (now < this.nextCricket[i]) continue;
        this.nextCricket[i] = now + 0.5 + Math.random() * 0.9;
        const pan = (i - 1) * 0.5;
        for (let k = 0; k < 3; k++) {
          this.fx.tone({
            f: this.cricketPitch[i], dur: 0.035, g: 0.011 * t.crickets, at: k * 0.055,
            attack: 0.004, jit: 0, pan, bus: this.e.amb, low: true,
          });
        }
      }
    }
    // A far-off foghorn in thick fog.
    if (w.fog > 0.3 && now >= this.nextHorn) {
      this.horn();
      this.nextHorn = now + 20 + Math.random() * 18;
    } else if (w.fog <= 0.3 && now >= this.nextHorn) {
      this.nextHorn = now + 5;
    }
  }

  private horn(): void {
    const f = midiToHz(43);
    this.fx.tone({ f, dur: 2.6, g: 0.05 * this.weather.fog, attack: 0.5, bus: this.e.amb, low: true, jit: 0 });
    this.fx.tone({ f: f * 2, dur: 2.0, g: 0.012 * this.weather.fog, attack: 0.5, type: 'triangle', bus: this.e.amb, low: true, jit: 0 });
  }
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}
