/** Web Audio synthesised sounds. Nothing starts until unlock() is called from a user input. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  /** Call from the first keydown / pointerdown. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, endFreq?: number, attack = 0.005): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, f0: number, f1: number, gain: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  bell(): void {
    for (const [d, f] of [[0, 784], [0.55, 784]] as const) {
      this.tone(f, 1.4, 'sine', 0.28, d);
      this.tone(f * 2.76, 0.9, 'sine', 0.12, d);
      this.tone(f * 5.4, 0.4, 'sine', 0.05, d);
    }
  }
  coin(): void {
    this.tone(988, 0.12, 'square', 0.09);
    this.tone(1319, 0.28, 'square', 0.09, 0.07);
  }
  splash(): void {
    this.noise(0.35, 2400, 500, 0.5);
    this.tone(300, 0.15, 'sine', 0.15, 0, 120);
  }
  cast(): void {
    this.noise(0.25, 800, 3000, 0.18, 'bandpass');
  }
  step(): void {
    this.noise(0.05, 500, 220, 0.14, 'lowpass');
  }
  pop(): void {
    this.tone(220, 0.1, 'sine', 0.22, 0, 120);
  }
  deny(): void {
    this.tone(160, 0.16, 'sawtooth', 0.08, 0, 110);
  }
  click(): void {
    this.tone(600, 0.05, 'triangle', 0.1);
  }
  chime(): void {
    this.tone(261.6, 2.2, 'sine', 0.2, 0, undefined, 0.3);
    this.tone(392, 2.2, 'sine', 0.14, 0.25, undefined, 0.3);
    this.tone(523.3, 2.0, 'sine', 0.08, 0.5, undefined, 0.3);
  }
  spoil(): void {
    this.tone(180, 0.35, 'triangle', 0.1, 0, 90);
  }
}
