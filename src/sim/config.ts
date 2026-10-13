// All tunable numbers and tables for the harbour game live here.

export const SPECIES = ['herring', 'mackerel', 'flounder', 'seabass', 'snapper', 'lobster'] as const;
export type Species = (typeof SPECIES)[number];
export type ZoneId = 'shallows' | 'reef';
export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
export type UpgradeId = 'icebox' | 'handcart' | 'hold1' | 'hold2' | 'hull' | 'boat2';

export const FISH: Record<Species, { name: string; price: number }> = {
  herring: { name: 'Herring', price: 6 },
  mackerel: { name: 'Mackerel', price: 10 },
  flounder: { name: 'Flounder', price: 18 },
  seabass: { name: 'Sea bass', price: 28 },
  snapper: { name: 'Red snapper', price: 40 },
  lobster: { name: 'Lobster', price: 90 },
};

export const ZONES: Record<ZoneId, { name: string; trip: number; needsHull: boolean; table: Partial<Record<Species, number>> }> = {
  shallows: { name: 'Shallows', trip: 25, needsHull: false, table: { herring: 50, mackerel: 30, flounder: 20 } },
  reef: { name: 'Reef', trip: 50, needsHull: true, table: { seabass: 50, snapper: 35, lobster: 15 } },
};
export const ZONE_IDS: ZoneId[] = ['shallows', 'reef'];

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
export const DEMAND_DROP = 0.06;
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

export const UPGRADES: Record<UpgradeId, { name: string; cost: number; desc: string; requires?: UpgradeId }> = {
  icebox: { name: 'Ice box', cost: 120, desc: 'Keeps up to 6 crates fresh four times longer.' },
  handcart: { name: 'Handcart', cost: 200, desc: 'Carry 4 crates instead of 2.' },
  hold1: { name: 'Hold I', cost: 150, desc: 'Boats carry 6 crates.' },
  hold2: { name: 'Hold II', cost: 400, desc: 'Boats carry 8 crates.', requires: 'hold1' },
  hull: { name: 'Reinforced hull', cost: 500, desc: 'Unlocks the Reef. Boats get a mast.' },
  boat2: { name: 'Second boat', cost: 800, desc: 'A second rowboat at berth 2.' },
};
export const UPGRADE_IDS: UpgradeId[] = ['icebox', 'handcart', 'hold1', 'hold2', 'hull', 'boat2'];

// Layout shared by sim (dock slots) and view (world). x east, z south; the sea is at -z, the camera at +z.
export const LAYOUT = {
  quayZ: 0,
  pierHalfWidth: 2,
  pierEndZ: -18,
  berths: [
    { boatX: -3.4, boatZ: -8, edgeX: -1.9, edgeZ: -8.2, slotX: [-1.6, -1.0, -0.4] },
    { boatX: 3.4, boatZ: -8, edgeX: 1.9, edgeZ: -8.2, slotX: [1.6, 1.0, 0.4] },
  ],
  slotRows: 4,
  slotZ0: -3.0,
  slotDZ: -0.75,
  fishingSpot: { x: 0, z: -17.2 },
  market: { x: -8, z: 4 },
  shipyard: { x: -15, z: 3 },
  inn: { x: 10.5, z: 3 },
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
