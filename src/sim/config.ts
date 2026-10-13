// All tunable numbers and tables for the harbour game live here.

export const SPECIES = [
  'herring', 'mackerel', 'flounder', 'seabass', 'snapper', 'lobster',
  'cod', 'tuna', 'swordfish', 'anglerfish', 'squid', 'sturgeon',
] as const;
export type Species = (typeof SPECIES)[number];
export type ZoneId = 'shallows' | 'reef' | 'opensea' | 'deep';
export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
export type UpgradeId = 'icebox' | 'handcart' | 'stall1' | 'stall2';

export const FISH: Record<Species, { name: string; price: number }> = {
  herring: { name: 'Herring', price: 6 },
  mackerel: { name: 'Mackerel', price: 10 },
  flounder: { name: 'Flounder', price: 18 },
  seabass: { name: 'Sea bass', price: 28 },
  snapper: { name: 'Red snapper', price: 40 },
  lobster: { name: 'Lobster', price: 90 },
  cod: { name: 'Cod', price: 60 },
  tuna: { name: 'Tuna', price: 110 },
  swordfish: { name: 'Swordfish', price: 220 },
  anglerfish: { name: 'Anglerfish', price: 300 },
  squid: { name: 'Giant squid', price: 480 },
  sturgeon: { name: 'Golden sturgeon', price: 1200 },
};

/** needsHull is the minimum hull tier (0 Rowboat .. 3 Trawler). */
export const ZONES: Record<ZoneId, { name: string; trip: number; needsHull: number; table: Partial<Record<Species, number>> }> = {
  shallows: { name: 'Shallows', trip: 25, needsHull: 0, table: { herring: 50, mackerel: 30, flounder: 20 } },
  reef: { name: 'Reef', trip: 50, needsHull: 1, table: { seabass: 50, snapper: 35, lobster: 15 } },
  opensea: { name: 'Open Sea', trip: 80, needsHull: 2, table: { cod: 50, tuna: 35, swordfish: 15 } },
  deep: { name: 'Deep', trip: 120, needsHull: 3, table: { anglerfish: 50, squid: 35, sturgeon: 15 } },
};
export const ZONE_IDS: ZoneId[] = ['shallows', 'reef', 'opensea', 'deep'];

export const PIER_TABLE: Partial<Record<Species, number>> = { herring: 70, mackerel: 30 };
export const FLOUNDER_TWILIGHT_MULT = 3;

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
export const HOLD_START = 4;

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

export const UPGRADES: Record<UpgradeId, { name: string; cost: number; desc: string; requires?: UpgradeId; rank: number }> = {
  icebox: { name: 'Ice box', cost: 120, desc: 'Keeps up to 6 crates fresh four times longer.', rank: 0 },
  handcart: { name: 'Handcart', cost: 200, desc: 'You and your dockhands carry 4 crates instead of 2.', rank: 0 },
  stall1: { name: 'Market stall I', cost: 2000, desc: 'A wider stall: each crate sold drops demand 0.04 instead of 0.06.', rank: 2 },
  stall2: { name: 'Market stall II', cost: 9000, desc: 'A grand stall: demand drops only 0.025 per crate.', requires: 'stall1', rank: 3 },
};
export const UPGRADE_IDS: UpgradeId[] = ['icebox', 'handcart', 'stall1', 'stall2'];

// ---- Fleet (per-boat tracks) -------------------------------------------
export type Track = 'hull' | 'hold' | 'gear' | 'sails';
export const TRACKS: Track[] = ['hull', 'hold', 'gear', 'sails'];
export const TRACK_MAX: Record<Track, number> = { hull: 3, hold: 3, gear: 2, sails: 2 };
export const TRACK_NAMES: Record<Track, string> = { hull: 'Hull', hold: 'Hold', gear: 'Gear', sails: 'Sails' };
export const HULL_NAMES = ['Rowboat', 'Sloop', 'Cutter', 'Trawler'];
export const HOLD_SIZES = [4, 6, 8, 12];
export const GEAR_MULT = [1, 1.5, 2.2];
export const SAILS_MULT = [1, 0.85, 0.7];
export const MAX_BOATS = 4;
export const BOAT_NAMES = ['Gull', 'Wren', 'Marigold', 'Albatross'];
/** Cost to reach level i of each track (index 0 unused). Hold, Gear and Sails are multiplied by TIER_COST_MULT[hull]. */
export const TRACK_COST: Record<Track, number[]> = {
  hull: [0, 400, 2500, 10000],
  hold: [0, 300, 450, 1200],
  gear: [0, 350, 950],
  sails: [0, 350, 800],
};
export const TIER_COST_MULT = [1, 1.6, 2.6, 4];
/** Price of the nth boat (index = boats already owned). Bought as a rowboat. */
export const BOAT_COST = [0, 700, 2200, 6000];

// ---- Rank ---------------------------------------------------------------
export const RANK_NAMES = ['Dockside Fisher', 'Boat Owner', 'Skipper & Co', 'Fleet Master', 'Harbour Master'];
export const RANK_THRESHOLDS = [0, 500, 3000, 15000, 60000];
export const RANK_UNLOCKS = [
  'The basics',
  'Dockhands, a second boat, the Sloop hull',
  'Captains, a third berth, the Cutter hull, market stall I',
  'A fourth berth, the Trawler hull, market stall II',
  'The title, and a golden weathervane on the inn',
];

// ---- Staff --------------------------------------------------------------
export type Trait = 'swift' | 'lucky' | 'careful' | 'thrifty';
export const TRAITS: Trait[] = ['swift', 'lucky', 'careful', 'thrifty'];
export const TRAIT_INFO: Record<Trait, { name: string; desc: string }> = {
  swift: { name: 'Swift', desc: 'Trips take 15% less time' },
  lucky: { name: 'Lucky', desc: 'Rare fish are 25% more likely' },
  careful: { name: 'Careful', desc: 'Hold carries 1 extra crate' },
  thrifty: { name: 'Thrifty', desc: 'Wage is 30% lower' },
};
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
  playerStart: { x: 0, z: 6 },
  quayMinX: -22,
  quayMaxX: 22,
  quayMaxZ: 14,
};
export const INTERACT_RANGE = 2.8;
export const CRATE_RANGE = 1.3;
export const BOAT_RANGE = 2.4;
