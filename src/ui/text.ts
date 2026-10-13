// Everything the player reads that has a name or a repeated label lives here, so wording can be
// edited in one place. Keep it simple: short, common words, short sentences, no sailing or business
// jargon. Only the words change here; code names and save keys stay as they are.
import {
  BIG_CATCH_EXTRA, BUILDINGS, COLD_CAPACITY, DEMAND_DROPS, GEAR_MULT, HOLD_SIZES, ICE_CAPACITY, LUCKY_MULT, MARKET_DAY_MULT, REPAIR_SECONDS,
  RESTAURANT_CAPACITY, RESTAURANT_MIN_FRESH, RESTAURANT_MULT, RESTAURANT_VARIETY_BONUS, SAILS_MULT, SMOKED_MULT, SMOKE_RACKS, SMOKE_SECONDS,
  STORM_CATCH_MULT, STORM_DAMAGE_CHANCE, SWIFT_MULT, THRIFTY_MULT, WEATHER_TRIP_MULT, ZONES, ZONE_IDS,
} from '../sim/config';
import type { BuildingId, Phase, Species, Track, Trait, UpgradeId, WeatherId, ZoneId } from '../sim/config';
import type { Boat, Contract, Special } from '../sim/state';

const pct = (x: number): number => Math.round(x * 100);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
export const crates = (n: number): string => plural(n, 'crate');

// ---- names ---------------------------------------------------------------

export const FISH_NAME: Record<Species, string> = {
  herring: 'Herring', mackerel: 'Mackerel', flounder: 'Flounder', seabass: 'Sea bass', snapper: 'Red snapper', lobster: 'Lobster',
  cod: 'Cod', tuna: 'Tuna', swordfish: 'Swordfish', anglerfish: 'Anglerfish', squid: 'Giant squid', sturgeon: 'Golden sturgeon',
};

export const ZONE_NAME: Record<ZoneId, string> = { shallows: 'Shallow Water', reef: 'Coral Reef', opensea: 'Open Sea', deep: 'Deep Sea' };

export const PHASE_NAME: Record<Phase, string> = { dawn: 'Morning', day: 'Day', dusk: 'Evening', night: 'Night' };

/** Boat types by size (index = boat size level). The hint tells what the name means. */
const BOAT_TYPE = ['Rowboat', 'Sloop', 'Cutter', 'Trawler'];
const BOAT_HINT = ['small boat', 'medium boat', 'large boat', 'big boat'];
export const boatType = (level: number): string => `${BOAT_TYPE[level]} (${BOAT_HINT[level]})`;
const boatTypeShort = (level: number): string => BOAT_TYPE[level];

export const TRACK_NAME: Record<Track, string> = { hull: 'Boat size', hold: 'Crate space', gear: 'Nets', sails: 'Speed' };

export const RANK_NAME = ['Beginner', 'Boat Owner', 'Small Company', 'Fleet Boss', 'Harbour Boss'];
export const RANK_UNLOCKS = [
  'The basics',
  'Workers, a second boat, the Sloop (medium boat)',
  'Captains, a third boat, the Cutter (large boat), the bigger stall',
  'A fourth boat, the Trawler (big boat), the big stall',
  'The top title, and a golden weathervane on the inn',
];
export const needsRank = (rank: number): string => `Needs rank: ${RANK_NAME[rank]}`;

export const TRAIT: Record<Trait, { name: string; desc: string }> = {
  swift: { name: 'Fast', desc: `Trips take ${pct(1 - SWIFT_MULT)}% less time` },
  lucky: { name: 'Lucky', desc: `Finds rare fish ${pct(LUCKY_MULT - 1)}% more often` },
  careful: { name: 'Strong', desc: 'Carries 1 more crate' },
  thrifty: { name: 'Saver', desc: `Asks ${pct(1 - THRIFTY_MULT)}% less pay` },
};

