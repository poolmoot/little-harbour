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
  hold: [0, 110, 450, 1200],
  gear: [0, 350, 950],
  sails: [0, 350, 800],
};
export const TIER_COST_MULT = [1, 1.6, 2.6, 4];
/** Price of the nth boat (index = boats already owned). Bought as a rowboat. */
export const BOAT_COST = [0, 700, 2200, 6000];

// ---- Rank ---------------------------------------------------------------
export const RANK_THRESHOLDS = [0, 500, 3300, 18000, 72000];
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
/** Where a point given in a building's own frame (x right, z towards its door) lands in the world, for a building turned by `rot` radians (same turn as Three.js rotation.y). */
export function toWorld(o: { x: number; z: number; rot?: number }, lx: number, lz: number): { x: number; z: number } {
  const a = o.rot ?? 0, c = Math.cos(a), s = Math.sin(a);
  return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c };
}
/** The round harbour square: its centre, and the radius of the circle the building fronts (their doors) stand on. */
const RING = { cx: 0, cz: 24, front: 24, /** the camera-side edge of the square is a straight low wall this far south of its centre (the south of the circle is cut off) */ south: 12 };
/** Half sizes (across, deep) of each building's ground footprint; the building stands with its front wall on the ring. */
export const FOOT = {
  market: [4.0, 1.5], coldstore: [2.4, 2.0], smokehouse: [2.0, 1.9], restaurant: [2.6, 1.9], shipyard: [3.1, 2.1],
  inn: [3.5, 2.6], bellTower: [1.65, 1.65], noticeBoard: [1.0, 0.3], iceBox: [0.9, 0.7], lighthouse: [1.6, 1.6],
} as const;
/** Angle round the square (degrees from straight up, which is the sea; east is positive) of each building. Equal steps on each side, from the pier outwards. */
const RING_FIRST = 18, RING_STEP = 20;
export const RING_ANGLE = {
  market: -RING_FIRST, coldstore: -(RING_FIRST + RING_STEP), smokehouse: -(RING_FIRST + 2 * RING_STEP), shipyard: -(RING_FIRST + 3 * RING_STEP),
  noticeBoard: RING_FIRST, bellTower: RING_FIRST + RING_STEP, inn: RING_FIRST + 2 * RING_STEP, restaurant: RING_FIRST + 3 * RING_STEP,
} as const;
/** A spot on the circle for a building of depth `hz` (front wall on the ring), turned so its door faces the centre. rot is exactly minus the angle. */
export function ringPose(phiDeg: number, hz: number, front = RING.front): { x: number; z: number; rot: number } {
  const p = (phiDeg * Math.PI) / 180, r = front + hz;
  return { x: RING.cx + r * Math.sin(p), z: RING.cz - r * Math.cos(p), rot: -p };
}
/** Angle (degrees from straight up) of a point as seen from the square's centre, and its distance from it. */
export function ringOf(x: number, z: number): { deg: number; r: number } {
  return { deg: (Math.atan2(x - RING.cx, -(z - RING.cz)) * 180) / Math.PI, r: Math.hypot(x - RING.cx, z - RING.cz) };
}
const at = (n: keyof typeof RING_ANGLE) => ringPose(RING_ANGLE[n], FOOT[n][1]);
const plot = (n: 'coldstore' | 'smokehouse' | 'restaurant', doorLx: number) => {
  const o = at(n), d = toWorld(o, doorLx, FOOT[n][1] + 1.0);
  return { ...o, doorX: Math.round(d.x * 100) / 100, doorZ: Math.round(d.z * 100) / 100 };
};
const spot = (o: { x: number; z: number; rot: number }, lx: number, lz: number) => {
  const d = toWorld(o, lx, lz);
  return { x: Math.round(d.x * 100) / 100, z: Math.round(d.z * 100) / 100 };
};
const MARKET = at('market'), YARD = at('shipyard'), INN = at('inn'), BOARD = at('noticeBoard'), TOWER = at('bellTower');
const ICE = { ...ringPose(9, FOOT.iceBox[1], RING.front - 1.4), };
const ICE_STATION = spot(ICE, 0, FOOT.iceBox[1] + 1.0);
const POINT_TOP = { x0: 31.6, x1: 38.4, z0: 14.5, z1: 29 };
const LIGHT = { x: 35, z: 17.6, rot: 0 };
const LIGHT_D = spot(LIGHT, 0, FOOT.lighthouse[1] + 1.0);
/**
 * The town is a horseshoe round one round, open square. The sea is at -z (the pier leaves the top of the square at x = 0); the camera looks
 * from +z. Every usable building stands on one circle (its front wall on the ring of radius `ring.front` round the square's centre),
 * with equal angular steps on each side and its door facing the centre (rotation = minus its angle). West of the pier, from the pier outwards: market,
 * cold store, smokehouse, shipyard. East: notice board, clock tower, inn, restaurant. The ice box is a small item at the pier head. The
 * lighthouse stands on its own rocky point past a gate at the east end. A ring walkway runs just inside the doors; the square inside is open.
 * Decoration stays outside the horseshoe (see `layoutBoxes.ts` for every solid thing and the lanes that stay clear).
 */
