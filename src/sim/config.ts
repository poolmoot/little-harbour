// All tunable numbers and tables for the harbour game live here.

export const SPECIES = [
  'herring', 'mackerel', 'flounder', 'seabass', 'snapper', 'lobster',
  'cod', 'tuna', 'swordfish', 'anglerfish', 'squid', 'sturgeon',
] as const;
export type Species = (typeof SPECIES)[number];
export type ZoneId = 'shallows' | 'reef' | 'opensea' | 'deep';
export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
export type UpgradeId = 'icebox' | 'handcart' | 'stall1' | 'stall2';

export const FISH_PRICE: Record<Species, number> = {
  herring: 6, mackerel: 10, flounder: 18, seabass: 28, snapper: 40, lobster: 90,
  cod: 60, tuna: 110, swordfish: 220, anglerfish: 160, squid: 260, sturgeon: 800,
};

/** trip = seconds at sea. tripCost = food and supplies, paid when the boat leaves. needsHull = minimum hull tier (0 Rowboat .. 3 Trawler). */
export const ZONES: Record<ZoneId, { trip: number; tripCost: number; needsHull: number; table: Partial<Record<Species, number>> }> = {
  shallows: { trip: 25, tripCost: 3, needsHull: 0, table: { herring: 50, mackerel: 30, flounder: 20 } },
  reef: { trip: 50, tripCost: 10, needsHull: 1, table: { seabass: 50, snapper: 35, lobster: 15 } },
  opensea: { trip: 80, tripCost: 30, needsHull: 2, table: { cod: 50, tuna: 35, swordfish: 15 } },
  deep: { trip: 120, tripCost: 80, needsHull: 3, table: { anglerfish: 50, squid: 35, sturgeon: 15 } },
};
export const ZONE_IDS: ZoneId[] = ['shallows', 'reef', 'opensea', 'deep'];

export const PIER_TABLE: Partial<Record<Species, number>> = { herring: 70, mackerel: 30 };
export const FLOUNDER_TWILIGHT_MULT = 3;

/** Money in a new game, enough for the first trips. */
export const START_MONEY = 10;

// Time. One day = 6 real minutes, clock runs 06:00 -> 06:00.
export const DAY_SECONDS = 360;
export const HOUR_SECONDS = DAY_SECONDS / 24;
export const START_HOUR = 6;
export const PHASE_HOURS = { dawnStart: 6, dayStart: 8, duskStart: 18, nightStart: 20 };

// Crates
export const DOCK_DECAY_SECONDS = 150;
export const ICE_DECAY_SECONDS = 600;
export const MIN_PRICE_MULT = 0.3;
export const CARRY_BASE = 2;
export const CARRY_HANDCART = 4;
export const ICE_CAPACITY = 6;

// Market
/** Demand drop per crate sold, by market stall level. */
export const DEMAND_DROPS = [0.06, 0.04, 0.025];
export const DEMAND_MIN = 0.5;
export const DEMAND_RECOVER = 0.02;
export const DEMAND_RECOVER_EVERY = 10;

// Orders
export const ORDER_SLOTS = 2;
export const ORDER_REFILL_DELAY = 20;
export const ORDER_QTY_MIN = 2;
export const ORDER_QTY_MAX = 5;
export const ORDER_HOURS_MIN = 8;
export const ORDER_HOURS_MAX = 14;
export const ORDER_CRATE_MULT = 2;
export const ORDER_BONUS = 0.5;
export const ORDER_NAMES = ['Marta', 'Old Pim', 'Dagny', 'Bjorn', 'Sally', 'Tobias', 'Wren', 'Hilde', 'Captain Roo', 'Nell'];

// Pier fishing
export const FISH_WAIT_MIN = 2;
export const FISH_WAIT_MAX = 6;
export const FISH_HOOK_WINDOW = 0.7;

