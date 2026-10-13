import {
  CARRY_BASE, CARRY_HANDCART, CRATE_RANGE, DOCK_DECAY_SECONDS, ICE_CAPACITY, ICE_DECAY_SECONDS, LAYOUT, MIN_PRICE_MULT,
} from './config';
import type { Species } from './config';
import type { Crate, CrateLoc, Ev, GameState } from './state';
import { nextId } from './state';

export function freshnessMultiplier(f: number): number {
  const c = Math.max(0, Math.min(100, f));
  return MIN_PRICE_MULT + (1 - MIN_PRICE_MULT) * (c / 100);
}

export function isSpoiled(c: Crate): boolean {
  return c.freshness <= 0;
}

export function cratesAt(state: GameState, loc: CrateLoc): Crate[] {
  return state.crates.filter((c) => c.loc === loc);
}
export const handCrates = (s: GameState) => cratesAt(s, 'hand');
export const iceCrates = (s: GameState) => cratesAt(s, 'ice');
export const dockCrates = (s: GameState) => cratesAt(s, 'dock');

export function carryCapacity(state: GameState): number {
  return state.upgrades.handcart ? CARRY_HANDCART : CARRY_BASE;
}

export function slotPosition(berth: number, slot: number): { x: number; z: number; layer: number } {
  const b = LAYOUT.berths[berth];
  const per = b.slotX.length * LAYOUT.slotRows;
  const s = slot % per;
  const row = Math.floor(s / b.slotX.length);
  const col = s % b.slotX.length;
  return { x: b.slotX[col], z: LAYOUT.slotZ0 + LAYOUT.slotDZ * row, layer: Math.floor(slot / per) };
}

function freeDockSlot(state: GameState, berth: number): { x: number; z: number; layer: number } {
  const used = dockCrates(state);
  for (let i = 0; ; i++) {
    const p = slotPosition(berth, i);
    if (!used.some((c) => c.x === p.x && c.z === p.z && (c.layer ?? 0) === p.layer)) return p;
  }
}

export function addCrate(state: GameState, species: Species, loc: CrateLoc, berth = 0): Crate {
  const c: Crate = { id: nextId(state), species, freshness: 100, loc };
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
  for (const c of state.crates) {
    if (c.freshness <= 0) continue;
    const secs = c.loc === 'ice' ? ICE_DECAY_SECONDS : DOCK_DECAY_SECONDS;
    c.freshness = Math.max(0, c.freshness - (100 / secs) * dt);
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
  return [{ type: 'cratePicked', crateId: c.id }];
}

export function storeInIce(state: GameState, crateId: number): Ev[] {
  if (!state.upgrades.icebox) return [{ type: 'denied', reason: 'You need an ice box first.' }];
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'hand');
  if (!c) return [{ type: 'denied', reason: 'You are not carrying that.' }];
  if (iceCrates(state).length >= ICE_CAPACITY) return [{ type: 'denied', reason: 'The ice box is full.' }];
  c.loc = 'ice';
  return [{ type: 'crateStored', crateId: c.id }];
}

export function takeFromIce(state: GameState, crateId: number): Ev[] {
  const c = state.crates.find((k) => k.id === crateId && k.loc === 'ice');
  if (!c) return [{ type: 'denied', reason: 'Nothing there.' }];
  if (handCrates(state).length >= carryCapacity(state)) return [{ type: 'denied', reason: 'Your hands are full.' }];
  c.loc = 'hand';
  return [{ type: 'crateTaken', crateId: c.id }];
}