export const UPGRADE: Record<UpgradeId, { name: string; desc: string }> = {
  icebox: { name: 'Ice box', desc: `Keeps up to ${ICE_CAPACITY} crates fresh 4 times longer.` },
  handcart: { name: 'Handcart', desc: 'You and your workers carry 4 crates, not 2.' },
  stall1: { name: 'Bigger stall', desc: `Selling lowers the price by ${pct(DEMAND_DROPS[1])}% a crate, not ${pct(DEMAND_DROPS[0])}%.` },
  stall2: { name: 'Big stall', desc: `Selling lowers the price by only ${DEMAND_DROPS[2] * 100}% a crate.` },
};

export const NPC_TITLE = { fishmonger: 'Greta, fish seller', shipwright: 'Osric, boat builder', innkeeper: 'Bram, inn owner' };

// ---- boat upgrade texts -----------------------------------------------------

/** What a boat has now on a track. */
export function trackNow(b: Boat, t: Track): string {
  const l = b[t];
  switch (t) {
    case 'hull': return boatType(l);
    case 'hold': return `${crates(HOLD_SIZES[l])}`;
    case 'gear': return l === 0 ? 'Plain nets' : `Rare fish ×${GEAR_MULT[l]}`;
    case 'sails': return l === 0 ? 'Normal speed' : `Trips ${pct(1 - SAILS_MULT[l])}% shorter`;
  }
}

/** What the next level gives. */
export function trackNext(b: Boat, t: Track): string {
  const l = b[t];
  switch (t) {
    case 'hull': return `${boatType(l + 1)}. It can go to ${ZONE_NAME[ZONE_IDS[l + 1]]}.`;
    case 'hold': return `Carries ${HOLD_SIZES[l + 1]} crates, not ${HOLD_SIZES[l]}.`;
    case 'gear': return `Finds rare fish ${GEAR_MULT[l + 1]} times as often.`;
    case 'sails': return `Trips take ${pct(1 - SAILS_MULT[l + 1])}% less time.`;
  }
}

export const zoneNeeds = (zone: ZoneId): string => `Needs a bigger boat: ${boatTypeShort(ZONES[zone].needsHull)}`;

// ---- shared labels -------------------------------------------------------------

export const LABEL = {
  close: 'Close (Esc)',
  buy: 'Buy',
  owned: 'Owned',
  full: 'Full',
  maxed: 'Maxed',
  open: 'Open',
  endJob: 'End job',
  locked: 'Locked',
  tripCost: 'Trip cost',
  tripCostNote: 'Trip cost pays for food and supplies. You pay it when the boat leaves.',
  captain: 'Captain',
  moneyIn: 'Money in',
  moneyOut: 'Money out',
  rank: 'Rank',
  topRank: 'Top rank',
};

/** Why a button is greyed out (the sim gives a short reason, and a rank when only that is missing). */
export const denyText = (reason: string | undefined, needRank?: number): string =>
  needRank !== undefined ? needsRank(needRank) : (reason ?? 'You cannot do that now.');

// ---- picture quality ---------------------------------------------------------------

export const QUALITY_TITLE = 'Picture quality';
export const QUALITY_NOTE = 'Auto starts on High and goes down by itself if the game runs slowly.';
export const QUALITY_CHOICES = [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] as const;

// ---- toasts and prompts (game.ts) ------------------------------------------------------

