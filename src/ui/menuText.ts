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
  harbourTitle: 'Your harbour',
  harbourNote: 'The name shows at the top of the screen. Press Enter to save.',
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
    'Spend what you earn to upgrade your boats, hire helpers and grow your harbour.',
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

/** Privacy and terms, linked at the bottom of the title screen. Plain words, not legal language. */
export const LEGAL = {
  privacy: 'Privacy',
  terms: 'Terms',
  updated: 'Last updated 22 October 2026.',
  privacyTitle: 'Privacy',
  privacyParts: [
    ['The short version', [
      'Little Harbour has no accounts, no ads and no shop. We do not ask for your name or your email, and we do not sell anything about you.',
    ]],
    ['Your saved game', [
      'Your game is saved in your own browser, on your own device. It is never sent to us. If you clear your browser data, your save is gone.',
    ]],
    ['What we count', [
      'To see how many people play and to fix problems, the game uses a service called PostHog, hosted in the EU. It records:',
      '- that you visited, which page, and roughly where in the world you are (we do not keep your full IP address)',
      '- your device, browser and screen size, and how fast the game loads',
      '- clicks and key presses on the page, and recordings of how the screen looked while you played, so we can see where people get stuck',
      '- errors and crashes, with the technical details',
      '- a few game moments, like starting a game, buying a boat or reaching a new rank',
      'We never record the harbour or boat names you type in as part of this counting. A random number stored in your browser tells one visit from another. It is not your name.',
    ]],
    ['Who sees it', [
      'Only the maker of the game can see this information. PostHog stores it for us. It is used to make the game better, and for nothing else.',
    ]],
    ['Your choices', [
      'You can stop the counting by turning on your browser\'s tracking protection or by using a blocker. The game works the same without it. You can clear the random number by clearing your browser data.',
    ]],
    ['Changes', [
      'If this changes, this page changes too.',
    ]],
  ] as const,
  termsTitle: 'Terms',
  termsParts: [
    ['Playing', [
      'Little Harbour is a free game for fun. By playing it you agree to these simple terms.',
    ]],
    ['Your game', [
      'Your saved game lives in your browser. We cannot get it back for you if it is lost, deleted or moved to another device.',
    ]],
    ['No promises', [
      'The game is given as it is. We try to keep it working, but we do not promise it will always work, be free of mistakes, or stay online. We are not responsible for any loss that comes from playing it.',
    ]],
    ['Be kind', [
      'Please do not try to break the game, copy it and pass it off as your own, or use it for anything harmful.',
    ]],
    ['Ownership', [
      'The game, its look and its sound belong to its maker. You may play it and tell your friends about it.',
    ]],
    ['Changes', [
      'We may change or stop the game, or these terms, at any time.',
    ]],
  ] as const,
};
