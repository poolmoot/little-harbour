// Everything the player reads that has a name or a repeated label lives here, so wording can be
// edited in one place. Keep it simple: short, common words, short sentences, no sailing or business
// jargon. Only the words change here; code names and save keys stay as they are.
import {
  DEMAND_DROPS, GEAR_MULT, HOLD_SIZES, ICE_CAPACITY, LUCKY_MULT, SAILS_MULT, SWIFT_MULT, THRIFTY_MULT, ZONES, ZONE_IDS,
} from '../sim/config';
import type { Phase, Species, Track, Trait, UpgradeId, ZoneId } from '../sim/config';
import type { Boat } from '../sim/state';

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
  hints: 'WASD walk  ·  E use  ·  L fish book  ·  Esc close',
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
