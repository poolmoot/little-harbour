/** All wording for the starting guide: the welcome, the step cards, the unlock cards and the help list. Simple, short, everyday English. */
import type { StepId, UnlockId } from '../sim/guide';

export const GUIDE = {
  masterName: 'Harbour master',
  welcomeTitle: 'Welcome to the harbour',
  welcome: [
    'Ah, there you are. This harbour used to be busy.',
    "Let's bring it back, you and me.",
    'Follow the glowing trail on the ground. It shows you where to go.',
  ],
  welcomeGo: "Let's go",
  welcomeSkip: 'Skip the tips',
  skipToast: 'Tips are off. You can turn them on again in Settings.',
  stepLabel: (n: number, total: number) => `Guide ${n} of ${total}`,
  newLabel: 'New in the harbour',
  close: 'Got it',
  helpTitle: 'Help and tips',
  helpNote: 'Everything the harbour master has told you. Press Show me to see it again.',
  helpEmpty: 'Nothing yet. Tips will show up as you play.',
  showMe: 'Show me',
  welcomeEntry: 'The welcome',
  tipsOffNote: 'Guide tips are off. You can still read them here.',
  settingsTitle: 'Show guide tips',
  settingsNote: 'Little cards and a glowing trail that show you what to do next.',
  helpTile: 'Help',
  menuButton: 'Guide tips',
  groupOpening: 'Getting started',
  pressSend: 'Press Send out to go fishing',
  pressSell: 'Press Sell to get paid',
  openYourBoat: 'Open your boat',
  buySpace: 'Buy more crate space',
  groupMore: 'More things to do',
} as const;

export interface StepText { title: string; keys: string[]; line: string }

export const STEP_TEXT: Record<StepId, StepText> = {
  walk: { title: 'Walk', keys: ['W', 'A', 'S', 'D'], line: 'Use these keys to walk. Follow the trail to your boat.' },
  send: { title: 'Send your boat', keys: ['E'], line: 'Stand next to your boat and press E. Pick a place to fish.' },
  pier: { title: 'Fish from the pier', keys: ['E'], line: 'While you wait, go to the end of the pier. Press E to cast, and E again when the line jumps.' },
  unload: { title: 'The boat is back', keys: ['E'], line: 'The bell rang. Walk to your boat and press E to unload the fish.' },
  carry: { title: 'Pick up the crates', keys: ['E'], line: 'Stand by a crate and press E to pick it up. Then carry it to the market.' },
  sell: { title: 'Sell your fish', keys: ['E'], line: 'At the market stall, press E and sell. Fresh fish earn more.' },
  space: { title: 'Room for more', keys: ['E'], line: 'Visit the shipyard and buy more crate space for your boat.' },
  board: { title: 'Read the notice board', keys: ['E'], line: 'People post orders here. Fill them for a bonus.' },
};

export interface CardText { title: string; line: string }

export const UNLOCK_TEXT: Record<UnlockId, CardText> = {
  workers: { title: 'Workers', line: 'You can hire a worker at the inn. Workers carry crates for you.' },
  captains: { title: 'Captains', line: 'You can hire a captain at the inn. A captain sails a boat for you, even when you are busy.' },
  coldstore: { title: 'Cold store', line: 'You can build a cold store. Fish stay fresh in there much longer.' },
  smokehouse: { title: 'Smokehouse', line: 'You can build a smokehouse. Smoked fish never spoil and sell for more.' },
  restaurant: { title: 'Restaurant', line: 'You can build a restaurant. It buys fish at a good price.' },
  lighthouse: { title: 'Lighthouse', line: 'You can build a lighthouse. It makes night trips faster and lets you find the King Fish.' },
  contracts: { title: 'Contracts', line: 'The notice board now has contracts. A big job pays a big reward.' },
  weather: { title: 'Weather', line: 'The weather changes the days. Stormy seas can break a boat, so check tomorrow before a long trip.' },
  book: { title: 'Fish book', line: 'Press L to open the fish book. Catch every fish in a sea to earn a reward.' },
  away: { title: 'While you are away', line: 'Your harbour keeps earning a little while you are away. Captains and workers help it earn more.' },
};

/** What to do instead while a step cannot be done yet (see sim/guideAdvice.ts). */
export const ADVICE = {
  cost: (cost: number) => `That costs $${cost}. Earn a little first:`,
  how: {
    unload: 'unload your boat, it is back.',
    carry: 'carry your fish to the market.',
    pickup: 'pick up a crate of fish.',
    send: 'send your boat out again.',
    pier: 'fish from the end of the pier.',
  },
} as const;

/** Where a card tells the player to go, in a few words (shown under the line when there is a trail). */
export const TRAIL_HINT = 'Follow the glowing trail.';
