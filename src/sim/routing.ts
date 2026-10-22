// Where a free worker takes crates: restaurant, then collecting smoked crates, then the smokehouse, then the market.
import { FISH_PRICE } from './config';
import { dockCrates, isSpoiled, smokeCrates, carryCapacity } from './crates';
import { rackRoom, restaurantRoom, restaurantWants } from './buildings';
import { crateValue } from './market';
import type { Crate, Dest, GameState } from './state';

export interface Plan { src: 'dock' | 'smoke'; dest: Dest; crates: Crate[] }

/** Crates that workers are already on their way with, by destination. */
function reserved(state: GameState, dest: Dest): number {
  let n = 0;
  for (const d of state.dockhands) if (d.job && d.job.phase !== 'back' && d.job.dest === dest) n += d.job.crateIds.length;
  return n;
}

export function roomFor(state: GameState, dest: Dest): number {
  switch (dest) {
    case 'restaurant': return state.buildings.restaurant ? restaurantRoom(state) - reserved(state, dest) : 0;
    case 'smoke': return state.buildings.smokehouse ? rackRoom(state) - reserved(state, dest) : 0;
    default: return Infinity;
  }
}

const claimed = (state: GameState, c: Crate): boolean => c.carrier !== undefined && state.dockhands.some((d) => d.id === c.carrier);

/** Where this fresh dock crate should go, by the worker rules. */
export function destFor(state: GameState, c: Crate): Dest {
  if (!c.smoked && restaurantWants(state, c) && roomFor(state, 'restaurant') > 0) return 'restaurant';
  if (!c.smoked && !c.golden && state.smokeList.includes(c.species) && roomFor(state, 'smoke') > 0) return 'smoke';
  return 'market';
}

const RANK: Record<Dest, number> = { restaurant: 0, smoke: 2, market: 3 };

/** Decide the next job for an idle worker, or null when there is nothing to do. */
export function planJob(state: GameState): Plan | null {
  const free = dockCrates(state).filter((c) => !isSpoiled(c) && !claimed(state, c) && !c.king);
  const pickups = smokeCrates(state).filter((c) => c.smoked && !claimed(state, c));
  type Cand = { c: Crate; dest: Dest; rank: number; v: number };
  const cands: Cand[] = free.map((c) => {
    const dest = destFor(state, c);
    return { c, dest, rank: RANK[dest], v: dest === 'restaurant' ? FISH_PRICE[c.species] : crateValue(state, c) };
  });
  // Restaurant first, then collecting smoked crates (frees a rack), then the rest.
  const restaurant = cands.filter((x) => x.dest === 'restaurant');
  const room = (dest: Dest) => Math.min(carryCapacity(state), roomFor(state, dest));
  const sortV = (a: Cand, b: Cand) => b.v - a.v || b.c.freshness - a.c.freshness;
  if (restaurant.length) {
    restaurant.sort(sortV);
    return group(restaurant, 'restaurant', room('restaurant'));
  }
  if (pickups.length) return { src: 'smoke', dest: 'market', crates: pickups.slice(0, carryCapacity(state)) };
  const smoke = cands.filter((x) => x.dest === 'smoke');
  if (smoke.length) {
    smoke.sort(sortV);
    return group(smoke, 'smoke', room('smoke'));
  }
  const rest = cands.sort(sortV);
  if (!rest.length) return null;
  const dest = rest[0].dest;
  return group(rest.filter((x) => x.dest === dest), dest, room(dest));
}

/** The best crate plus others near it (at most 4.5 away), up to a limit. */
function group(list: { c: Crate }[], dest: Dest, cap: number): Plan | null {
  if (!list.length || cap <= 0) return null;
  const first = list[0].c;
  const take: Crate[] = [first];
  for (const r of list.slice(1)) {
    if (take.length >= cap) break;
    if (Math.hypot((r.c.x ?? 0) - (first.x ?? 0), (r.c.z ?? 0) - (first.z ?? 0)) <= 4.5) take.push(r.c);
  }
  return { src: 'dock', dest, crates: take };
}