export const say = {
  welcome: 'Welcome to the harbour! Walk with WASD. Press E near things.',
  welcomeBack: 'Welcome back! Your boats are waiting.',
  catchWaiting: 'A boat is back with fish. Unload it at the pier.',
  sailed: (zone: ZoneId, cost: number) => `The boat sails to ${ZONE_NAME[zone]}. Trip cost: $${cost}.`,
  returned: (n: number) => `A boat is back with ${crates(n)}! Unload it at the pier.`,
  unloaded: (n: number) => `Unloaded ${crates(n)}. Fish start going bad now, so be quick!`,
  spoiled: (s: Species) => `A crate of ${FISH_NAME[s]} has gone bad.`,
  discarded: (s: Species) => `Threw away a bad crate of ${FISH_NAME[s]}.`,
  orderPosted: 'A new order is on the notice board.',
  orderDone: (name: string, bonus: number) => `${name}'s order is done! Bonus +$${bonus}`,
  orderLate: (name: string) => `${name}'s order ran out of time.`,
  caught: (s: Species) => `You caught a ${FISH_NAME[s]}!`,
  lostEarly: 'Too early! The fish got away.',
  lostLate: 'Too slow! The fish got away.',
  lostFull: 'Your hands were full.',
  bought: (id: UpgradeId) => `You bought: ${UPGRADE[id].name}.`,
  boatBetter: (name: string) => `${name} is now better.`,
  boatBought: 'You bought a new rowboat!',
  hired: (name: string, role: 'captain' | 'dockhand') => `${name} is now your ${role === 'captain' ? 'captain' : 'worker'}.`,
  fired: (name: string) => `${name} left.`,
  unpaid: (n: number) => `Could not pay ${plural(n, 'person', 'people')}. They do not work today.`,
  rankUp: (rank: number) => `New rank! You unlocked: ${RANK_UNLOCKS[rank]}`,
  nightFalls: 'Night is here. Boats cannot go out until morning.',
  sold: (n: number, total: number) => `Sold ${crates(n)} for $${total}.`,
  bonusPop: (bonus: number) => `Bonus +$${bonus}`,
  // prompts
  throwAway: (s: Species) => `Throw away bad ${FISH_NAME[s]}`,
  handsFull: 'Hands full',
  pickUp: (s: Species, fresh: number) => `Pick up ${FISH_NAME[s]} crate (${fresh}% fresh)`,
  unload: (name: string, n: number) => `Unload ${name} (${crates(n)})`,
  openBoat: (name: string, secsLeft: number | null) => `${name}: open boat menu${secsLeft === null ? '' : ` (at sea, ${secsLeft}s left)`}`,
  market: 'Sell fish at the market',
  shipyard: 'Go to the shipyard',
  board: 'Read the notice board',
  inn: 'Hire people at the inn',
  iceOwned: 'Use the ice box',
  iceBuy: 'Ice box (buy it at the shipyard)',
  cast: 'Cast your line',
  pullNow: 'PULL NOW!',
  waitBite: 'Wait for a bite…  (pulling early loses the fish)',
};

// ---- people in the harbour ------------------------------------------------------------------

export interface LineContext {
  phase: Phase;
  handSpecies: Species[];
  recentFilled: boolean;
  recentMissed: boolean;
  money: number;
  boatsOut: number;
  openOrders: number;
}
export type Role = 'fishmonger' | 'shipwright' | 'innkeeper';

/** Pick a line that reacts to what is happening. `n` rotates through the lines that fit. */
export function pickLine(role: Role, c: LineContext, n: number): string {
  const lines: string[] = [];
  const rare = c.handSpecies.some((s) => s === 'lobster' || s === 'snapper' || s === 'seabass');
  if (role === 'fishmonger') {
    if (rare) lines.push('Is that a reef fish? Bring it over before it goes bad!');
    if (c.recentFilled) lines.push('That order made someone happy. Well done!');
    if (c.recentMissed) lines.push('Missed an order? Fish goes bad fast, and people do not wait.');
    if (c.phase === 'night') lines.push('The market is closed at night. Go and rest.');
    if (c.phase === 'dawn' || c.phase === 'dusk') lines.push('Flounder bite in the morning and the evening. They sell well.');
    lines.push('Fresh fish sells best. Do not let it sit in the sun.', 'If I get too much of one fish, the price goes down. Bring a mix!');
  } else if (role === 'shipwright') {
    if (c.phase === 'night') lines.push('Boats cannot go out in the dark. Come back in the morning.');
    if (c.boatsOut > 0) lines.push('Your boat is out there. Listen for the bell.');
    if (c.money >= 150) lines.push('I see money in your pocket. Want more crate space?');
    lines.push('More crate space means more fish on every trip.', 'A bigger boat can go to the coral reef.');
  } else {
    if (c.recentFilled) lines.push('I heard you finished that order. Drinks for everyone!');
    if (c.recentMissed) lines.push('Too bad about that order. There will be another one.');
    if (c.openOrders > 0) lines.push('There are orders on the notice board. People pay double for the right fish.');
    if (c.phase === 'night') lines.push('It is warm in here at night. The lanterns are lit on the quay.');
    if (c.phase === 'dawn') lines.push('Up with the gulls! The tea is hot.');
    lines.push('Read the notice board before you pick where to fish.');
  }
  return lines[n % lines.length];
}


