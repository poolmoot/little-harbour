import { LAYOUT, SPECIES } from './config';
import { rollCatch } from './catch';
import { recordCaught } from './boats';
import type { Rng } from './rng';
import { STATE_VERSION, initialState } from './state';
import type { GameState } from './state';
import { phaseOf } from './time';
import { holdSize } from './state';

export const SAVE_KEY = 'harbour-game-save';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Merge parsed data over a fresh state so missing fields (older saves) get defaults. */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<GameState>;
  if (typeof d.version !== 'number' || d.version > STATE_VERSION) return null;
  const base = initialState();
  const s: GameState = { ...base, ...d, version: STATE_VERSION } as GameState;
  s.upgrades = { ...base.upgrades, ...(d.upgrades ?? {}) };
  s.demand = { ...base.demand, ...(d.demand ?? {}) };
  s.book = { ...base.book, ...(d.book ?? {}) };
  for (const sp of SPECIES) s.book[sp] = { ...base.book[sp], ...s.book[sp] };
  s.stats = { ...base.stats, ...(d.stats ?? {}) };
  s.boats = Array.isArray(d.boats) && d.boats.length ? d.boats : base.boats;
  s.crates = Array.isArray(d.crates) ? d.crates : [];
  s.orders = Array.isArray(d.orders) ? d.orders : [];
  s.orderCooldowns = Array.isArray(d.orderCooldowns) ? d.orderCooldowns : [];
  return s;
}

/** Boats that were at sea come home with their catch ready; any cast line is reset. */
export function settleLoaded(state: GameState, rng: Rng): void {
  for (const b of state.boats) {
    if (b.status === 'out') {
      b.status = 'returned';
      b.progress = b.tripTime;
      b.catch = rollCatch(b.zone ?? 'shallows', phaseOf(state.dayTime), holdSize(state), rng);
      for (const sp of b.catch) recordCaught(state, sp);
    }
    b.berth = Math.min(b.berth, LAYOUT.berths.length - 1);
  }
  state.fishing = { phase: 'idle', timer: 0 };
}

export function saveGame(state: GameState, storage: StorageLike): boolean {
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: StorageLike, rng: Rng): GameState | null {
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) return null;
    const s = migrate(JSON.parse(text));
    if (!s) return null;
    settleLoaded(s, rng);
    return s;
  } catch {
    return null;
  }
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