/** Harbour-wide purchases. Names and descriptions are in ui/text.ts. */
export const UPGRADES: Record<UpgradeId, { cost: number; requires?: UpgradeId; rank: number }> = {
  icebox: { cost: 120, rank: 0 },
  handcart: { cost: 200, rank: 0 },
  stall1: { cost: 2000, rank: 2 },
  stall2: { cost: 9000, requires: 'stall1', rank: 3 },
};
export const UPGRADE_IDS: UpgradeId[] = ['icebox', 'handcart', 'stall1', 'stall2'];

// ---- Fleet (per-boat tracks) -------------------------------------------
export type Track = 'hull' | 'hold' | 'gear' | 'sails';
export const TRACKS: Track[] = ['hull', 'hold', 'gear', 'sails'];
export const TRACK_MAX: Record<Track, number> = { hull: 3, hold: 3, gear: 2, sails: 2 };
export const HOLD_SIZES = [4, 6, 8, 12];
export const GEAR_MULT = [1, 1.5, 2.2];
export const SAILS_MULT = [1, 0.85, 0.7];
export const MAX_BOATS = 4;
export const BOAT_NAMES = ['Gull', 'Wren', 'Marigold', 'Albatross'];
/** Cost to reach level i of each track (index 0 unused). Hold, Gear and Sails are multiplied by TIER_COST_MULT[hull]. */
export const TRACK_COST: Record<Track, number[]> = {
  hull: [0, 400, 2500, 4500],
  hold: [0, 300, 450, 1200],
  gear: [0, 350, 950],
  sails: [0, 350, 800],
};
export const TIER_COST_MULT = [1, 1.6, 2.6, 4];
/** Price of the nth boat (index = boats already owned). Bought as a rowboat. */
export const BOAT_COST = [0, 700, 2200, 6000];

// ---- Rank ---------------------------------------------------------------
export const RANK_THRESHOLDS = [0, 500, 3000, 15000, 60000];
export const TOP_RANK = RANK_THRESHOLDS.length - 1;

// ---- Staff --------------------------------------------------------------
export type Trait = 'swift' | 'lucky' | 'careful' | 'thrifty';
export const TRAITS: Trait[] = ['swift', 'lucky', 'careful', 'thrifty'];
export const CAPTAIN_WAGE = 40;
export const DOCKHAND_WAGE = 25;
export const MAX_DOCKHANDS = 4;
export const CANDIDATE_COUNT = 3;
export const DOCKHAND_SPEED = 2.8;
export const SWIFT_MULT = 0.85;
export const LUCKY_MULT = 1.25;
export const THRIFTY_MULT = 0.7;
export const CAPTAIN_NAMES = ['Ansel', 'Brigid', 'Corwin', 'Delphine', 'Eero', 'Freya', 'Gideon', 'Hanne', 'Ivo', 'Juno', 'Knut', 'Livia', 'Milo', 'Nessa'];
export const DOCKHAND_NAMES = ['Pip', 'Odd', 'Tove', 'Rurik', 'Sunniva', 'Ebb', 'Marit', 'Lars'];