// ---- goals ------------------------------------------------------------------------------------
// One short line per goal, keyed by the goal id in sim/config.ts (GOALS). `have` and `need` are shown by the HUD for goals with a count.

export const GOAL_TEXT: Record<string, string> = {
  send: 'Send your boat out to sea. Walk to the boat and press E.',
  unload: 'Wait for the boat to come back, then unload it at the pier.',
  sell: 'Carry the crates to the market and sell them.',
  pier: 'Catch a fish from the end of the pier.',
  space: 'Buy more crate space for your boat at the shipyard.',
  order: 'Fill an order from the notice board.',
  rank1: 'Earn enough money to become a Boat Owner.',
  worker: 'Hire a worker at the inn. Workers carry crates for you.',
  boat2: 'Buy a second boat.',
  reef: 'Send a boat to the Coral Reef.',
  cold: 'Build the cold store. It keeps fish fresh for a long time.',
  smoke: 'Build the smokehouse. Smoked fish sells for more.',
  rank2: 'Become a Small Company.',
  captain: 'Hire a captain. Captains sail your boat for you.',
  reeffish: 'Catch every kind of fish at the Coral Reef.',
  contract: 'Finish a contract from the notice board.',
  restaurant: 'Build the restaurant. It pays double for fresh fish.',
  sell100: 'Sell 100 crates of fish.',
  rank3: 'Become a Fleet Boss.',
  storm: 'Sail to the Open Sea or the Deep Sea on a stormy day, and get home safely.',
  level2: 'Make any building bigger.',
  seafish: 'Catch every kind of fish in the Open Sea.',
  rank4: 'Become the Harbour Boss.',
  lighthouse: 'Build the lighthouse. Then your boats can sail at night.',
  king: 'Catch the King Fish. Sail to the Deep Sea at night.',
};
export const GOAL_LABEL = { title: 'Goal', reward: 'Reward', done: 'All goals done!', all: 'You finished every goal.' };
export const goalCount = (have: number, need: number): string => `${have} of ${need}`;

// ---- buildings ----------------------------------------------------------------------------------

export const PLOT_SIGN = 'For sale';

export const BUILDING_NAME: Record<BuildingId, string> = { coldstore: 'Cold store', smokehouse: 'Smokehouse', restaurant: 'Restaurant', lighthouse: 'Lighthouse' };

export const BUILDING_DESC: Record<BuildingId, string> = {
  coldstore: 'Keeps fish fresh for a very long time. Fish lose all their freshness in 20 minutes here, not 2 and a half. The ice box stays too.',
  smokehouse: `Turns a fresh crate into a smoked crate. Smoked fish sells for ${SMOKED_MULT} times the price, and it never goes bad.`,
  restaurant: `Buys fresh fish (at least ${RESTAURANT_MIN_FRESH}% fresh) for ${RESTAURANT_MULT} times the price. It does not lower the market price. It pays ${Math.round(RESTAURANT_VARIETY_BONUS * 100)}% more for each different fish it was served today.`,
  lighthouse: 'Lights the way, so your boats can sail at night. You need it to find the King Fish.',
};

