import { DEFAULT_HARBOUR_NAME, DEFAULT_SMOKE_LIST, PROJECT_IDS, SPECIES, START_MONEY, ZONE_IDS } from './config';
import { newGuide } from './guide';
import type { GuideState, UnlockId } from './guide';
import type { BuildingId, Phase, ProjectId, Species, Track, Trait, UpgradeId, WeatherId, ZoneId } from './config';

export type CrateLoc = 'dock' | 'hand' | 'haul' | 'smoke';
export interface Crate {
  id: number;
  species: Species;
  freshness: number; // 0..100
  loc: CrateLoc;
  x?: number; // dock position
  z?: number;
  layer?: number;
  carrier?: number; // dockhand id that has claimed (or is carrying) this crate
  size?: number; // length in cm, rolled when caught
  golden?: boolean; // rare golden fish: sells for much more, never smoked by workers
  smoked?: boolean; // finished smoked fish: sells for more, ignores freshness, never spoils
  smokeLeft?: number; // seconds left in the smokehouse (loc 'smoke'); 0 when ready to collect
  king?: boolean; // the King Fish: never sold, never spoils, goes to the inn
}

export interface Captain {
  id: number;
  name: string;
  trait: Trait;
  trips?: number; // trips finished: sets the level (captains.ts). Pay is worked out from it and the boat each day.
  unpaid?: boolean; // could not be paid at the last 06:00, so idle today
}

export interface Pt { x: number; z: number }
export interface Job {
  phase: 'out' | 'haul' | 'back';
  path: Pt[];
  len: number;
  d: number; // distance walked along path
  crateIds: number[];
  dest: Dest;
  src?: 'dock' | 'smoke'; // where the crates are picked up (default: the dock)
}
export type Dest = 'market' | 'restaurant' | 'smoke';
export interface Dockhand {
  id: number;
  name: string;
  slot: number; // idle spot index at the pier head
  unpaid?: boolean;
  job: Job | null;
}

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
  stayInStorms: boolean; // does not sail to Open Sea or Deep Sea on a storm day
  damaged?: boolean; // came back from a storm broken: fix it at the shipyard
  repairLeft?: number; // seconds of repair work left, when being fixed
  tripWeather?: WeatherId; // weather when it left
  tripBonus?: number; // extra crates from a Big catch day
  nightTrip?: boolean; // left at night (lighthouse)
  king?: boolean; // the King Fish is in the catch
  catchInfo?: { size: number; golden: boolean }[]; // size and golden for each fish in `catch` (same order)
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
  upkeep: number; // care for the boats, paid at 06:00
  tripCosts: number; // food and supplies paid when boats leave
  rewards: number; // goal rewards (not part of earned)
  away: number; // earnings while the player was away (not part of earned)
  spent: number; // upgrades, boats and market stall
  best: { species: Species | null; price: number };
}

export type Special = { kind: 'market' } | { kind: 'bigcatch'; zone: ZoneId } | null;

export interface Contract {
  id: number;
  species: Species;
  smoked: boolean;
  qty: number;
  filled: number;
  days: number; // days allowed once accepted
  deadline: number; // absolute clock seconds, set when accepted
  reward: number; // paid when finished
  baseValue: number;
}
export interface ContractBoard {
  offers: Contract[];
  active: Contract | null;
  coolUntil: number; // clock seconds: no offers before this
}

/** Running counts for goals. */
export interface Tally {
  dispatched: number;
  unloaded: number;
  sold: number; // crates sold at the market or restaurant
  pier: number; // fish caught from the pier
  orders: number; // notice-board orders filled
  storm: number; // trips to Open Sea or Deep Sea that came home safely in a storm
  contracts: number;
  zoneSent: Record<ZoneId, number>;
}

/** Fish book entry: biggest in cm and best stars are 0 until one is caught. */
export interface BookEntry { caught: number; bestSale: number; biggest: number; bestStars: number; golden: number }

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
  boats: Boat[];
  crates: Crate[];
  demand: Record<Species, number>;
  demandTimer: number;
  orders: Order[];
  orderCooldowns: number[];
  fishing: FishingState;
  book: Record<Species, BookEntry>;
  bookClaims: Record<ZoneId, { caught: boolean; stars: boolean }>; // zone rewards already paid
  stats: DayStats;
  lastPhase: Phase;
  // ---- tycoon stage
  buildings: Record<BuildingId, number>; // level 0 = not built
  smokeList: Species[]; // fish workers put in the smokehouse
  restaurant: { served: number; kinds: Species[] }; // today's service
  weather: WeatherId; // today
  special: Special; // today
  nextWeather: WeatherId; // tomorrow (forecast)
  nextSpecial: Special;
  contracts: ContractBoard;
  goal: number; // index of the current goal; GOALS.length when all are done
  tally: Tally;
  king: { found: boolean; delivered: boolean; day: number };
  incomeLog: number[]; // lifetime earnings sampled every few seconds (for money per minute)
  incomeTimer: number;
  harbourName: string;
  town: Record<ProjectId, boolean>; // town projects paid for
  guide: GuideState; // the starting guide: step, cards shown, the gentle first minutes
  savedAt: number; // wall-clock milliseconds when last saved, given by the caller (0 = unknown)
}

export interface Forecast {
  weather: WeatherId;
  special: Special;
  tomorrowWeather: WeatherId;
  tomorrowSpecial: Special;
}