// Layout shared by sim (dock slots) and view (world). x east, z south; the sea is at -z, the camera at +z.
export const LAYOUT = {
  quayZ: 0,
  pierHalfWidth: 2,
  pierEndZ: -18,
  berths: [
    { boatX: -3.4, boatZ: -8, edgeX: -1.9, edgeZ: -8.2, slotX: [-1.6, -1.0, -0.4], slotZ0: -3.0 },
    { boatX: 3.4, boatZ: -8, edgeX: 1.9, edgeZ: -8.2, slotX: [1.6, 1.0, 0.4], slotZ0: -3.0 },
    { boatX: -3.4, boatZ: -15.4, edgeX: -1.9, edgeZ: -15.6, slotX: [-1.6, -1.0, -0.4], slotZ0: -9.5 },
    { boatX: 3.4, boatZ: -15.4, edgeX: 1.9, edgeZ: -15.6, slotX: [1.6, 1.0, 0.4], slotZ0: -9.5 },
  ],
  slotRows: 4,
  slotDZ: -0.75,
  fishingSpot: { x: 0, z: -17.2 },
  market: { x: -8, z: 4 },
  shipyard: { x: -18, z: 3 },
  inn: { x: 10.5, z: 3 },
  dockhandHome: { x: 1.2, z: 1.6 },
  marketDrop: { x: -8, z: 5.7 },
  iceDrop: { x: -3.6, z: 3.6 },
  noticeBoard: { x: 5.2, z: 5.2 },
  iceBox: { x: -3.6, z: 2.4 },
  /** Four building plots on the quay. The door is where workers stop (in front, towards the camera). */
  plots: {
    coldstore: { x: -15, z: 10.5, doorX: -15, doorZ: 12.9 },
    smokehouse: { x: 15.5, z: 9.5, doorX: 15.5, doorZ: 11.9 },
    restaurant: { x: 18.5, z: 3.5, doorX: 18.5, doorZ: 5.9 },
    lighthouse: { x: 19.5, z: 11.5, doorX: 19.5, doorZ: 13.2 },
  },
  /** Workers walk east-west along this line when going between buildings. */
  corridorZ: 7.4,
  playerStart: { x: 0, z: 6 },
  quayMinX: -22,
  quayMaxX: 22,
  quayMaxZ: 14,
};
export const INTERACT_RANGE = 2.8;
export const CRATE_RANGE = 1.3;
export const BOAT_RANGE = 2.4;

// ---- Tycoon stage: buildings -----------------------------------------------
export type BuildingId = 'coldstore' | 'smokehouse' | 'restaurant' | 'lighthouse';
export const BUILDING_IDS: BuildingId[] = ['coldstore', 'smokehouse', 'restaurant', 'lighthouse'];
/** rank = rank needed. cost[i] = price to reach level i (index 0 unused). */
export const BUILDINGS: Record<BuildingId, { rank: number; cost: number[] }> = {
  coldstore: { rank: 1, cost: [0, 600, 2000, 6000] },
  smokehouse: { rank: 1, cost: [0, 900, 3000, 8000] },
  restaurant: { rank: 2, cost: [0, 2500, 7000, 16000] },
  lighthouse: { rank: 3, cost: [0, 12000] },
};
export const COLD_CAPACITY = [0, 12, 24, 40];
export const COLD_DECAY_SECONDS = 1200;
export const SMOKE_RACKS = [0, 2, 4, 6];
export const SMOKE_SECONDS = [0, 45, 35, 25];
export const SMOKED_MULT = 1.6;
export const DEFAULT_SMOKE_LIST: Species[] = ['herring', 'mackerel'];
export const RESTAURANT_CAPACITY = [0, 6, 12, 20];
export const RESTAURANT_MULT = 2;
export const RESTAURANT_MIN_FRESH = 80;
export const RESTAURANT_VARIETY_BONUS = 0.1;

// ---- Weather and special days ----------------------------------------------
export type WeatherId = 'calm' | 'wind' | 'fog' | 'storm';
export const WEATHER_IDS: WeatherId[] = ['calm', 'wind', 'fog', 'storm'];
export const WEATHER_CHANCE: Record<WeatherId, number> = { calm: 45, wind: 20, fog: 20, storm: 15 };
export const WEATHER_TRIP_MULT: Record<WeatherId, number> = { calm: 1, wind: 0.8, fog: 1.25, storm: 1 };
export const STORM_FIRST_DAY = 4;
export const STORM_ZONES: ZoneId[] = ['opensea', 'deep'];
export const STORM_CATCH_MULT = 1.5;
export const STORM_DAMAGE_CHANCE = 0.25;
export const REPAIR_SECONDS = 60;
export const REPAIR_COST_FRACTION = 0.05;
export const MARKET_DAY_CHANCE = 1 / 6;
export const BIG_CATCH_CHANCE = 1 / 5;
export const MARKET_DAY_MULT = 1.5;
export const BIG_CATCH_EXTRA = 2;

