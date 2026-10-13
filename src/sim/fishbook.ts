// Fish sizes, star ratings, golden fish and the fish book.
import {
  BOOK_REWARD_CAUGHT, BOOK_REWARD_STARS, FISH_SIZE, GOLDEN_CHANCE, GOLDEN_CHANCE_MAX, GOLDEN_MULT, SIZE_PRICE_MAX, SIZE_PRICE_MIN,
  SPECIES, STAR2_FROM, STAR3_FROM, ZONES, ZONE_IDS,
} from './config';
import type { Species, ZoneId } from './config';
import { earnReward } from './ledger';
import type { Rng } from './rng';
import type { Crate, Ev, GameState } from './state';

/** The size a fish has when nothing was rolled (old saves, test crates): the middle of its range. */
export function midSize(species: Species): number {
  const [lo, hi] = FISH_SIZE[species];
  return Math.round((lo + hi) / 2);
}

/** Where a size falls in its species range: 0 = smallest, 1 = biggest. */
export function sizeFraction(species: Species, size: number): number {
  const [lo, hi] = FISH_SIZE[species];
  return Math.max(0, Math.min(1, (size - lo) / (hi - lo)));
}

/** Roll a size in cm. A bell-ish curve (three dice) so middle sizes are common and the biggest are rare. */
export function rollSize(species: Species, rng: Rng): number {
  const [lo, hi] = FISH_SIZE[species];
  const sum = rng.next() + rng.next() + rng.next();
  const t = Math.max(0, Math.min(1, sum / 2 - 0.25));
  return Math.round((lo + (hi - lo) * t) * 10) / 10;
}

/** 1 to 3 stars from where the size falls in the range; the top 10% is 3 stars. */
export function starsFor(species: Species, size: number): 1 | 2 | 3 {
  const t = sizeFraction(species, size);
  return t >= STAR3_FROM ? 3 : t >= STAR2_FROM ? 2 : 1;
}

/** Price factor from size: 0.9 for the smallest, 1 in the middle, 1.2 for the biggest. */
export function sizeMult(species: Species, size: number): number {
  const t = sizeFraction(species, size);
  return t < 0.5 ? 1 + SIZE_PRICE_MIN * (1 - t * 2) : 1 + SIZE_PRICE_MAX * (t * 2 - 1);
}

export const crateSize = (c: Crate): number => c.size ?? midSize(c.species);
export const crateStars = (c: Crate): 1 | 2 | 3 => starsFor(c.species, crateSize(c));
/** Price factor for a crate: size, and the golden bonus. */
export const crateWorth = (c: Crate): number => sizeMult(c.species, crateSize(c)) * (c.golden ? GOLDEN_MULT : 1);

/** Chance a crate is golden. rareMult is the Nets / Lucky captain multiplier used for rare fish. */
export const goldenChance = (rareMult = 1): number => Math.min(GOLDEN_CHANCE_MAX, GOLDEN_CHANCE * rareMult);

export function rollFish(species: Species, rng: Rng, rareMult = 1): { size: number; golden: boolean } {
  const size = rollSize(species, rng);
  return { size, golden: rng.next() < goldenChance(rareMult) };
}

/** Write a catch into the fish book. */
export function recordCatch(state: GameState, species: Species, size: number, golden: boolean): void {
  const b = state.book[species];
  b.caught += 1;
  b.biggest = Math.max(b.biggest, size);
  b.bestStars = Math.max(b.bestStars, starsFor(species, size));
  if (golden) b.golden += 1;
}

// ---- completion and zone rewards ---------------------------------------------

export interface BookCompletion { total: number; seen: number; threeStar: number; golden: number }

export function bookCompletion(state: GameState): BookCompletion {
  let seen = 0, threeStar = 0, golden = 0;
  for (const s of SPECIES) {
    const b = state.book[s];
    if (b.caught > 0) seen++;
    if (b.bestStars >= 3) threeStar++;
    if (b.golden > 0) golden++;
  }
  return { total: SPECIES.length, seen, threeStar, golden };
}

export const zoneFish = (zone: ZoneId): Species[] => Object.keys(ZONES[zone].table) as Species[];
export const zoneCaughtAll = (state: GameState, zone: ZoneId): boolean => zoneFish(zone).every((f) => state.book[f].caught > 0);
export const zoneAllThreeStar = (state: GameState, zone: ZoneId): boolean => zoneFish(zone).every((f) => state.book[f].bestStars >= 3);

/** Pay each zone reward once. */
export function stepBookRewards(state: GameState): Ev[] {
  const evs: Ev[] = [];
  for (const z of ZONE_IDS) {
    const c = state.bookClaims[z];
    if (!c.caught && zoneCaughtAll(state, z)) {
      c.caught = true;
      earnReward(state, BOOK_REWARD_CAUGHT[z]);
      evs.push({ type: 'bookReward', zone: z, kind: 'caught', amount: BOOK_REWARD_CAUGHT[z] });
    }
    if (!c.stars && zoneAllThreeStar(state, z)) {
      c.stars = true;
      earnReward(state, BOOK_REWARD_STARS[z]);
      evs.push({ type: 'bookReward', zone: z, kind: 'stars', amount: BOOK_REWARD_STARS[z] });
    }
  }
  return evs;
}

/** For old saves: zones already complete are marked as claimed without paying. */
export function catchUpBookRewards(state: GameState): void {
  for (const z of ZONE_IDS) {
    if (zoneCaughtAll(state, z)) state.bookClaims[z].caught = true;
    if (zoneAllThreeStar(state, z)) state.bookClaims[z].stars = true;
  }
}