export type Ev =
  | { type: 'boatDispatched'; boatId: number; zone: ZoneId; cost: number; auto?: boolean }
  | { type: 'boatReturned'; boatId: number; count: number; auto?: boolean }
  | { type: 'boatUnloaded'; boatId: number; count: number; auto?: boolean }
  | { type: 'cratePicked'; crateId: number }
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
  | { type: 'wagesPaid'; paid: number; unpaid: number; upkeep: number }
  | { type: 'captainLevelUp'; boatId: number; name: string; level: number }
  | { type: 'projectDone'; id: ProjectId }
  | { type: 'phaseChanged'; phase: Phase }
  | { type: 'workersSleep' }
  | { type: 'workersWake' }
  | { type: 'dayEnded'; day: number; stats: DayStats; forecast?: Forecast }
  | { type: 'guideStep'; index: number; done: boolean }
  | { type: 'guideUnlock'; id: UnlockId }
  | { type: 'goalDone'; index: number; id: string; reward: number }
  | { type: 'buildingBuilt'; id: BuildingId; level: number }
  | { type: 'crateSmoking'; crateId: number }
  | { type: 'crateSmoked'; crateId: number }
  | { type: 'restaurantServed'; species: Species; price: number; staff: boolean }
  | { type: 'weatherChanged'; weather: WeatherId; special: Special; tomorrowWeather: WeatherId; tomorrowSpecial: Special }
  | { type: 'boatDamaged'; boatId: number }
  | { type: 'boatRepairStarted'; boatId: number; cost: number }
  | { type: 'boatRepaired'; boatId: number }
  | { type: 'contractOffered' }
  | { type: 'contractAccepted'; contractId: number }
  | { type: 'contractDone'; contractId: number; reward: number }
  | { type: 'contractFailed'; contractId: number }
  | { type: 'kingFishFound'; boatId: number }
  | { type: 'endingReached'; days: number; earned: number; fishCaught: number; boats: number }
  | { type: 'awayEarnings'; seconds: number; earned: number; perMinute: number }
  | { type: 'goldenCaught'; species: Species }
  | { type: 'bookReward'; zone: ZoneId; kind: 'caught' | 'stars'; amount: number }
  | { type: 'harbourRenamed'; name: string }
  | { type: 'boatRenamed'; boatId: number; name: string }
  | { type: 'denied'; reason: string; needRank?: number };

/** Result of a "can the player do this" check. needRank is set when only a higher rank is missing. */
export interface Check {
  ok: boolean;
  reason?: string;
  needRank?: number;
  cost?: number;
  needHull?: number; // set when only a bigger boat is missing (Boat size level)
}

export const STATE_VERSION = 9;

function perSpecies<T>(f: () => T): Record<Species, T> {
  const o = {} as Record<Species, T>;
  for (const s of SPECIES) o[s] = f();
  return o;
}

export function emptyStats(): DayStats {
  return { earned: 0, sold: 0, spoiled: 0, filled: 0, missed: 0, income: perSpecies(() => 0), bonus: 0, wages: 0, upkeep: 0, tripCosts: 0, rewards: 0, away: 0, spent: 0, best: { species: null, price: 0 } };
}

export function emptyTally(): Tally {
  const zoneSent = {} as Record<ZoneId, number>;
  for (const z of ZONE_IDS) zoneSent[z] = 0;
  return { dispatched: 0, unloaded: 0, sold: 0, pier: 0, orders: 0, storm: 0, contracts: 0, zoneSent };
}

export function newBoat(id: number, berth: number, name: string): Boat {
  return { id, name, berth, hull: 0, hold: 0, gear: 0, sails: 0, target: 'shallows', captain: null, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [], stayInStorms: true };
}

export function initialState(): GameState {
  return {
    version: STATE_VERSION,
    money: START_MONEY,
    day: 1,
    dayTime: 0,
    clock: 0,
    nextId: 3,
    upgrades: { handcart: false, bigcart: false, wagon: false, stall1: false, stall2: false },
    lifetime: 0,
    rank: 0,
    dockhands: [],
    candidates: [],
    boats: [newBoat(1, 0, 'Gull')],
    crates: [],
    demand: perSpecies(() => 1),
    demandTimer: 0,
    orders: [],
    orderCooldowns: [],
    fishing: { phase: 'idle', timer: 0 },
    book: perSpecies(() => ({ caught: 0, bestSale: 0, biggest: 0, bestStars: 0, golden: 0 })),
    bookClaims: Object.fromEntries(ZONE_IDS.map((z) => [z, { caught: false, stars: false }])) as GameState['bookClaims'],
    stats: emptyStats(),
    lastPhase: 'dawn',
    buildings: { smokehouse: 0, restaurant: 0, lighthouse: 0 },
    smokeList: [...DEFAULT_SMOKE_LIST],
    restaurant: { served: 0, kinds: [] },
    weather: 'calm',
    special: null,
    nextWeather: 'calm',
    nextSpecial: null,
    contracts: { offers: [], active: null, coolUntil: 0 },
    goal: 0,
    tally: emptyTally(),
    king: { found: false, delivered: false, day: 0 },
    incomeLog: [],
    incomeTimer: 0,
    harbourName: DEFAULT_HARBOUR_NAME,
    town: Object.fromEntries(PROJECT_IDS.map((id) => [id, false])) as Record<ProjectId, boolean>,
    guide: newGuide(),
    savedAt: 0,
  };
}

export function nextId(state: GameState): number {
  return state.nextId++;
}