// ---- Contracts -------------------------------------------------------------
export const CONTRACT_RANK = 1;
export const CONTRACT_OFFERS = 2;
export const CONTRACT_DAYS = [2, 3];
export const CONTRACT_REWARD_MULT = 2.5;
export const CONTRACT_COOLDOWN_DAYS = 1;
/** Share of what the fleet could catch of that fish in the time that a contract asks for. */
export const CONTRACT_SHARE = 0.35;
export const CONTRACT_MIN_QTY = 4;
export const CONTRACT_MAX_QTY = 60;
/** Seconds a boat needs between trips (unloading, setting off), and the hours of sailing in a day. */
export const CONTRACT_TURNAROUND = 12;
export const CONTRACT_SAIL_HOURS = 14;

// ---- King Fish and the money-per-minute figure ----------------------------------
export const KING_CHANCE = 0.04;
export const RATE_SAMPLE_SECONDS = 5;
export const RATE_WINDOW_SECONDS = 120;

// ---- Goals -------------------------------------------------------------------
export type GoalKind =
  | 'dispatched' | 'unloaded' | 'sold' | 'pier' | 'holdLevel' | 'orders' | 'rank' | 'dockhands' | 'boats'
  | 'captains' | 'zoneSent' | 'building' | 'buildingLevel' | 'zoneFish' | 'contracts' | 'storm' | 'king';
export type GoalArrow = 'boat' | 'market' | 'pierEnd' | 'shipyard' | 'board' | 'inn';
/** n = how many / which level / which rank. zone and building pick the thing it is about. Words are in ui/text.ts under the same id. */
export interface GoalDef { id: string; kind: GoalKind; reward: number; n?: number; zone?: ZoneId; building?: BuildingId; arrow?: GoalArrow }
export const GOALS: GoalDef[] = [
  { id: 'send', kind: 'dispatched', n: 1, reward: 10, arrow: 'boat' },
  { id: 'unload', kind: 'unloaded', n: 1, reward: 10, arrow: 'boat' },
  { id: 'sell', kind: 'sold', n: 1, reward: 15, arrow: 'market' },
  { id: 'pier', kind: 'pier', n: 1, reward: 15, arrow: 'pierEnd' },
  { id: 'space', kind: 'holdLevel', n: 1, reward: 20, arrow: 'shipyard' },
  { id: 'order', kind: 'orders', n: 1, reward: 30, arrow: 'board' },
  { id: 'rank1', kind: 'rank', n: 1, reward: 40 },
  { id: 'worker', kind: 'dockhands', n: 1, reward: 40, arrow: 'inn' },
  { id: 'boat2', kind: 'boats', n: 2, reward: 50, arrow: 'shipyard' },
  { id: 'reef', kind: 'zoneSent', zone: 'reef', n: 1, reward: 40 },
  { id: 'cold', kind: 'building', building: 'coldstore', reward: 40 },
  { id: 'smoke', kind: 'building', building: 'smokehouse', reward: 50 },
  { id: 'rank2', kind: 'rank', n: 2, reward: 100 },
  { id: 'captain', kind: 'captains', n: 1, reward: 60, arrow: 'inn' },
  { id: 'reeffish', kind: 'zoneFish', zone: 'reef', reward: 100 },
  { id: 'contract', kind: 'contracts', n: 1, reward: 150, arrow: 'board' },
  { id: 'restaurant', kind: 'building', building: 'restaurant', reward: 125 },
  { id: 'sell100', kind: 'sold', n: 100, reward: 100 },
  { id: 'rank3', kind: 'rank', n: 3, reward: 300 },
  { id: 'storm', kind: 'storm', n: 1, reward: 150 },
  { id: 'level2', kind: 'buildingLevel', n: 2, reward: 150 },
  { id: 'seafish', kind: 'zoneFish', zone: 'opensea', reward: 250 },
  { id: 'rank4', kind: 'rank', n: 4, reward: 500 },
  { id: 'lighthouse', kind: 'building', building: 'lighthouse', reward: 600 },
  { id: 'king', kind: 'king', reward: 1000, arrow: 'inn' },
];
