import { BOAT_NAMES, BUILDING_IDS, LAYOUT, SPECIES, ZONE_IDS } from './config';
import { catchUpGoals } from './goals';
import { recordCaught, rollBoatCatch } from './boats';
import { rankIndex } from './rank';
import { resetDockhands } from './staff';
import type { Rng } from './rng';
import { STATE_VERSION, emptyTally, initialState, newBoat } from './state';
import type { GameState } from './state';

export const SAVE_KEY = 'harbour-game-save';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Merge parsed data over a fresh state so missing fields (older saves) get defaults. v1 saves move their global Hold/Hull levels onto every boat; v2 saves get a zero trip-cost line (filled in by the merge above). Saves before version 4 get no buildings, a calm forecast, an empty contract board and goal progress worked out from what they already own (goals they already meet are skipped without a reward). */
function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<GameState> & { upgrades?: Record<string, boolean> };
  if (typeof d.version !== 'number' || d.version > STATE_VERSION) return null;
  const base = initialState();
  const old = d.version < 2;
  const s: GameState = { ...base, ...d, version: STATE_VERSION } as GameState;
  s.upgrades = { icebox: !!d.upgrades?.icebox, handcart: !!d.upgrades?.handcart, stall1: !!d.upgrades?.stall1, stall2: !!d.upgrades?.stall2 };
  s.demand = { ...base.demand, ...(d.demand ?? {}) };
  s.book = { ...base.book, ...(d.book ?? {}) };
  for (const sp of SPECIES) s.book[sp] = { ...base.book[sp], ...s.book[sp] };
  s.stats = { ...base.stats, ...(d.stats ?? {}) };
  s.stats.income = { ...base.stats.income, ...(d.stats?.income ?? {}) };
  s.stats.best = { ...base.stats.best, ...(d.stats?.best ?? {}) };
  const boats = Array.isArray(d.boats) && d.boats.length ? d.boats : base.boats;
  const holdLvl = d.upgrades?.hold2 ? 2 : d.upgrades?.hold1 ? 1 : 0;
  const hullLvl = d.upgrades?.hull ? 1 : 0;
  s.boats = boats.map((b, i) => {
    const nb = { ...newBoat(b.id, b.berth ?? i, b.name ?? BOAT_NAMES[i] ?? `Boat ${i + 1}`), ...b };
    if (old) {
      nb.hold = holdLvl;
      nb.hull = hullLvl;
    }
    nb.captain = b.captain ?? null;
    return nb;
  });
  s.crates = Array.isArray(d.crates) ? d.crates : [];
  s.orders = Array.isArray(d.orders) ? d.orders : [];
  s.orderCooldowns = Array.isArray(d.orderCooldowns) ? d.orderCooldowns : [];
  s.dockhands = Array.isArray(d.dockhands) ? d.dockhands : [];
  s.candidates = Array.isArray(d.candidates) ? d.candidates : [];
  if (old) {
    // Lifetime earnings were not tracked: use what was spent on upgrades plus the money in hand as a floor.
    const spent = (d.upgrades?.icebox ? 120 : 0) + (d.upgrades?.handcart ? 200 : 0) + (holdLvl >= 1 ? 150 : 0) + (holdLvl >= 2 ? 400 : 0) + (hullLvl ? 500 : 0) + (d.upgrades?.boat2 ? 800 : 0);
    s.lifetime = Math.max(s.lifetime ?? 0, spent + (d.money ?? 0));
    s.rank = rankIndex(s.lifetime);
  }
  // ---- tycoon stage (version 4)
  s.buildings = { ...base.buildings, ...(d.buildings ?? {}) };
  for (const id of BUILDING_IDS) s.buildings[id] = Math.max(0, Math.floor(Number(s.buildings[id]) || 0));
  s.smokeList = Array.isArray(d.smokeList) ? d.smokeList : base.smokeList;
  s.restaurant = { ...base.restaurant, ...(d.restaurant ?? {}) };
  s.contracts = { ...base.contracts, ...(d.contracts ?? {}) };
  s.king = { ...base.king, ...(d.king ?? {}) };
  s.incomeLog = Array.isArray(d.incomeLog) ? d.incomeLog : [];
  s.tally = { ...emptyTally(), ...(d.tally ?? {}), zoneSent: { ...emptyTally().zoneSent, ...(d.tally?.zoneSent ?? {}) } };
  if ((d.version ?? 0) < 4) {
    // Work out what the player has already done, so the goal chain starts at the right place.
    const t = s.tally;
    const played = s.lifetime > 0 || s.boats.some((b) => b.hull > 0 || b.hold > 0);
    if (played) {
      t.dispatched = Math.max(t.dispatched, 1);
      t.unloaded = Math.max(t.unloaded, 1);
      t.sold = Math.max(t.sold, Math.floor(s.lifetime / 20), 1);
      t.orders = Math.max(t.orders, s.lifetime >= 500 ? 1 : 0);
    }
    if (s.book.herring.caught + s.book.mackerel.caught > 0) t.pier = Math.max(t.pier, 1);
    const hull = Math.max(...s.boats.map((b) => b.hull));
    ZONE_IDS.forEach((z, i) => { if (i <= hull) t.zoneSent[z] = Math.max(t.zoneSent[z], 1); });
    s.goal = 0;
    catchUpGoals(s);
  }
  return s;
}

/** Boats that were at sea come home with their catch ready; any cast line is reset; hauled crates go back on the dock. */
function settleLoaded(state: GameState, rng: Rng): void {
  resetDockhands(state);
  for (const b of state.boats) {
    if (b.status === 'out') {
      b.status = 'returned';
      b.progress = b.tripTime;
      b.catch = rollBoatCatch(state, b, rng);
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
