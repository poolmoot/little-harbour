import * as THREE from 'three';
import { LAYOUT, SPECIES } from '../sim/config';
import { hourOf } from '../sim/time';
import type { Ev, GameState } from '../sim/state';
import { decaySales } from '../audio/town';
import type { SceneRig } from './scene';
import type { Life } from './life';
import { MAX_EXTRA_STROLLERS } from './life';
import type { Player } from './player';
import type { QualityLevel } from './quality';
import { MarketQueue } from './townQueue';
import { PierCrowd } from './townCrowd';
import { Terrace } from './townTerrace';
import { Particles, Sway, Wetness } from './townReact';
import { CAPS, dinerCount, queueLength, raisesDust, strollerCount, weatherRain } from './townRules';
import type { TownHooks } from './townHooks';
import type { World } from './world';

/**
 * The town that shows your business and answers you: the market queue, the restaurant terrace, the crowd on the pier, the
 * busy streets, dust and puddles and swaying signs. It reads the game state and the events (never changes them) and asks
 * the sound side for noises through `hooks`.
 */
export class TownLife {
  readonly queue: MarketQueue;
  readonly terrace: Terrace;
  readonly crowd: PierCrowd;
  readonly wet: Wetness;
  private particles: Particles;
  private sway: Sway;
  private recentSales = 0;
  private serveAt = -99;
  private now = 0;
  private lastQuality: QualityLevel | '' = '';

  constructor(
    scene: THREE.Scene,
    world: World,
    private life: Life,
    private player: Player,
    private hooks: TownHooks,
    private quality: () => QualityLevel,
  ) {
    this.queue = new MarketQueue(scene, world, CAPS.high.queue);
    this.terrace = new Terrace(scene, world, CAPS.high.diners);
    this.crowd = new PierCrowd(scene, world, CAPS.high.crowd);
    this.wet = new Wetness(scene, world);
    this.particles = new Particles(scene, CAPS.high.particles);
    this.sway = new Sway(world);
    if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __town?: TownLife }).__town = this; // dev-only, for scripted checks
  }

  /** Called with every batch of sim events. */
  notice(evs: Ev[], state: GameState): void {
    for (const e of evs) {
      switch (e.type) {
        case 'crateSold':
          this.recentSales++;
          this.queue.noteSale();
          break;
        case 'boatReturned':
          if (e.count >= 5) this.crowd.gather('big', e.count, this.berthFocus(state, e.boatId), e.boatId, this.now);
          break;
        case 'boatUnloaded':
          this.crowd.unloaded(e.boatId, this.now);
          break;
        case 'goldenCaught':
          this.crowd.gather('golden', 1, { x: LAYOUT.fishingSpot.x, z: LAYOUT.fishingSpot.z * 0.5 }, -1, this.now);
          break;
        case 'kingFishFound':
          this.crowd.gather('king', 1, this.berthFocus(state, e.boatId), e.boatId, this.now);
          break;
        case 'restaurantServed':
          this.serveAt = this.now;
          break;
        default: break;
      }
    }
  }

  /** Where a boat lies, for the crowd to look at. */
  private berthFocus(state: GameState, boatId: number): { x: number; z: number } {
    const b = state.boats.find((x) => x.id === boatId);
    const berth = LAYOUT.berths[b ? b.berth : 0] ?? LAYOUT.berths[0];
    return { x: berth.boatX, z: berth.boatZ };
  }

  update(dt: number, now: number, state: GameState, sky: SceneRig['skyState']): void {
    this.now = now;
    const hour = hourOf(state.dayTime);
    const q = this.quality();
    const caps = CAPS[q];
    if (q !== this.lastQuality) { this.lastQuality = q; this.particles.setCapacity(caps.particles); }
    this.recentSales = decaySales(this.recentSales, dt);

    let demand = 0;
    for (const s of SPECIES) demand += state.demand[s];
    demand /= SPECIES.length;
    const stall = state.upgrades.stall2 ? 2 : state.upgrades.stall1 ? 1 : 0;
    const marketDay = state.special?.kind === 'market';
    this.queue.update(dt, now, queueLength({ stall, recentSales: this.recentSales, demand, hour, weather: state.weather, marketDay }, caps.queue));

    const level = state.buildings.restaurant;
    const wanted = dinerCount({ level, served: state.restaurant.served, hour, weather: state.weather, recentServe: now - this.serveAt < 25 }, caps.diners);
    const rp = LAYOUT.plots.restaurant;
    const p = this.player.pos;
    this.terrace.update(dt, now, level, wanted, sky.lantern, Math.hypot(p.x - rp.x, p.z - rp.z), (l) => this.hooks.tableChatter(l));

    this.crowd.update(dt, now, caps.crowd);
    this.life.setStrollers(Math.min(MAX_EXTRA_STROLLERS, strollerCount(state.rank, hour, caps.strollers)));
    this.life.playerFacing = this.player.facing;

    this.wet.update(dt, weatherRain(state.weather), sky);
    this.sway.update(dt, p.x, p.z, this.player.speed);
    if (this.player.figure.landed && dt > 0) {
      const puddle = this.wet.puddleAt(p.x, p.z);
      if (puddle) { this.particles.splash(p.x, p.z); this.hooks.splash(); }
      else if (p.z > -0.5 && raisesDust(this.wet.value, this.player.speed)) this.particles.dust(p.x, p.z);
    }
    this.particles.update(dt);
  }
}
