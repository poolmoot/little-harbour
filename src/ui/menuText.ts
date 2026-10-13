/** All wording for the title screen, pause menu, settings and how-to-play page. Kept apart from text.ts. */
import { ORDER_BONUS, ORDER_CRATE_MULT } from '../sim/config';

export const GAME_NAME = 'Little Harbour';
export const GAME_TAGLINE = 'A cosy harbour of your own.';

/** The controls line at the bottom left of the screen. */
export const HINTS = 'WASD walk  ·  E use  ·  L fish book  ·  M sound  ·  Esc menu';

export const MENU = {
  resume: 'Resume',
  paused: 'Paused',
  settings: 'Settings',
  howToPlay: 'How to play',
  backToTitle: 'Back to title',
  back: 'Back',
  pauseNote: 'The game is waiting for you. Your game is saved when you go back to the title.',
  pauseFoot: 'Press Esc to carry on.',
  continueGame: 'Continue',
  newGame: 'New game',
  /** Under the Continue button. */
  saveLine: (day: number, money: string) => `Day ${day}  ·  $${money}`,
  newGameAsk: 'Start a new game?',
  newGameWarn: 'This deletes your saved game.',
  newGameYes: 'Yes, start new',
  newGameNo: 'No, go back',
  soundOff: 'Sound is off. Press M to turn it on.',
  soundOn: 'Sound is on.',
};

export const SETTINGS = {
  sound: 'Sound',
  soundSwitch: 'Sound',
  soundSwitchNote: 'You can also press M.',
  on: 'On',
  off: 'Off',
  volumes: [
    ['master', 'Overall', 'How loud everything is.'],
    ['music', 'Music', 'The tune that plays as you work.'],
    ['ambience', 'Background', 'Waves, wind and gulls.'],
    ['effects', 'Effects', 'Clicks, splashes and coins.'],
  ] as const,
  resetTitle: 'Reset game',
  resetNote: 'Delete your save and start again from the beginning.',
  resetButton: 'Reset game',
  resetAsk: 'Delete your save and start again?',
  resetYes: 'Yes, delete it',
  resetNo: 'No, keep it',
};

export const HOWTO = {
  aboutTitle: 'The game',
  about: [
    'You run a small fishing harbour. Boats catch fish, and you carry the fish to the market to sell.',
    'Spend what you earn on better boats and helpers, and make your harbour bigger.',
  ],
  keysTitle: 'Keys',
  keys: [
    [['W', 'A', 'S', 'D'], 'Walk around'],
    [['E'], 'Use the thing next to you'],
    [['L'], 'Open the fish book'],
    [['M'], 'Sound on or off'],
    [['Esc'], 'Menu, or close a window'],
  ] as const,
  tipsTitle: 'Tips',
  tips: [
    ['rowboat', 'Send your boats out to sea. Farther trips can bring better fish.'],
    ['crate', 'When a boat comes back, unload it at the pier.'],
    ['stall', 'Sell your fish at the market before it goes bad.'],
    ['note', `Fill orders from the notice board. Each crate for an order sells for ${ORDER_CRATE_MULT === 2 ? 'double' : `${ORDER_CRATE_MULT} times the price`}, and a finished order pays ${Math.round(ORDER_BONUS * 100)}% extra.`],
    ['hammer', 'Buy upgrades at the shipyard. Faster, bigger boats earn more.'],
    ['dockhand', 'Hire people. Captains sail boats for you and workers carry crates.'],
  ] as const,
};
