import { BOAT_NAMES, BUILDING_IDS, LAYOUT, PROJECT_IDS, SPECIES, ZONE_IDS } from './config';
import { freeDockSlot } from './crates';
import { applyAway } from './away';
import type { AwayResult } from './away';
import { catchUpBookRewards, midSize } from './fishbook';
import { checkName } from './names';
import { catchUpGoals } from './goals';
import { guideForOldSave, newGuide } from './guide';
import { recordBoatCatch, rollBoatCatch } from './boats';
import { rankIndex } from './rank';
import { resetDockhands } from './staff';
import type { Rng } from './rng';
import { STATE_VERSION, emptyTally, initialState, newBoat } from './state';
import type { Captain, Ev, GameState } from './state';

export const SAVE_KEY = 'harbour-game-save';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Version 7: captains count trips (old ones start at 0) and pay is worked out each day, so the old stored wage goes. */
function cleanCaptain(c: Captain): Captain {
  const { wage: _old, ...rest } = c as Captain & { wage?: number };
  return { ...rest, trips: Math.max(0, Number(rest.trips) || 0) };
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
  // version 9 added the Big Cart and the Horse Wagon: older saves have neither
  s.upgrades = { handcart: !!d.upgrades?.handcart, bigcart: !!d.upgrades?.bigcart, wagon: !!d.upgrades?.wagon, stall1: !!d.upgrades?.stall1, stall2: !!d.upgrades?.stall2 };
  s.demand = { ...base.demand, ...(d.demand ?? {}) };
  s.book = { ...base.book, ...(d.book ?? {}) };
  for (const sp of SPECIES) s.book[sp] = { ...base.book[sp], ...s.book[sp] };
  s.bookClaims = { ...base.bookClaims, ...(d.bookClaims ?? {}) };
  for (const z of ZONE_IDS) s.bookClaims[z] = { ...base.bookClaims[z], ...s.bookClaims[z] };
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
    nb.captain = b.captain ? cleanCaptain(b.captain) : null;
    return nb;
  });
  s.crates = Array.isArray(d.crates) ? d.crates : [];
  delete (s as { haulPolicy?: unknown }).haulPolicy;
  s.orders = Array.isArray(d.orders) ? d.orders : [];
  s.orderCooldowns = Array.isArray(d.orderCooldowns) ? d.orderCooldowns : [];
  s.dockhands = Array.isArray(d.dockhands) ? d.dockhands : [];
  s.candidates = Array.isArray(d.candidates) ? d.candidates.map(cleanCaptain) : [];
  // ---- town projects (version 8)
  s.town = { ...base.town };
  for (const id of PROJECT_IDS) s.town[id] = !!d.town?.[id];
  // ---- fish book and sizes (version 5): crates from older saves get a middle size and are never golden
  for (const c of s.crates) if (c.size === undefined) c.size = midSize(c.species);
  if ((d.version ?? 0) < 5) catchUpBookRewards(s);
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
  if (typeof d.harbourName !== 'string' || checkName(d.harbourName).ok === false) s.harbourName = base.harbourName;
  else s.harbourName = checkName(d.harbourName).name!;
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
  // ---- starting guide (version 6): a save that is already past the opening never sees it; others carry on from where they are
  if ((d.version ?? 0) < 6) s.guide = guideForOldSave(s);
  else {
    const g = { ...newGuide(), ...(d.guide ?? {}) };
    g.seen = Array.isArray(g.seen) ? g.seen : [];
    s.guide = g;
  }
  // ---- ice box and cold store removed (version 7): crates that were stored go back on the dock as fresh as they were, and the money spent on them is refunded
  if ((d.version ?? 0) < 7) removeStorage(s, d);
  return s;
}

/** Cost of the removed cold store, level by level (it was 600, then 2000, then 6000 more). */
const OLD_COLD_COST = [0, 600, 2000, 6000];
const OLD_ICEBOX_COST = 120;

/** Put stored crates back on the dock and refund the ice box and the cold store. Goal numbers after the removed cold store goal move up by one. */
function removeStorage(s: GameState, d: Partial<GameState> & { buildings?: Record<string, number> }): void {
  for (const c of s.crates) {
    const loc = c.loc as string;
    if (loc !== 'ice' && loc !== 'cold') continue;
    c.loc = 'dock';
    const p = freeDockSlot(s, 0);
    c.x = p.x; c.z = p.z; c.layer = p.layer;
  }
  let refund = (d.upgrades as Record<string, boolean> | undefined)?.icebox ? OLD_ICEBOX_COST : 0;
  const cold = Math.max(0, Math.min(3, Math.floor(Number(d.buildings?.coldstore) || 0)));
  for (let i = 1; i <= cold; i++) refund += OLD_COLD_COST[i];
  s.money += refund;
  delete (s.buildings as Record<string, number>).coldstore;
  // the goal list lost its 'cold' goal (number 10); a save that was past it moves up by one
  if ((d.version ?? 0) >= 4 && s.goal > OLD_COLD_GOAL) s.goal -= 1;
}
const OLD_COLD_GOAL = 10;

/** Boats that were at sea come home with their catch ready; any cast line is reset; hauled crates go back on the dock. */
function settleLoaded(state: GameState, rng: Rng): void {
  resetDockhands(state);
  for (const b of state.boats) {
    if (b.status === 'out') {
      b.status = 'returned';
      b.progress = b.tripTime;
      b.catch = rollBoatCatch(state, b, rng);
      recordBoatCatch(state, b);
    }
    b.berth = Math.min(b.berth, LAYOUT.berths.length - 1);
  }
  state.fishing = { phase: 'idle', timer: 0 };
}

/** `now` is the wall-clock time in milliseconds, given by the caller; it is stored so a later load can work out how long the player was away. */
export function saveGame(state: GameState, storage: StorageLike, now?: number): boolean {
  try {
    if (now !== undefined) state.savedAt = now;
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

export interface LoadedGame { state: GameState; away: AwayResult | null; events: Ev[] }

/** Load, and credit what the harbour earned while the player was away. `now` is the wall-clock time in milliseconds. */
export function loadGameWithAway(storage: StorageLike, rng: Rng, now: number): LoadedGame | null {
  const state = loadGame(storage, rng);
  if (!state) return null;
  const secs = state.savedAt > 0 ? (now - state.savedAt) / 1000 : 0;
  const { result, events } = applyAway(state, secs, rng);
  return { state, away: result, events };
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