/** What each level gives, for the building panel. Index = level - 1. */
export const BUILDING_LEVELS: Record<BuildingId, string[]> = {
  coldstore: [1, 2, 3].map((l) => `Holds ${crates(COLD_CAPACITY[l])}.`),
  smokehouse: [1, 2, 3].map((l) => `${plural(SMOKE_RACKS[l], 'rack')}. ${SMOKE_SECONDS[l]} seconds for each crate.`),
  restaurant: [1, 2, 3].map((l) => `Buys ${crates(RESTAURANT_CAPACITY[l])} a day.`),
  lighthouse: ['Boats can sail at night.'],
};

export const buildingNeeds = (id: BuildingId): string => needsRank(BUILDINGS[id].rank);
export const BUILDING_LABEL = {
  build: 'Build',
  upgrade: 'Make bigger',
  level: (l: number, max: number): string => (max === 1 ? 'Built' : `Level ${l} of ${max}`),
  empty: 'An empty plot. Walk up and press E.',
  prompt: (id: BuildingId, level: number): string => (level === 0 ? `${BUILDING_NAME[id]}: build here` : `${BUILDING_NAME[id]}: open`),
  racksFree: (free: number, total: number): string => `${free} of ${plural(total, 'rack')} free`,
  ready: (n: number): string => `${n} ready to collect`,
  coldFull: 'The cold store is full.',
  served: (n: number, max: number): string => `Served today: ${n} of ${max}`,
  smokeTitle: 'Smoke these',
  smokeNote: 'Tick the fish your workers should put in the smokehouse.',
  workerRules: 'Workers go to the restaurant first, then the smokehouse, then the market or the storage.',
};

// ---- weather and special days ----------------------------------------------------------------

export const WEATHER: Record<WeatherId, { name: string; desc: string }> = {
  calm: { name: 'Calm', desc: 'A quiet day. Nothing special.' },
  wind: { name: 'Good wind', desc: `Trips are ${pct(1 - WEATHER_TRIP_MULT.wind)}% shorter.` },
  fog: { name: 'Fog', desc: `Trips are ${pct(WEATHER_TRIP_MULT.fog - 1)}% longer.` },
  storm: { name: 'Storm', desc: `Trips to the Open Sea and the Deep Sea bring ${pct(STORM_CATCH_MULT - 1)}% more crates, but a boat may come home broken with no fish (about ${pct(STORM_DAMAGE_CHANCE)} in 100). The Shallow Water and the Coral Reef are safe.` },
};
export const WEATHER_LABEL = { today: 'Today', tomorrow: 'Tomorrow', stayHome: 'Stay home in storms', stayHomeNote: 'Tick this to keep the boat in the harbour when a storm comes. Only the Open Sea and the Deep Sea are risky.' };

export function specialName(sp: Special): string {
  if (!sp) return 'Nothing special';
  return sp.kind === 'market' ? 'Market day' : `Big catch day: ${ZONE_NAME[sp.zone]}`;
}
export function specialDesc(sp: Special): string {
  if (!sp) return '';
  return sp.kind === 'market'
    ? `Fish sells for ${MARKET_DAY_MULT} times the price at the market.`
    : `Every trip to the ${ZONE_NAME[sp.zone]} brings ${BIG_CATCH_EXTRA} more crates.`;
}

export const REPAIR = {
  broken: 'Broken. This boat cannot sail until it is fixed.',
  fix: (cost: number): string => `Fix the boat ($${cost})`,
  fixing: (secs: number): string => `Being fixed… ${secs}s left`,
  note: `The boat builder needs ${REPAIR_SECONDS} seconds to fix a boat.`,
};

// ---- contracts ----------------------------------------------------------------------------------

export const CONTRACT_LABEL = {
  tab: 'Contracts',
  orders: 'Orders',
  choose: 'Choose one contract',
  accept: 'Take this contract',
  none: 'No contracts right now. Check again tomorrow.',
  locked: 'Contracts open when you are a Boat Owner.',
  active: 'Your contract',
  note: 'Crates count when you sell them at the market. You get the reward when the whole contract is done.',
};