export const LAYOUT = {
  quayZ: 0,
  pierHalfWidth: 2,
  pierEndZ: -18,
  berths: [
    // A moored boat lies along the pier with its side about a hand from the pier's edge (boatX is for the smallest boat; bigger boats sit further out by their extra beam, see boatsView.ts). The longest boat is 7 long, so the two berths on a side are 7.8 apart.
    { boatX: -3.1, boatZ: -9, edgeX: -1.9, edgeZ: -9, slotX: [-1.6, -1.0, -0.4], slotZ0: -3.0 },
    { boatX: 3.1, boatZ: -9, edgeX: 1.9, edgeZ: -9, slotX: [1.6, 1.0, 0.4], slotZ0: -3.0 },
    { boatX: -3.1, boatZ: -16.8, edgeX: -1.9, edgeZ: -16.8, slotX: [-1.6, -1.0, -0.4], slotZ0: -9.5 },
    { boatX: 3.1, boatZ: -16.8, edgeX: 1.9, edgeZ: -16.8, slotX: [1.6, 1.0, 0.4], slotZ0: -9.5 },
  ],
  slotRows: 4,
  slotDZ: -0.75,
  fishingSpot: { x: 0, z: -17.2 },
  /** The round square: centre, the radius of the building fronts, the angles in use, and the free ring walkway (radii) just inside the doors. */
  ring: { ...RING, first: RING_FIRST, step: RING_STEP, walkOuter: RING.front - 0.4, walkInner: RING.front - 9, freeInner: RING.front - 9, freeOuter: RING.front - 3.5, pathR: 18 },
  /** Width kept clear in front of every door, interaction point and the pier head. */
  approachWidth: 3.5,
  market: MARKET,
  shipyard: YARD,
  inn: INN,
  /** The clock and bell tower, the landmark. The harbour bell rings from here. */
  bellTower: TOWER,
  dockhandHome: { x: 1.2, z: 1.6 },
  marketDrop: spot(MARKET, -1.5, FOOT.market[1] + 1.0),
  iceDrop: ICE_STATION,
  noticeBoard: BOARD,
  iceBox: ICE,
  /** Where the player stands to use the market, shipyard, board, ice box and inn (in front of each door, on the approach). */
  stations: {
    market: spot(MARKET, -1.5, FOOT.market[1] + 1.0),
    shipyard: spot(YARD, -1.1, FOOT.shipyard[1] + 1.0),
    board: spot(BOARD, 0, FOOT.noticeBoard[1] + 1.0),
    icebox: ICE_STATION,
    inn: spot(INN, -1.8, FOOT.inn[1] + 1.0),
  },
  /** Four building plots, turned like the rest. The door is where workers stop (in front, towards the centre). The lighthouse stands on its own rocky point past the east gate. */
  plots: {
    coldstore: plot('coldstore', 0),
    smokehouse: plot('smokehouse', 1.2),
    restaurant: plot('restaurant', -1.5),
    lighthouse: { ...LIGHT, doorX: LIGHT_D.x, doorZ: LIGHT_D.z },
  },
  /** The rocky point the lighthouse stands on and the causeway to it from the east gate (both walkable): x0, x1, z0, z1. */
  point: POINT_TOP,
  causeway: { x0: 22.6, x1: 33, z0: 25.8, z1: 29 },
  /** The gap in the low wall at the east end of the square, in degrees round the square. */
  gate: { from: 94, to: 102 },
  playerStart: { x: 0, z: 8 },
  /** The bounding box of the town, for things that need a size (land, hills, trees, the guide trail). */
  quayMinX: -29.5,
  quayMaxX: 29.5,
  quayMaxZ: 37.6,
  /** Open space kept for the town-life code, in the market's own frame (x across, z towards its door): the queue in front of the stall's east half. */
  queueZone: { x0: 0.3, x1: 3.5, z0: 1.9, z1: 3.1 },
  /** The restaurant terrace, in the restaurant's own frame (x across, z towards its door): room for up to three tables, east of the door's clear approach. Use toWorld(plots.restaurant, ...) to place things. */
  terrace: { x0: 1.2, x1: 4.0, z0: 2.7, z1: 4.0 },
  /** The crowd that gathers at the pier head (world x0, x1, z0, z1). The middle (|x| below `crowdGap`) stays clear so the way to the pier is open. */
  crowdZone: { x0: -5.0, x1: 5.0, z0: 0.6, z1: 3.2 },
  crowdGap: 2.2,
};
/** Half sizes (across, deep) of what each plot's building takes up on the ground. */
export const PLOT_HALF: Record<'coldstore' | 'smokehouse' | 'restaurant' | 'lighthouse', [number, number]> = {
  coldstore: [...FOOT.coldstore], smokehouse: [...FOOT.smokehouse], restaurant: [...FOOT.restaurant], lighthouse: [...FOOT.lighthouse],
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
  restaurant: { rank: 2, cost: [0, 3000, 9000, 22000] },
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
export const CONTRACT_REWARD_MULT = 1.5;
export const CONTRACT_COOLDOWN_DAYS = 1;
/** Share of what the fleet could catch of that fish in the time that a contract asks for. */
export const CONTRACT_SHARE = 0.35;
export const CONTRACT_MIN_QTY = 4;
export const CONTRACT_MAX_QTY = 60;
/** Seconds a boat needs between trips (unloading, setting off), and the hours of sailing in a day. */
export const CONTRACT_TURNAROUND = 12;
export const CONTRACT_SAIL_HOURS = 14;

// ---- King Fish and the money-per-minute figure ----------------------------------
export const KING_CHANCE = 0.02;
export const RATE_SAMPLE_SECONDS = 5;
export const RATE_WINDOW_SECONDS = 120;

// ---- Names ----------------------------------------------------------------------------------
export const DEFAULT_HARBOUR_NAME = 'Little Harbour';
export const NAME_MIN = 1;
export const NAME_MAX = 16;
/** Letters, digits, spaces and a few simple marks. */
export const NAME_PATTERN = /^[\p{L}\p{N} '.,!&-]+$/u;

// ---- Fish sizes, stars and golden fish ---------------------------------------------
/** Length range in cm for each fish. Sizes are rolled between these, with middle sizes most common. */
export const FISH_SIZE: Record<Species, [number, number]> = {
  herring: [15, 30], mackerel: [20, 45], flounder: [25, 50], seabass: [30, 80], snapper: [30, 90], lobster: [20, 50],
  cod: [40, 120], tuna: [80, 250], swordfish: [150, 450], anglerfish: [30, 100], squid: [30, 120], sturgeon: [100, 300],
};
/** Price change for the smallest and the biggest fish; a middle-sized fish pays the normal price. */
export const SIZE_PRICE_MIN = -0.1;
export const SIZE_PRICE_MAX = 0.2;
/** Share of the size range (from the bottom) where 2 and 3 stars begin. The top 10% is 3 stars. */
export const STAR2_FROM = 0.6;
export const STAR3_FROM = 0.9;
export const GOLDEN_CHANCE = 0.02; // per crate, before Nets and a Lucky captain
export const GOLDEN_CHANCE_MAX = 0.2;
export const GOLDEN_MULT = 5;
/** One-time cash rewards per zone: every fish of the zone caught, and 3 stars on every fish of the zone. */
export const BOOK_REWARD_CAUGHT: Record<ZoneId, number> = { shallows: 25, reef: 75, opensea: 200, deep: 500 };
export const BOOK_REWARD_STARS: Record<ZoneId, number> = { shallows: 100, reef: 300, opensea: 800, deep: 2000 };

// ---- Earnings while away ---------------------------------------------------------
export const AWAY_MIN_SECONDS = 60; // shorter absences are ignored
export const AWAY_MAX_SECONDS = 8 * 3600; // time away counts for at most 8 hours
export const AWAY_SHARE = 0.5; // the harbour earns half as much when you are not there
export const AWAY_SIM_SECONDS = DAY_SECONDS; // one in-game day is simulated to measure the rate

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
