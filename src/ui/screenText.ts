// Wording for the tycoon-stage screens (goal tracker, weather chip, building windows, contracts tab,
// workers' rules, repairs, day report, ending). Same rule as text.ts: short, common words, no jargon.
// Names that already exist in text.ts (building names, weather names, goal lines, contract lines) are used from there.
import { ORDER_BONUS, ORDER_CRATE_MULT, RESTAURANT_MIN_FRESH, SMOKED_MULT } from '../sim/config';
import type { BuildingId, WeatherId } from '../sim/config';
import type { Special } from '../sim/state';
import type { IconName } from './icons';
import { WEATHER, specialName } from './text';

const pct = (x: number): number => Math.round(x * 100);

// ---- HUD ----------------------------------------------------------------------------------------

export const HUD_TEXT = {
  goal: 'Goal',
  goalNumber: (n: number, total: number): string => `Goal ${n} of ${total}`,
  reward: 'Reward',
  goalDone: (reward: number): string => `Goal done! +$${reward}`,
  weatherToday: 'Today',
  tomorrow: (weather: WeatherId, special: Special): string => `Tomorrow: ${WEATHER[weather].name}${special ? ` · ${specialName(special)}` : ''}`,
  /** The tooltip on the weather chip. */
  weatherTip: (weather: WeatherId, special: Special, tomorrow: WeatherId, tomorrowSpecial: Special): string =>
    `Today: ${WEATHER[weather].name}. ${WEATHER[weather].desc}${special ? ` ${specialName(special)}.` : ''} Tomorrow: ${WEATHER[tomorrow].name}${tomorrowSpecial ? `, ${specialName(tomorrowSpecial)}` : ''}.`,
  rateTip: 'Money you earn each minute, over the last two minutes.',
  carrySmoked: 'Smoked',
  carryKing: 'King',
};

// ---- building windows --------------------------------------------------------------------------------

export const PLOT_TEXT = {
  forSale: 'For sale',
  whatItDoes: 'What it does',
  price: 'Price',
  rankNeeded: 'Rank needed',
  laterTitle: 'Later you can make it bigger',
  later: (level: number, cost: number, text: string): string => `Level ${level} · $${cost.toLocaleString('en')} · ${text}`,
  thisLevel: 'This level',
  build: 'Build',
  upgradeTitle: 'Make it bigger',
  upgradeNext: (level: number, text: string): string => `Level ${level}: ${text}`,
  fullyBuilt: 'It is as big as it gets.',
  inHands: 'In your hands',
  nothingInHands: 'You are not carrying any fish.',
  nothingForThis: 'You are not carrying any fish that fits here.',
};

export const COLD_TEXT = {
  inside: (n: number, cap: number): string => `In the cold store ${n} / ${cap}`,
  note: 'Fish keep fresh here for a very long time.',
  putIn: 'Put in',
  takeOut: 'Take out',
  empty: 'Nothing in the cold store.',
  full: 'It is full. Make it bigger to keep more.',
  hands: 'Your hands are full.',
  fullLabel: 'Full',
  howFull: (n: number, cap: number): string => `${n} of ${cap} crates`,
};

export const SMOKE_TEXT = {
  racks: 'Racks',
  note: `Smoked fish sells for ${SMOKED_MULT} times the price and never goes bad.`,
  free: 'Free rack',
  smoking: (secs: number): string => `Smoking… ${secs}s left`,
  ready: 'Ready!',
  smoke: 'Smoke it',
  noGolden: 'Too special',
  take: 'Take it',
  takeAll: 'Take all',
  allFull: 'All racks are full.',
  worth: (price: number): string => `Sells for $${price}`,
  carried: 'Smoke a crate you carry',
  badFish: 'Gone bad',
};

export const RESTAURANT_TEXT = {
  sell: 'Sell',
  todayTitle: 'Today',
  leftToday: (left: number): string => (left === 1 ? 'It will buy 1 more crate today.' : `It will buy ${left} more crates today.`),
  doneToday: 'It has bought all it wants today. Come back tomorrow.',
  tried: 'Fish it has had today',
  none: 'None yet. Each different fish makes it pay more.',
  bonus: (kinds: number): string => (kinds === 0 ? 'No bonus yet' : `Bonus: ${pct(kinds * 0.1)}% more`),
  pays: (price: number): string => `Pays $${price}`,
  /** Why a crate is refused. */
  refuse: {
    smoked: 'It only wants fresh fish, not smoked fish.',
    king: 'Not the King Fish!',
    stale: `It must be at least ${RESTAURANT_MIN_FRESH}% fresh.`,
    full: 'It has bought all it wants today.',
    gone: 'That fish has gone bad.',
    golden: 'A golden fish is too special for a meal. The market pays much more.',
  },
};

export const LIGHTHOUSE_TEXT = {
  lit: 'The light is on. Your boats can sail at night.',
  nightTitle: 'Night trips',
  night: 'At night the sea is quiet, and your boats can go out. Trips to the Deep Sea at night may find the King Fish.',
  kingTitle: 'The King Fish',
  kingHunting: 'Send a boat to the Deep Sea at night. It is rare, so keep trying. Better nets and a lucky captain help.',
  kingOnBoat: 'A boat has the King Fish! Unload it, then carry it to the inn.',
  kingCarrying: 'You have the King Fish! Carry it to the inn.',
  kingDone: 'The King Fish hangs on the wall of the inn.',
};

