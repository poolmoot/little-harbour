import { RESTAURANT_CAPACITY } from '../sim/config';
import type { WeatherId } from '../sim/config';
import { BIG_CATCH_CRATES } from '../audio/town';
import type { QualityLevel } from './quality';

/**
 * Small pure rules for the town's life: how long the market queue is, how many people sit at the terrace, how big a
 * crowd a catch draws, how many townsfolk stroll, and the timing of the little reactions. No Three.js, so all tested.
 */

/** Most people of each kind that may exist at once, by picture quality. Lower levels thin the crowds out. */
export interface Caps { queue: number; diners: number; crowd: number; strollers: number; particles: number }
export const CAPS: Record<QualityLevel, Caps> = {
  high: { queue: 4, diners: 6, crowd: 8, strollers: 4, particles: 48 },
  medium: { queue: 3, diners: 4, crowd: 5, strollers: 2, particles: 32 },
  low: { queue: 2, diners: 2, crowd: 3, strollers: 0, particles: 16 },
};

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Rain strength of a day's weather, 0..1. The sound side (`weatherSound`) and the wet cobbles both read this one table. */
export function weatherRain(w: WeatherId): number {
  return w === 'storm' ? 1 : 0;
}

/** Daylight hours when townsfolk are out shopping and strolling. */
export function townIsAwake(hour: number): boolean {
  return hour >= 7 && hour < 19.5;
}
/** The terrace serves a little longer, into the evening. */
export function terraceOpen(hour: number): boolean {
  return hour >= 9.5 && hour < 22.5;
}

export interface QueueInput {
  /** Stall level 0..2. */
  stall: number;
  /** Crate sales in the last minute or so (decaying count). */
  recentSales: number;
  /** Average price level over all fish, 0.5 (cheap) to 1 (full price). */
  demand: number;
  hour: number;
  weather: WeatherId;
  marketDay: boolean;
}

/** How many customers wait at the stall: none at night or in a storm; longer with a bigger stall, brisk sales and good prices. */
export function queueLength(q: QueueInput, cap: number): number {
  if (!townIsAwake(q.hour) || q.weather === 'storm') return 0;
  const heat = clamp(q.recentSales / 10, 0, 1);
  const price = clamp((q.demand - 0.6) / 0.4, 0, 1);
  const n = 1 + q.stall * 0.7 + heat * 2 + price + (q.marketDay ? 1 : 0);
  return clamp(Math.round(n), 1, cap);
}

/** Customers wait a little longer when nothing sells; a sale lets the one at the front buy straight away. */
export const QUEUE_BUY_SECONDS = [3.5, 7];

export interface TerraceInput { level: number; served: number; hour: number; weather: WeatherId; recentServe: boolean }

/** How many diners sit at the terrace tables (two per table, one table per restaurant level), in proportion to how many the restaurant served today. */
export function dinerCount(t: TerraceInput, cap: number): number {
  const level = clamp(Math.floor(t.level), 0, 3);
  if (level < 1 || !terraceOpen(t.hour) || t.weather === 'storm') return 0;
  const seats = level * 2;
  const fill = clamp(t.served / (RESTAURANT_CAPACITY[level] || 1), 0, 1);
  let n = Math.round(fill * seats * 1.15);
  if (t.recentServe) n = Math.max(n, 1);
  return clamp(Math.min(n, seats), 0, cap);
}

export type CrowdKind = 'big' | 'golden' | 'king';

/** How many townsfolk come to see a catch. Five crates is a big catch (the same threshold as the cheer). */
export function crowdSize(kind: CrowdKind, crates: number, cap: number): number {
  if (kind === 'king') return Math.min(cap, 8);
  if (kind === 'golden') return Math.min(cap, 6);
  if (crates < BIG_CATCH_CRATES) return 0;
  return Math.min(cap, 3 + Math.min(3, Math.floor((crates - BIG_CATCH_CRATES) / 2)));
}

/** Extra strolling townsfolk (on top of the four who always walk): one more per harbour rank, by day, never above the cap. */
export function strollerCount(rank: number, hour: number, cap: number): number {
  if (!townIsAwake(hour)) return 0;
  return clamp(Math.floor(rank), 0, cap);
}

/** Share of the strollers who carry something (a basket or a parcel of fish). */
export const CARRY_SHARE = 0.45;

// ---- reactions ---------------------------------------------------------------------------------

/** A ground gull takes off when the player is this close. */
export const GULL_FLUSH_DIST = 1.8;
export function gullTakeOffLevel(dist: number): number {
  return clamp(1.1 - dist / 4, 0.4, 1);
}
/** Seconds before a startled gull comes back to the ground (random is 0..1). */
export function gullSettleDelay(random: number): number {
  return 22 + random * 25;
}

/** Cobbles stay visibly wet down to this wetness; below it the puddles are gone. */
export function puddleSize(wet: number, threshold: number): number {
  return smoothstep(threshold, threshold + 0.35, wet);
}

/** How the stone looks at a wetness: colour multiplier (darker, a little blue) and roughness. */
export function wetLook(wet: number): { tint: [number, number, number]; rough: number } {
  const w = smoothstep(0.05, 0.7, wet);
  return { tint: [1 - 0.34 * w, 1 - 0.3 * w, 1 - 0.2 * w], rough: 0.95 - 0.5 * w };
}

/** A footstep raises dust on dry stone only, and only at a brisk pace. */
export function raisesDust(wet: number, speed: number): boolean {
  return wet < 0.15 && speed > 2.2;
}

/** Push given to a hanging sign or net when the player brushes past (0 when too far). */
export function brushImpulse(dist: number, radius: number, speed: number): number {
  if (dist >= radius || speed < 0.5) return 0;
  return (1 - dist / radius) * Math.min(1, speed / 4);
}

/** The cat rubbing against the player's legs: side to side in a slow figure of eight. t in seconds. */
export function catRub(t: number): { side: number; ahead: number } {
  return { side: Math.sin(t * 2.3) * 0.38, ahead: 0.42 + Math.cos(t * 4.6) * 0.07 };
}

/** The cat comes to the player when they stand near the market, no longer carrying fish, and it has not just done so. */
export function catWantsPlayer(distToPlayer: number, playerNearMarket: boolean, carrying: boolean, sinceLast: number): boolean {
  return !carrying && playerNearMarket && distToPlayer < 8 && distToPlayer > 1.2 && sinceLast > 25;
}

/** A passer-by waves back about half the time they notice the player. */
export function friendlyShare(roll: number): boolean {
  return roll < 0.5;
}