export function contractText(c: Contract): string {
  const fish = `${FISH_NAME[c.species]}${c.smoked ? ' (smoked)' : ''}`;
  return `Bring ${crates(c.qty)} of ${fish} to the market in ${plural(c.days, 'day')}. Reward: $${c.reward}.`;
}
export const contractProgress = (c: Contract): string => `${c.filled} of ${c.qty} sold`;
export const contractTimeLeft = (c: Contract, now: number, daySeconds: number): string => {
  const days = Math.max(0, (c.deadline - now) / daySeconds);
  return days >= 1 ? `${plural(Math.ceil(days), 'day')} left` : 'Less than a day left';
};

// ---- the King Fish and the ending ---------------------------------------------------------------------

export const KING = {
  found: 'You found the King Fish! Carry it to the inn.',
  carrying: 'You are carrying the King Fish. Take it to the inn!',
  deliver: 'Show the King Fish to everyone',
  noSell: 'The King Fish is not for sale.',
  wall: 'The King Fish hangs on the wall of the inn.',
};
export const ENDING = {
  title: 'The King Fish!',
  story: 'You carry the great golden fish into the inn. Everybody stops talking. Bram takes his hat off. Nobody in the harbour has ever seen a fish like this. They will tell the story for years. You are the best fisher in the harbour.',
  days: (n: number): string => `Days played: ${n}`,
  earned: (n: number): string => `Money earned: $${n.toLocaleString('en')}`,
  fish: (n: number): string => `Fish caught: ${n.toLocaleString('en')}`,
  boats: (n: number): string => `Boats owned: ${n}`,
  keepPlaying: 'Keep playing',
};

// ---- money per minute and toasts for the new events ------------------------------------------------------

export const perMinute = (n: number): string => `$${Math.round(n).toLocaleString('en')} a minute`;

// ---- names and the fish book -------------------------------------------------------------------

export const NAME_PROBLEM: Record<string, string> = {
  empty: 'Please type a name.',
  long: 'That name is too long. Use 16 letters or fewer.',
  chars: 'Please use only letters, numbers and spaces.',
  nothing: 'That boat is not here.',
};
export const NAME_LABEL = { harbour: 'Harbour name', boat: 'Boat name', save: 'Save name', rename: 'Rename' };

export const NAME_TOAST = {
  harbour: (name: string): string => `Your harbour is now called ${name}.`,
  boat: (name: string): string => `The boat is now called ${name}.`,
};

export const starText = (n: number): string => (n <= 0 ? 'No stars yet' : `${n} ${n === 1 ? 'star' : 'stars'}`);
export const sizeText = (cm: number): string => `${Math.round(cm)} cm`;
export const FISH_BOOK = {
  caught: 'Caught',
  biggest: 'Biggest',
  stars: 'Best stars',
  golden: 'Golden ones',
  bestSale: 'Best price',
  goldenName: 'Golden',
  seen: (a: number, b: number): string => `Fish found: ${a} of ${b}`,
  threeStar: (a: number, b: number): string => `Fish with 3 stars: ${a} of ${b}`,
  goldenFound: (a: number, b: number): string => `Golden fish found: ${a} of ${b}`,
  rewardCaught: (zone: string, amount: number): string => `You have found every fish in ${zone}! Reward +$${amount}`,
  rewardStars: (zone: string, amount: number): string => `3 stars on every fish in ${zone}! Reward +$${amount}`,
  goldenToast: (fish: string): string => `A golden ${fish}! It is worth five times as much.`,
  noSmoke: 'A golden fish is too special to smoke. Sell it at the market.',
  starsHelp: 'Bigger fish get more stars and sell for a little more.',
  landed: (species: Species, cm: number, stars: number): string => `You caught a ${FISH_NAME[species]}! ${sizeText(cm)}, ${starText(stars)}.`,
  goldenBanner: (fish: string): string => `Golden ${fish}!`,
  goldenBannerSub: 'A rare catch. It is worth five times as much.',
  zoneRewardEarned: 'Earned',
  zoneRewardTodo: 'To earn',
  zoneFound: (a: number, b: number): string => `Fish found: ${a} of ${b}`,
  zoneStars: (a: number, b: number): string => `With 3 stars: ${a} of ${b}`,
  rewardCaughtRow: 'Find every fish here',
  rewardStarsRow: 'Get 3 stars on every fish here',
  overall: 'Your fish book',
  unseen: 'Not found yet',
  notSold: 'Not sold yet',
};

