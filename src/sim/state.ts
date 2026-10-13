import { SPECIES } from './config';
import type { Phase, Species, UpgradeId, ZoneId } from './config';

export type CrateLoc = 'dock' | 'hand' | 'ice';
export interface Crate {
  id: number;
  species: Species;
  freshness: number; // 0..100
  loc: CrateLoc;
  x?: number; // dock position
  z?: number;
  layer?: number;
}

export interface Boat {
  id: number;
  berth: number;
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
  earned: number;
  sold: number;
  spoiled: number;
  filled: number;
  missed: number;
}

export interface GameState {
  version: number;
  money: number;
  day: number;
  dayTime: number; // seconds since 06:00
  clock: number; // monotonic seconds
  nextId: number;
  upgrades: Record<UpgradeId, boolean>;
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
  | { type: 'boatDispatched'; boatId: number; zone: ZoneId }
  | { type: 'boatReturned'; boatId: number; count: number }
  | { type: 'boatUnloaded'; boatId: number; count: number }
  | { type: 'cratePicked'; crateId: number }
  | { type: 'crateStored'; crateId: number }
  | { type: 'crateTaken'; crateId: number }
  | { type: 'crateSold'; species: Species; price: number; freshness: number; orderBonus: boolean }
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
  | { type: 'phaseChanged'; phase: Phase }
  | { type: 'dayEnded'; day: number; stats: DayStats }
  | { type: 'denied'; reason: string };

export const STATE_VERSION = 1;

export function emptyStats(): DayStats {
  return { earned: 0, sold: 0, spoiled: 0, filled: 0, missed: 0 };
}

function perSpecies<T>(f: () => T): Record<Species, T> {
  const o = {} as Record<Species, T>;
  for (const s of SPECIES) o[s] = f();
  return o;
}

export function initialState(): GameState {
  return {
    version: STATE_VERSION,
    money: 0,
    day: 1,
    dayTime: 0,
    clock: 0,
    nextId: 3,
    upgrades: { icebox: false, handcart: false, hold1: false, hold2: false, hull: false, boat2: false },
    boats: [{ id: 1, berth: 0, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [] }],
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

export function holdSize(state: GameState): number {
  return state.upgrades.hold2 ? 8 : state.upgrades.hold1 ? 6 : 4;
}
