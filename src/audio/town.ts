/**
 * Pure maths for the town sounds: the hour bell, the fish seller's calls, the crowd
 * murmur, cheers and wet footsteps. No Web Audio in here, so it is all unit tested.
 */
import { HOUR_SECONDS, LAYOUT } from '../sim/config';
import { dayness, smoothstep } from './mix';

/** What the audio needs to know about the town (set by the event router, not per frame). */
export interface TownState {
  /** Harbour rank, 0 and up. */
  rank: number;
  /** True on a market day. */
  marketDay: boolean;
}

/**
 * Where the hour bell hangs. CHANGE THIS ONE LINE if the layout gets a bell tower:
 * it follows `LAYOUT.bellTower` when that exists, otherwise the inn.
 */
export function bellPos(): { x: number; z: number } {
  const l = LAYOUT as unknown as { bellTower?: { x: number; z: number } };
  return l.bellTower ?? LAYOUT.inn;
}

export function marketPos(): { x: number; z: number } { return LAYOUT.market; }
export function restaurantPos(): { x: number; z: number } { return LAYOUT.plots.restaurant; }

export const BELL_FIRST_HOUR = 7;
export const BELL_LAST_HOUR = 19;
/** Most people never hear more than four strokes. */
export const BELL_MAX_STROKES = 4;

/** Does the bell ring at the top of this whole hour? Day only. */
export function bellRings(hour: number): boolean {
  return hour >= BELL_FIRST_HOUR && hour <= BELL_LAST_HOUR;
}

/** 1 to 4 strokes, varying with the hour but never twelve. */
export function bellStrokes(hour: number): number {
  return 1 + (((Math.floor(hour) % BELL_MAX_STROKES) + BELL_MAX_STROKES) % BELL_MAX_STROKES);
}

/** How loud the bell is for a listener: 1 close by, a quiet 0.2 at the far end of town. */
export function bellLevel(dist: number): number {
  return 0.2 + 0.8 * (1 - smoothstep(3, 38, dist));
}

/** How busy the town is, 0..1, from rank, recent crate sales (decaying count) and market day. */
export function crowdLevel(rank: number, recentSales: number, marketDay: boolean): number {
  const r = Math.min(1, Math.max(0, rank) / 5) * 0.4;
  const s = Math.min(1, Math.max(0, recentSales) / 12) * 0.4;
  return Math.min(1, 0.1 + r + s + (marketDay ? 0.2 : 0));
}

/** Recent sales fade with a half-life of about 40 seconds. */
export function decaySales(sales: number, dt: number): number {
  return sales * Math.pow(0.5, dt / 40);
}

/**
 * Level of the murmur bed (1 is the old full level): follows the crowd, loudest near the
 * market and the restaurant, and 0 at night (`day` is 1 by day, 0 at night; see `dayness`).
 * Weather (storm, rain) is applied by the caller.
 */
export function townMurmur(crowd: number, x: number, z: number, day: number): number {
  const near = Math.max(nearness(x, z, marketPos(), 4, 17), nearness(x, z, restaurantPos(), 3, 14) * 0.85);
  return day * (0.45 + 1.05 * crowd) * near;
}

function nearness(x: number, z: number, p: { x: number; z: number }, a: number, b: number): number {
  return 1 - smoothstep(a, b, Math.hypot(x - p.x, z - p.z));
}

/** Gain for the seller's call: loud close to the market, gone beyond about 30 units. */
export function sellerLevel(x: number, z: number): number {
  return 1 - smoothstep(4, 30, Math.hypot(x - marketPos().x, z - marketPos().z));
}

/** Seconds until the next call: 20 to 60, shorter when the market is busy. `r` is 0..1. */
export function nextCallDelay(crowd: number, r: number): number {
  return (20 + 40 * r) * (1.25 - 0.6 * crowd);
}

/** Calls only by day. */
export function sellerCalls(hour: number, storm: number): boolean {
  return dayness(hour) > 0.7 && storm < 0.5;
}

/** Stereo position for a sound at world x as heard from player x, -0.7..0.7. */
export function panFor(px: number, sx: number): number {
  return Math.max(-0.7, Math.min(0.7, (sx - px) / 25));
}

/** Wetness of the cobbles, 0..1: climbs while it rains, dries over about 3 in-game hours. */
export function wetnessStep(wet: number, rain: number, dt: number): number {
  const up = rain > 0.15 ? (rain * dt) / (0.5 * HOUR_SECONDS) : 0;
  const down = rain > 0.15 ? 0 : dt / (3 * HOUR_SECONDS);
  return Math.min(1, Math.max(0, wet + up - down));
}

/** Chance that a wet step also splashes (never more than one in three). */
export function splashChance(wet: number): number {
  return wet < 0.2 ? 0 : Math.min(0.33, (wet - 0.2) * 0.45);
}

/** Cheer size: 0 none, 1 small, 2 bigger. Boats with five or more crates get a small cheer. */
export const BIG_CATCH_CRATES = 5;
export function catchCheer(crates: number): 0 | 1 {
  return crates >= BIG_CATCH_CRATES ? 1 : 0;
}
