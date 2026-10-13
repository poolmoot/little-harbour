// Picture quality: three levels, chosen by hand or stepped down automatically when the game runs slowly.
export type QualityLevel = 'high' | 'medium' | 'low';
export type QualityMode = 'auto' | QualityLevel;

export interface QualityPreset {
  /** Highest device pixel ratio the canvas may use. */
  dpr: number;
  /** Shadow map size in pixels; 0 turns shadows off. */
  shadow: number;
  /** Anti-aliasing samples on the scene render target (0 = none). */
  samples: number;
  bloom: boolean;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  high: { dpr: 1.75, shadow: 2048, samples: 4, bloom: true },
  medium: { dpr: 1.25, shadow: 1024, samples: 2, bloom: true },
  low: { dpr: 1, shadow: 0, samples: 0, bloom: false },
};
const ORDER: QualityLevel[] = ['high', 'medium', 'low'];

/** Average frame time (ms) above which, held for WINDOW seconds, auto mode steps down one level. */
export const SLOW_FRAME_MS = 22;
export const WINDOW_SECONDS = 3;
export const QUALITY_KEY = 'harbour-game-quality'; // separate from the game save

/** Whatever applies a preset to the renderer. */
export interface QualityTarget {
  applyQuality(preset: QualityPreset): void;
}

export class Quality {
  mode: QualityMode = 'auto';
  level: QualityLevel = 'high';
  private sum = 0;
  private count = 0;
  private time = 0;

  constructor(private target: QualityTarget, private storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) {
    try {
      const m = storage?.getItem(QUALITY_KEY);
      if (m === 'auto' || m === 'high' || m === 'medium' || m === 'low') this.mode = m;
    } catch { /* storage may be blocked */ }
    this.level = this.mode === 'auto' ? 'high' : this.mode;
    this.target.applyQuality(QUALITY_PRESETS[this.level]);
  }

  setMode(mode: QualityMode): void {
    this.mode = mode;
    try { this.storage?.setItem(QUALITY_KEY, mode); } catch { /* ignore */ }
    this.set(mode === 'auto' ? 'high' : mode);
  }

  /** Call once a frame with the frame time in seconds. Only auto mode ever changes the level, and only downwards. */
  sample(dt: number): void {
    if (this.mode !== 'auto' || this.level === 'low') return;
    this.sum += dt * 1000;
    this.count++;
    this.time += dt;
    if (this.time < WINDOW_SECONDS) return;
    if (this.sum / this.count > SLOW_FRAME_MS) this.set(ORDER[ORDER.indexOf(this.level) + 1]);
    this.reset();
  }

  private set(level: QualityLevel): void {
    this.reset();
    this.level = level;
    this.target.applyQuality(QUALITY_PRESETS[level]);
  }

  private reset(): void {
    this.sum = 0;
    this.count = 0;
    this.time = 0;
  }
}
