import { SPECIES, START_MONEY } from './config';
import type { Phase, Species, Track, Trait, UpgradeId, ZoneId } from './config';

export type CrateLoc = 'dock' | 'hand' | 'ice' | 'haul';
export interface Crate {
  id: number;
  species: Species;
  freshness: number; // 0..100
  loc: CrateLoc;
  x?: number; // dock position
  z?: number;
  layer?: number;
  carrier?: number; // dockhand id that has claimed (or is carrying) this crate
}

export interface Captain {
  id: number;
  name: string;
  trait: Trait;
  wage: number;
  unpaid?: boolean; // could not be paid at the last 06:00, so idle today
}

export interface Pt { x: number; z: number }
export interface Job {
  phase: 'out' | 'haul' | 'back';
  path: Pt[];
  len: number;
  d: number; // distance walked along path
  crateIds: number[];
  dest: 'market' | 'ice';
}
export interface Dockhand {
  id: number;
  name: string;
  slot: number; // idle spot index at the pier head
  unpaid?: boolean;
  job: Job | null;
}

export type HaulPolicy = 'market' | 'ice';

export interface Boat {
  id: number;
  name: string;
  berth: number;
  hull: number; // 0..3
  hold: number; // 0..3
  gear: number; // 0..2
  sails: number; // 0..2
  target: ZoneId; // zone it sails to when sent or captained
  captain: Captain | null;
  status: 'docked' | 'out' | 'returned';
  zone: ZoneId | null;
  progress: number; // seconds into trip
  tripTime: number;
  catch: Species[]; // ready to unload when status === 'returned'
}

export interface Order {
  id: number;
  species: Species;
  qty: number;
  filled: number;
  deadline: number; // absolute clock seconds
  name: string;
  baseValue: number;
}

export interface FishingState {
  phase: 'idle' | 'waiting' | 'bite';
  timer: number;
}

export interface DayStats {
  earned: number; // all income, including order bonuses
  sold: number;
  spoiled: number;
  filled: number;
  missed: number;
  income: Record<Species, number>; // sale income by fish
  bonus: number; // order bonuses
  wages: number;
  tripCosts: number; // food and supplies paid when boats leave
  spent: number; // upgrades, boats and market stall
  best: { species: Species | null; price: number };
}

export interface GameState {
  version: number;
  money: number;
  day: number;
  dayTime: number; // seconds since 06:00
  clock: number; // monotonic seconds
  nextId: number;
  upgrades: Record<UpgradeId, boolean>;
  lifetime: number; // lifetime earnings, drives rank
  rank: number; // highest rank announced so far
  dockhands: Dockhand[];
  candidates: Captain[];
  haulPolicy: HaulPolicy;
  boats: Boat[];
  crates: Crate[];
  demand: Record<Species, number>;
  demandTimer: number;
  orders: Order[];
  orderCooldowns: number[];
  fishing: FishingState;
  book: Record<Species, { caught: number; bestSale: number }>;
  stats: DayStats;
  lastPhase: Phase;
}

export type Ev =
  | { type: 'boatDispatched'; boatId: number; zone: ZoneId; cost: number; auto?: boolean }
  | { type: 'boatReturned'; boatId: number; count: number; auto?: boolean }
  | { type: 'boatUnloaded'; boatId: number; count: number; auto?: boolean }
  | { type: 'cratePicked'; crateId: number }
  | { type: 'crateStored'; crateId: number }
  | { type: 'crateTaken'; crateId: number }
  | { type: 'crateSold'; species: Species; price: number; freshness: number; orderBonus: boolean; staff: boolean }
  | { type: 'crateSpoiled'; crateId: number; species: Species }
  | { type: 'crateDiscarded'; species: Species }
  | { type: 'orderPosted'; orderId: number }
  | { type: 'orderFilled'; orderId: number; name: string; bonus: number }
  | { type: 'orderMissed'; orderId: number; name: string }
  | { type: 'castStarted' }
  | { type: 'biteStarted' }
  | { type: 'fishLanded'; species: Species }
  | { type: 'fishLost'; reason: 'early' | 'late' | 'full' | 'cancelled' }
  | { type: 'upgradeBought'; id: UpgradeId }
  | { type: 'boatBought'; boatId: number }
  | { type: 'boatUpgraded'; boatId: number; track: Track; level: number }
  | { type: 'hired'; role: 'captain' | 'dockhand'; name: string }
  | { type: 'fired'; role: 'captain' | 'dockhand'; name: string }
  | { type: 'rankUp'; rank: number }
  | { type: 'wagesPaid'; paid: number; unpaid: number }
  | { type: 'phaseChanged'; phase: Phase }
  | { type: 'dayEnded'; day: number; stats: DayStats }
  | { type: 'denied'; reason: string; needRank?: number };

/** Result of a "can the player do this" check. needRank is set when only a higher rank is missing. */
export interface Check {
  ok: boolean;
  reason?: string;
  needRank?: number;
  cost?: number;
}

export const STATE_VERSION = 3;

function perSpecies<T>(f: () => T): Record<Species, T> {
  const o = {} as Record<Species, T>;
  for (const s of SPECIES) o[s] = f();
  return o;
}

export function emptyStats(): DayStats {
  return { earned: 0, sold: 0, spoiled: 0, filled: 0, missed: 0, income: perSpecies(() => 0), bonus: 0, wages: 0, tripCosts: 0, spent: 0, best: { species: null, price: 0 } };
}

export function newBoat(id: number, berth: number, name: string): Boat {
  return { id, name, berth, hull: 0, hold: 0, gear: 0, sails: 0, target: 'shallows', captain: null, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [] };
}

export function initialState(): GameState {
  return {
    version: STATE_VERSION,
    money: START_MONEY,
    day: 1,
    dayTime: 0,
    clock: 0,
    nextId: 3,
    upgrades: { icebox: false, handcart: false, stall1: false, stall2: false },
    lifetime: 0,
    rank: 0,
    dockhands: [],
    candidates: [],
    haulPolicy: 'market',
    boats: [newBoat(1, 0, 'Gull')],
    crates: [],
    demand: perSpecies(() => 1),
    demandTimer: 0,
    orders: [],
    orderCooldowns: [],
    fishing: { phase: 'idle', timer: 0 },
    book: perSpecies(() => ({ caught: 0, bestSale: 0 })),
    stats: emptyStats(),
    lastPhase: 'dawn',
  };
}

export function nextId(state: GameState): number {
  return state.nextId++;
}