/** How a crate's size and golden shine change its price, in words. */
export const CRATE_TEXT = {
  golden: 'Golden',
  goldenPays: (mult: number): string => `Golden: pays ${mult} times as much`,
  bigger: (pct: number): string => `pays ${pct}% more for its size`,
  smaller: (pct: number): string => `pays ${pct}% less for its size`,
  normalSize: 'A normal size, so a normal price',
};

// ---- welcome back (earnings while away) ---------------------------------------------------------

/** Time away in plain words: "1 minute", "45 minutes", "1 hour", "2 hours 10 minutes". Whole minutes, at least 1. */
export function durationText(seconds: number): string {
  const total = Math.max(1, Math.round(seconds / 60));
  const unit = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (total < 60) return unit(total, 'minute');
  const h = Math.floor(total / 60), m = total % 60;
  return m ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(h, 'hour');
}

export const AWAY = {
  title: 'Welcome back!',
  note: 'Your captains kept fishing while you were gone.',
  earned: (n: number): string => `Your harbour earned $${n.toLocaleString('en')} while you were away.`,
  away: (seconds: number): string => `You were away for ${durationText(seconds)}.`,
  earnedLabel: 'Money earned',
  rate: (perMinute: number): string => `Your boats make about $${Math.round(perMinute).toLocaleString('en')} a minute.`,
  capped: 'Only the first 8 hours count.',
  half: 'You earn half as much when you are not here.',
  workLine: 'Boats with captains keep working while you are away, at half speed, for up to 8 hours.',
  nothing: 'Hire a captain and your boats will fish even when you are away.',
  tipTitle: 'A tip',
  tip: 'Hire a captain at the inn, and your harbour will earn money even while you are away.',
  go: 'Back to the harbour',
  statsLine: 'While you were away',
};

export const sayTycoon = {
  goalDone: (reward: number): string => `Goal done! Reward +$${reward}`,
  built: (id: BuildingId, level: number): string => (level === 1 ? `The ${BUILDING_NAME[id].toLowerCase()} is built!` : `The ${BUILDING_NAME[id].toLowerCase()} is now bigger.`),
  smoking: 'A crate is in the smokehouse.',
  smoked: 'A crate of smoked fish is ready.',
  served: (s: Species, price: number): string => `The restaurant bought ${FISH_NAME[s]} for $${price}.`,
  newDay: (weather: WeatherId, special: Special, tomorrow: WeatherId, tomorrowSpecial: Special): string =>
    `Today: ${WEATHER[weather].name}${special ? `, ${specialName(special)}` : ''}. Tomorrow: ${WEATHER[tomorrow].name}${tomorrowSpecial ? `, ${specialName(tomorrowSpecial)}` : ''}.`,
  damaged: (name: string): string => `${name} came home broken. Fix it at the shipyard.`,
  repairing: (name: string): string => `${name} is being fixed.`,
  repaired: (name: string): string => `${name} is as good as new.`,
  offered: 'New contracts are on the notice board.',
  accepted: 'You took a contract.',
  contractDone: (reward: number): string => `Contract done! Reward +$${reward}`,
  contractFailed: 'You ran out of time. The contract is over.',
};