export const BUILDING_ICON: Record<BuildingId, IconName> = { coldstore: 'ice', smokehouse: 'smoke', restaurant: 'plate', lighthouse: 'lighthouse' };
export const WEATHER_ICON: Record<WeatherId, IconName> = { calm: 'sun', wind: 'wind', fog: 'fog', storm: 'storm' };

// ---- contracts tab ---------------------------------------------------------------------------------------

export const CONTRACT_TEXT = {
  reward: 'Reward',
  sellFresh: 'fresh',
  smoked: 'smoked',
  backTomorrow: 'No contracts right now. Come back tomorrow.',
  offerSub: (days: number): string => `You have ${days === 1 ? '1 day' : `${days} days`} once you take it.`,
  only1: 'You can have one contract at a time.',
};

// ---- workers ------------------------------------------------------------------------------------------------

export const WORKER_TEXT = {
  smokeTitle: 'Smoke these',
  smokeNote: 'Your workers put these fish in the smokehouse. You only see fish you have caught.',
  smokeNone: 'Catch some fish first. They will show up here.',
  spareTitle: 'Spare crates go to',
  spareNote: 'Workers take other crates to the market, or to storage to keep them fresh. Storage is the cold store first, then the ice box.',
  market: 'Market',
  storage: 'Storage',
  storageNone: 'Storage (build the cold store first)',
  rules: 'Workers go to the restaurant first, then the smokehouse, then to the market or to storage.',
  carryingTo: (dest: string): string => `Carrying to the ${dest}`,
  dest: { market: 'market', ice: 'ice box', cold: 'cold store', restaurant: 'restaurant', smoke: 'smokehouse' },
  carryingSmoked: 'Carrying smoked fish to the market',
};

// ---- boats and repairs -------------------------------------------------------------------------------------------

export const BOAT_TEXT = {
  broken: 'Broken',
  brokenChip: 'Broken. It cannot sail.',
  fixHint: 'Go to the shipyard to get it fixed.',
  fixing: (secs: number): string => `Being fixed · ${secs}s left`,
  stayNote: 'When it is on, this boat stays in the harbour on stormy days. It only matters for the Open Sea and the Deep Sea.',
  stayToday: 'There is a storm today, so this boat stays home.',
  cannotSail: 'Cannot sail',
};

export const SHIPYARD_TEXT = {
  brokenTitle: 'Broken boats',
  yourBoats: 'Your boats',
  fix: 'Fix it',
  fixCost: (cost: number): string => `Cost $${cost.toLocaleString('en')}`,
  fixTime: (secs: number): string => `Takes ${secs} seconds`,
  unloadFirst: 'Unload the boat first.',
  tabBroken: (n: number): string => (n === 1 ? ' (1 broken)' : ` (${n} broken)`),
};

// ---- notice board and day report -------------------------------------------------------------------------------------

export const REPORT_TEXT = {
  rewards: 'Goal rewards',
  tomorrow: 'Tomorrow',
  today: 'Today',
  weather: 'Weather',
  special: 'Special day',
  noSpecial: 'Nothing special',
  stormSoon: 'A storm is coming. Boats that stay home are safe.',
};

export const ORDER_TEXT = {
  /** What an order really pays: each crate for the order sells for double, and a finished order adds a bonus. */
  note: `Each crate for an order sells for ${ORDER_CRATE_MULT === 2 ? 'double' : `${ORDER_CRATE_MULT} times`} the price. Finish the whole order and you get ${pct(ORDER_BONUS)}% extra on top.`,
};

// ---- the ending -----------------------------------------------------------------------------------------------------------

export const ENDING_TEXT = {
  windowTitle: 'The King Fish!',
  bram: 'Bram, inn owner',
  days: 'Days played',
  earned: 'Money earned',
  fish: 'Fish caught',
  boats: 'Boats owned',
};

// ---- toasts and prompts for the new events ----------------------------------------------------------------------------

export const SAY2 = {
  stormComing: 'A storm is coming tomorrow. Boats can stay home.',
  marketDay: 'It is market day! Fish sells for more.',
  bigCatch: 'Big catch day! One sea gives extra crates.',
  kingFound: 'You found the King Fish! Unload the boat and carry it to the inn.',
  kingBanner: 'The King Fish!',
  kingBannerSub: 'Carry it to the inn.',
  smokedWaiting: (n: number): string => `${n} smoked crate${n === 1 ? ' is' : 's are'} ready.`,
  promptKing: 'Show the King Fish to everyone',
};

// ---- signs, name plates and status bubbles over the buildings (drawn in 3D by view/buildingMarks.ts) ------------------

export const MARK_TEXT = {
  /** The words on each signboard and name plate. */
  names: { market: 'Fish market', icebox: 'Ice box', board: 'Notice board', shipyard: 'Shipyard', inn: 'The inn', coldstore: 'Cold store', smokehouse: 'Smokehouse', restaurant: 'Restaurant', lighthouse: 'Lighthouse' },
  forSale: 'For sale',
  /** Small bubbles over a building: smoked fish is done, something can be bought now, a building has just opened up. */
  bubble: { ready: 'ready', up: 'up', new: 'new' },
};
