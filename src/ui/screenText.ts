// Wording for the tycoon-stage screens (goal tracker, weather chip, building windows, contracts tab,
// workers' rules, repairs, day report, ending). Same rule as text.ts: short, common words, no jargon.
// Names that already exist in text.ts (building names, weather names, goal lines, contract lines) are used from there.
import { ORDER_CRATE_MULT, RESTAURANT_MIN_FRESH, SMOKED_MULT } from '../sim/config';
import type { ProjectId } from '../sim/config';
import type { BuildingId, WeatherId } from '../sim/config';
import type { Special } from '../sim/state';
import type { IconName } from './icons';
import { RANK_NAME as LOCK_RANK_NAME, WEATHER, specialName } from './text';

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
  laterTitle: 'Later upgrades',
  later: (level: number, cost: number, text: string): string => `Level ${level} · $${cost.toLocaleString('en')} · ${text}`,
  thisLevel: 'This level',
  build: 'Build',
  upgradeTitle: 'Upgrade',
  upgradeNext: (level: number, text: string): string => `Level ${level}: ${text}`,
  fullyBuilt: 'It is as big as it gets.',
  inHands: 'In your hands',
  nothingInHands: 'You are not carrying any fish.',
  nothingForThis: 'You are not carrying any fish that fits here.',
};

export const SMOKE_TEXT = {
  racks: 'Racks',
  note: `Smoked fish sells for ${SMOKED_MULT}× more and never goes bad.`,
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
  lit: 'The light is on. Trips at night are faster.',
  nightTitle: 'Night trips',
  night: 'With the light on, trips that start at night take 30% less time. Trips to the Deep Sea at night may find the King Fish.',
  kingTitle: 'The King Fish',
  kingHunting: 'Send a boat to the Deep Sea at night. It is rare, so keep trying. Better nets and a lucky captain help.',
  kingOnBoat: 'A boat has the King Fish! Unload it, then carry it to the inn.',
  kingCarrying: 'You have the King Fish! Carry it to the inn.',
  kingDone: 'The King Fish hangs on the wall of the inn.',
};

export const BUILDING_ICON: Record<BuildingId, IconName> = { smokehouse: 'smoke', restaurant: 'plate', lighthouse: 'lighthouse' };
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
  smokeNote: 'Workers smoke the fish you tick.',
  smokeNone: 'Catch some fish first. They will show up here.',
  rules: 'Workers go to the restaurant first, then the smokehouse, then to the market.',
  carryingTo: (dest: string): string => `Carrying to the ${dest}`,
  dest: { market: 'market', restaurant: 'restaurant', smoke: 'smokehouse' },
  carryingSmoked: 'Carrying smoked fish to the market',
};

// ---- boats and repairs -------------------------------------------------------------------------------------------

export const BOAT_TEXT = {
  broken: 'Broken',
  brokenChip: 'Broken. It cannot sail.',
  fixHint: 'Go to the shipyard to get it fixed.',
  fixing: (secs: number): string => `Being fixed · ${secs}s left`,
  stayNote: 'The boat stays home when a storm comes.',
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
  upkeep: 'Care for the boats',
  tomorrow: 'Tomorrow',
  today: 'Today',
  weather: 'Weather',
  special: 'Special day',
  noSpecial: 'Nothing special',
  stormSoon: 'A storm is coming. Boats that stay home are safe.',
};

export const ORDER_TEXT = {
  /** What an order really pays: each crate for the order sells for double, and a finished order adds a bonus. */
  note: `Order fish sell for ${ORDER_CRATE_MULT === 2 ? 'double' : `${ORDER_CRATE_MULT}×`}, plus a bonus when the order is done.`,
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
  names: { market: 'Fish market', board: 'Notice board', shipyard: 'Shipyard', inn: 'The inn', smokehouse: 'Smokehouse', restaurant: 'Restaurant', lighthouse: 'Lighthouse' },
  forSale: 'For sale',
  /** Small bubbles over a building: smoked fish is done, something can be bought now, a building has just opened up. */
  bubble: { ready: 'ready', up: 'up', new: 'new' },
};

// ---- fish market window ------------------------------------------------------------------------------

export const MARKET_TEXT = {
  title: 'Fish Market',
  yourFish: 'Your fish',
  carrying: (n: number, total: number) => `${n} ${n === 1 ? 'crate' : 'crates'} · worth $${total}`,
  emptyTitle: 'Your hands are empty',
  emptySteps: ['Walk to a boat that is back and press E to unload it', 'Pick up a crate on the dock with E', 'Bring it here and sell it'],
  prices: "Today's prices",
  pricesNote: 'Selling a lot of one fish makes it cheaper for a while.',
  helloTitle: 'Here you sell your fish!',
  helloLine: 'Press Sell to get money for your fish.',
  youGet: 'You get',
  today: 'Today',
  normalOnly: (n: number) => `Normal price $${n}`,
  down: (normal: number, loss: number) => `Normal $${normal}. Now $${loss} less because you sold a lot. It goes back up slowly.`,
  part: {
    base: 'Normal price',
    smoked: 'Smoked fish',
    fresh: 'Not fully fresh',
    sizeUp: 'Big fish',
    sizeDown: 'Small fish',
    golden: 'Golden fish',
    demand: 'You sold a lot of it today',
    marketDay: 'Market day',
    town: 'Harbour statue',
    order: 'An order wants it',
  },
  wanted: 'Order wants it: double',
  unknown: 'Not caught yet',
  sell: 'Sell',
  sellAll: 'Sell all',
  smoked: 'Smoked. It never goes bad.',
  bad: 'Gone bad',
  fresh: (pct: number) => `${pct}% fresh`,
  tip: 'Fresh fish sell for more.',
};

