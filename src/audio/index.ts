/**
 * The one entry point the rest of the game uses: `GameAudio`.
 *
 *   audio.unlock()                       first user input (game.ts does this)
 *   audio.update(dt, x, z, dayTime, frozen)   once per frame
 *   audio.fx.<sound>()                   sound effects (see effects.ts)
 *   audio.setRain/setStorm/setFog(0..1)  weather layers
 *   audio.settings                       volumes and mute (see settings.ts)
 */
import { hourOf } from '../sim/time';
import { Ambience } from './ambience';
import { Effects } from './effects';
import type { Surface } from './effects';
import { AudioEngine } from './engine';
import { MARKET_POS, dayness } from './mix';
import {
  bellLevel, bellPos, bellRings, bellStrokes, crowdLevel, decaySales, nextCallDelay, panFor,
  marketPos, sellerCalls, sellerLevel, townMurmur, wetnessStep,
} from './town';
import type { TownState } from './town';
import { Music } from './music';
import { SettingsStore } from './settings';
import type { AudioSettings, VolumeKey } from './settings';

export type { AudioSettings, VolumeKey } from './settings';
export { DEFAULT_SETTINGS, SETTINGS_KEY, SettingsStore } from './settings';

/** Roughly where the cat likes to sit (the cat itself wanders near here). */
const CAT_HOME = { x: MARKET_POS.x + 2.6, z: MARKET_POS.z + 3 };

export class GameAudio {
  readonly settings = new SettingsStore();
  /** Called after M toggles mute, so the game can show a toast. */
  onMuteChange: (muted: boolean) => void = () => {};

  private engine = new AudioEngine();
  readonly fx = new Effects(this.engine);
  private ambience = new Ambience(this.engine, this.fx);
  private music = new Music(this.engine);

  private pz = 6;
  private envTimer = 0;
  private nextMeow = 20;
  private wasFrozen = false;
  private suppressPanelUntil = 0;
  private lastClick = -99;
  private hour = 8;
  private town: TownState = { rank: 0, marketDay: false };
  private recentSales = 0;
  private wetness = 0;
  private lastHourRung = -1;
  private nextCall = 12;

  constructor() {
    this.settings.subscribe((s) => {
      this.engine.applySettings(s);
      this.music.setEnabled(!s.muted && s.music > 0.001 && s.master > 0.001);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyM' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        this.onMuteChange(this.settings.toggleMuted());
      });
      document.addEventListener('visibilitychange', () => this.engine.setHidden(document.hidden));
    }
  }

  /** Call from the first keydown / pointerdown. Never throws. */
  unlock(): void {
    try {
      if (!this.engine.unlock()) return;
      this.engine.applySettings(this.settings.get());
      this.ambience.start();
      this.music.start();
    } catch {
      // the browser refused audio: the game carries on silently
    }
  }

  // ---- settings API (for the future volume sliders) -----------------------------

  getSettings(): Readonly<AudioSettings> { return this.settings.get(); }
  setVolume(key: VolumeKey, v: number): void { this.settings.setVolume(key, v); }
  setMuted(m: boolean): void { this.settings.setMuted(m); }
  toggleMute(): boolean { const m = this.settings.toggleMuted(); this.onMuteChange(m); return m; }

  // ---- weather layers (single call each, 0 = off, 1 = full) -------------------------

  setRain(v: number): void { this.ambience.setRain(v); }
  setStormWind(v: number): void { this.ambience.setStorm(v); }
  setFog(v: number): void { this.ambience.setFog(v); }

  // ---- town state (set by the event router when it changes) --------------------------

  /** Harbour rank and market day: they set how busy the town sounds. */
  setTownState(s: Partial<TownState>): void { this.town = { ...this.town, ...s }; }
  /** A crate was sold: the crowd gets a little louder for a while. */
  noteSale(count = 1): void { this.recentSales = Math.min(30, this.recentSales + count); }

  // ---- per frame -------------------------------------------------------------------

  /** Once per frame: player position, game clock (seconds since 06:00) and whether a panel is open. */
  update(dt: number, x: number, z: number, dayTime: number, panelOpen: boolean): void {
    this.pz = z;
    const prevHour = this.hour;
    this.hour = hourOf(dayTime);
    this.wetness = wetnessStep(this.wetness, this.ambience.getWeather().rain, dt);
    this.recentSales = decaySales(this.recentSales, dt);
    if (!this.engine.running) return;
    const now = this.engine.now();

    if (panelOpen !== this.wasFrozen) {
      this.wasFrozen = panelOpen;
      if (now >= this.suppressPanelUntil && now - this.lastClick > 0.15) {
        if (panelOpen) this.fx.panelOpen();
        else this.fx.panelClose();
      }
    }
    this.music.tick(this.hour);

    this.envTimer += dt;
    if (this.envTimer < 0.1) return;
    this.envTimer = 0;
    const crowd = crowdLevel(this.town.rank, this.recentSales, this.town.marketDay);
    const day = dayness(this.hour);
    this.ambience.update(x, z, this.hour, townMurmur(crowd, x, z, day));
    this.townLife(x, z, prevHour, crowd);

    // The cat meows now and then when the player is near its corner.
    this.nextMeow -= 0.1;
    if (this.nextMeow <= 0) {
      this.nextMeow = 25 + Math.random() * 35;
      if (Math.hypot(x - CAT_HOME.x, z - CAT_HOME.z) < 7) this.fx.meow();
    }
  }

  /** The hour bell and the fish seller, checked ten times a second. */
  private townLife(x: number, z: number, prevHour: number, crowd: number): void {
    const h = this.hour;
    const whole = Math.floor(h);
    // The bell rings once as the clock crosses a whole hour (not when the clock jumps back).
    if (whole !== Math.floor(prevHour) && whole !== this.lastHourRung && h - whole < 0.5 && bellRings(whole)) {
      this.lastHourRung = whole;
      const b = bellPos();
      this.fx.hourBell(bellStrokes(whole), bellLevel(Math.hypot(x - b.x, z - b.z)), panFor(x, b.x));
    }
    const storm = this.ambience.getWeather().storm;
    this.nextCall -= 0.1;
    if (this.nextCall <= 0) {
      this.nextCall = nextCallDelay(crowd, Math.random());
      if (sellerCalls(h, storm)) {
        this.fx.sellerCall(sellerLevel(x, z), panFor(x, marketPos().x));
      }
    }
  }

  // ---- calls the game already makes ---------------------------------------------------

  /** One footstep, on wood out on the pier and stone in town. */
  step(): void {
    const surface: Surface = this.pz < -0.5 ? 'wood' : 'stone';
    this.fx.step(surface, this.wetness);
  }

  /** Button press / panel closed by the interface. */
  click(): void {
    this.lastClick = this.engine.now();
    this.fx.click();
  }

  // ---- bigger sounds that mix several layers ------------------------------------------

  /** Morning: a gentle sting on the music. */
  dawn(): void { this.music.dawnSting(); }

  /** The day report is about to open: its own sound, and no extra panel-open tick. */
  dayReport(): void {
    this.suppressPanelUntil = this.engine.now() + 0.6;
    this.fx.dayReport();
  }
}
