import {
  CARRY_BASE, CARRY_HANDCART, CRATE_RANGE, DOCK_BIN_SIZE, DOCK_DECAY_SECONDS, LAYOUT, MIN_PRICE_MULT,
} from './config';
import type { Species } from './config';
import type { Crate, CrateLoc, Ev, GameState } from './state';
import { nextId } from './state';
import { midSize } from './fishbook';
import { isGentle } from './guide';

export function freshnessMultiplier(f: number): number {
  const c = Math.max(0, Math.min(100, f));
  return MIN_PRICE_MULT + (1 - MIN_PRICE_MULT) * (c / 100);
}

export function isSpoiled(c: Crate): boolean {
  return c.freshness <= 0;
}

function cratesAt(state: GameState, loc: CrateLoc): Crate[] {
  return state.crates.filter((c) => c.loc === loc);
}
export const handCrates = (s: GameState) => cratesAt(s, 'hand');
export const dockCrates = (s: GameState) => cratesAt(s, 'dock');
export const smokeCrates = (s: GameState) => cratesAt(s, 'smoke');

export function carryCapacity(state: GameState): number {
  return state.upgrades.handcart ? CARRY_HANDCART : CARRY_BASE;
}

/** Dock spots use the outer columns only (first and last), so the bigger bin crates have room side by side. */
const binCols = (berth: number): number[] => { const n = LAYOUT.berths[berth].slotX.length; return n > 1 ? [0, n - 1] : [0]; };

function slotPosition(berth: number, slot: number): { x: number; z: number; layer: number } {
  const b = LAYOUT.berths[berth];
  const cols = binCols(berth);
  const per = cols.length * LAYOUT.slotRows;
  const s = slot % per;
  const row = Math.floor(s / cols.length);
  return { x: b.slotX[cols[s % cols.length]], z: b.slotZ0 + LAYOUT.slotDZ * row, layer: Math.floor(slot / per) };
}

/** Crates already in the dock spot at this place. */
export const binCrates = (state: GameState, x: number | undefined, z: number | undefined): Crate[] =>
  state.crates.filter((c) => c.loc === 'dock' && c.x === x && c.z === z);

/**
 * Where a new crate goes on the dock. Crates share a spot (a bin) up to DOCK_BIN_SIZE, so the dock holds a few big crates
 * instead of many small ones; the first spot with room is filled first. `layer` is the crate's place inside its bin. When
 * every spot is full the least-full spot takes one more.
 */
export function freeDockSlot(state: GameState, berth: number): { x: number; z: number; layer: number } {
  const used = dockCrates(state);
  const spots = binCols(berth).length * LAYOUT.slotRows;
  let best: { x: number; z: number; layer: number } | null = null;
  for (let i = 0; i < spots; i++) {
    const p = slotPosition(berth, i);
    const n = used.filter((c) => c.x === p.x && c.z === p.z).length;
    if (n < DOCK_BIN_SIZE) return { x: p.x, z: p.z, layer: n };
    if (!best || n < best.layer) best = { x: p.x, z: p.z, layer: n };
  }
  return best!;
}

export function addCrate(state: GameState, species: Species, loc: CrateLoc, berth = 0, fish?: { size?: number; golden?: boolean }): Crate {
  const c: Crate = { id: nextId(state), species, freshness: 100, loc, size: fish?.size ?? midSize(species) };
  if (fish?.golden) c.golden = true;
  if (loc === 'dock') {
    const p = freeDockSlot(state, berth);
    c.x = p.x;
    c.z = p.z;
    c.layer = p.layer;
  }
  state.crates.push(c);
  return c;
}

export function removeCrate(state: GameState, id: number): void {
  state.crates = state.crates.filter((c) => c.id !== id);
}

/** Freshness decay for every crate. Emits crateSpoiled the moment one hits zero. */
export function decayCrates(state: GameState, dt: number): Ev[] {
  const evs: Ev[] = [];
  if (isGentle(state)) return evs; // new game: fish stay fresh until the first sale
  for (const c of state.crates) {
    if (c.freshness <= 0 || c.smoked || c.king || c.loc === 'smoke') continue; // smoked fish and the King Fish never spoil; crates on the racks are being smoked
    c.freshness = Math.max(0, c.freshness - (100 / DOCK_DECAY_SECONDS) * dt); // hauled crates spoil like dock crates
    if (c.freshness <= 0) {
      state.stats.spoiled += 1;
      evs.push({ type: 'crateSpoiled', crateId: c.id, species: c.species });
    }
  }
  return evs;
}

/** Discard spoiled crates everywhere (called at 06:00). */
export function discardSpoiled(state: GameState): void {
  state.crates = state.crates.filter((c) => !isSpoiled(c));
}

export function nearestDockCrate(state: GameState, x: number, z: number): Crate | null {
  let best: Crate | null = null;
  let bd = CRATE_RANGE;
  for (const c of dockCrates(state)) {
    const d = Math.hypot((c.x ?? 0) - x, (c.z ?? 0) - z);
    if (d <= bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export function pickUp(state: GameState, crateId: number): Ev[] {
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'dock');
  if (!c) return [{ type: 'denied', reason: 'No crate there.' }];
  if (isSpoiled(c)) {
    removeCrate(state, c.id);
    return [{ type: 'crateDiscarded', species: c.species }];
  }
  if (handCrates(state).length >= carryCapacity(state)) return [{ type: 'denied', reason: 'Your hands are full.' }];
  c.loc = 'hand';
  c.x = c.z = c.layer = undefined;
  c.carrier = undefined;
  return [{ type: 'cratePicked', crateId: c.id }];
}

/** Pick up as many crates as the hands can hold from the dock spot this crate is in, best (freshest) first. */
export function pickUpBin(state: GameState, crateId: number): Ev[] {
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'dock');
  if (!c) return [{ type: 'denied', reason: 'No crate there.' }];
  const bin = binCrates(state, c.x, c.z).sort((a, b) => b.freshness - a.freshness);
  const evs: Ev[] = [];
  for (const k of bin) {
    if (!isSpoiled(k) && handCrates(state).length >= carryCapacity(state)) break;
    const r = pickUp(state, k.id);
    if (r[0].type === 'denied') break;
    evs.push(...r);
  }
  return evs.length ? evs : pickUp(state, c.id);
}