// ---- locked things (one wording for every window) -----------------------------------------------------------

export const LOCK_TEXT = {
  locked: 'Locked',
  needBoat: (boat: string): string => `Needs a bigger boat: upgrade Boat size to ${boat} first`,
  needRank: (need: number, you: number): string => `Needs rank: ${LOCK_RANK_NAME[need]} (you are ${LOCK_RANK_NAME[you]})`,
  needMoney: (missing: number): string => `You need $${Math.ceil(missing).toLocaleString('en')} more`,
  moneyBar: (have: number, cost: number): string => `$${Math.floor(have).toLocaleString('en')} of $${cost.toLocaleString('en')}`,
  price: 'Price',
};

// ---- the shipyard page and the boat spot window ------------------------------------------------------------

export const YARD_TEXT = {
  note: 'Buy boats and make them better here.',
  yourBoats: (n: number, max: number): string => `Your boats (${n} of ${max})`,
  yourBoatsHelp: 'Press Open to upgrade a boat.',
  noBoats: 'You have no boats yet.',
  buyTitle: 'Buy a new boat',
  buyHelp: 'New boats start small.',
  allBoats: 'You have all four boats. Every boat spot is used.',
  harbourTitle: 'Harbour upgrades',
  harbourHelp: 'These help every boat.',
  upgradeShort: { hull: 'Size', hold: 'Space', gear: 'Nets', sails: 'Speed' },
  away: 'Out fishing',
  docked: 'In the harbour',
  captain: (name: string): string => `Captain ${name}`,
  noCaptain: 'No captain',
  open: 'Open',
  owned: 'Bought',
  buy: 'Buy',
};

export const BOAT_OFFER_TEXT = {
  name: 'New rowboat',
  spot: (n: number): string => `Boat spot ${n}`,
  can: (crates: number, zone: string, secs: number): string => `A small, sturdy boat. It carries ${crates} crates and fishes the ${zone}. A trip takes about ${secs} seconds.`,
  later: 'Upgrade it later to carry more, catch rarer fish and go further out.',
  buy: 'Buy this boat',
  buyShort: 'Buy',
  full: 'You have all four boats.',
  taken: (name: string): string => `${name} is tied up here.`,
  otherSpot: (n: number): string => `A new boat goes to boat spot ${n} first.`,
  title: (n: number): string => `Boat spot ${n}`,
};

export const UPGRADE_ROW_TEXT = {
  level: (n: number, max: number): string => `${n} of ${max} upgrades`,
  now: 'Now',
  next: 'Next',
  upgrade: 'Upgrade',
  maxed: 'Fully upgraded',
  allDone: 'This is as good as it gets.',
  upgradeNote: 'Each upgrade costs more than the last.',
  zoneHow: 'Upgrade Boat size on the Upgrade tab.',
};

// ---- captains, as shown in the boat window and the shipyard ------------------------------------------------

export const CAPTAIN_TEXT = {
  getTitle: 'Get a captain',
  getHelp: 'A captain sails this boat for you.',
  wage: (n: number): string => `$${n} a day`,
  hire: 'Hire',
  noneToHire: 'No captains are looking for work right now. Check the inn later.',
  lockedWhy: 'Captains sail a boat for you.',
  hasTitle: 'Your captain',
  fishes: (zone: string): string => `Fishes: ${zone}`,
  change: 'Change place',
  selfSails: 'Sails by itself',
  youSend: 'You send it',
  getButton: 'Get a captain',
  helpGoing: 'Sails, unloads and sails again by itself.',
  level: (n: number): string => `Level ${n}`,
  toNext: (trips: number, next: number): string => `${trips} more ${trips === 1 ? 'trip' : 'trips'} to level ${next}`,
  topLevel: 'Best there is',
  levelHelp: 'Captains get better with every trip, and ask for more pay.',
  pickBoat: 'Pick a boat for the captain. Pay depends on the boat.',
  payOn: (boat: string, n: number): string => `$${n} a day on ${boat}`,
  levelUp: (name: string, level: number): string => `${name} is now a level ${level} captain. Better fish, shorter trips, and a little more pay.`,
};

/** Town projects on the notice board. Ids and numbers are in sim/config.ts (PROJECTS). */
export const TOWN_TEXT = {
  tab: 'Town',
  note: 'Pay once to fix the town and get a bonus forever.',
  pay: 'Pay for it',
  done: 'Done',
  doneToast: (name: string): string => `${name}: done! The town thanks you.`,
  project: {
    road: { name: 'Fix the harbour road', desc: 'Workers walk 20% faster.' },
    hall: { name: 'New roof for the fish hall', desc: 'Market prices go back up twice as fast after you sell.' },
    houses: { name: 'Paint the old houses', desc: 'More visitors come. The restaurant pays 25% more.' },
    fair: { name: 'Clear the fair ground', desc: 'Market days come twice as often.' },
    wall: { name: 'Rebuild the sea wall', desc: 'Storms break boats half as often.' },
    school: { name: 'Open the sailing school', desc: 'Captains learn twice as fast.' },
    bandstand: { name: 'Build a bandstand', desc: 'Golden fish are twice as common.' },
    statue: { name: 'Raise the harbour statue', desc: 'Every sale pays 5% more.' },
  } as Record<ProjectId, { name: string; desc: string }>,
};
