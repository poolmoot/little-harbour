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

/** Privacy, terms and the data choice. Plain words, not legal language. Written to cover what the GDPR asks a privacy notice to say. */
const CONTACT = '<a href="https://github.com/poolmoot/little.harbour/issues" target="_blank" rel="noopener">our contact page on GitHub</a>';

export const LEGAL = {
  privacy: 'Privacy',
  terms: 'Terms',
  updated: 'Last updated 22 October 2026.',
  privacyTitle: 'Privacy',
  privacyParts: [
    ['The short version', [
      'Little Harbour has no accounts, no ads and no shop. We never ask for your name or email. Nothing about how you play is counted unless you say yes, and you can change your mind at any time in Settings.',
    ]],
    ['Who is responsible', [
      'Little Harbour is made by Poolmoot. We decide what is counted and why. You can reach us through ' + CONTACT + '.',
    ]],
    ['Stored on your device', [
      'These stay in your own browser and are never sent to us:',
      '- your saved game',
      '- your sound and picture settings',
      '- your choice about counting (yes or no)',
      'They are needed for the game to work, so there is nothing to agree to. Clearing your browser data removes them.',
    ]],
    ['If you say yes to counting', [
      'We use a service called PostHog, with its servers in the EU, to learn how the game is used and to fix problems. Only if you say yes, it records:',
      '- your visit: the page, the time, and roughly where in the world you are (your full IP address is not kept)',
      '- your device, browser and screen size, and how fast the game loads',
      '- clicks and key presses, and a recording of how the screen looked while you played',
      '- errors and crashes, with technical details',
      '- a few game moments, like starting a game, buying a boat or reaching a new rank',
      'To tell one visit from another, a random number is kept in your browser. It is not your name and we cannot tell who you are from it. The harbour and boat names you type are not sent as counts, but they could show up in a screen recording.',
    ]],
    ['Why we may do this', [
      'We only do it because you agreed. That is our legal reason (your consent). If you say no, none of the above is recorded and the game works exactly the same.',
    ]],
    ['Who gets it, and for how long', [
      'Only we can see it. PostHog stores it for us and does not use it for its own purposes. Screen recordings are kept for 30 days. Counts and events are kept for up to one year.',
    ]],
    ['Your choices and rights', [
      'You can turn counting on or off at any time in Settings under "Play data". Turning it off stops new recording at once.',
      'You can ask us to show you what we hold about you, to correct it, or to delete it, and you can object to how we use it. Tell us through ' + CONTACT + ', and include the random number if you can find it (we cannot find your data without it). You also have the right to complain to your country\'s data protection authority.',
    ]],
    ['Children', [
      'Anyone can play. Counting is only for people who are old enough to agree for themselves. If you are under 16 (or 13 in some countries), please ask a parent or carer before you say yes, or just say no.',
    ]],
    ['Changes', [
      'If this page changes, the date above changes, and we will ask you again if the change is a big one.',
    ]],
  ] as const,
  termsTitle: 'Terms',
  termsParts: [
    ['Playing', [
      'Little Harbour is a free game, made for fun. By playing it you agree to these terms. If you do not agree, please do not play.',
    ]],
    ['Your game', [
      'Your saved game lives in your browser. We cannot get it back if it is lost, deleted, or moved to another device, so we cannot promise it will always be there.',
    ]],
    ['Be kind', [
      'Please do not try to break the game, attack the website, or use it for anything harmful. Please do not copy the game and pass it off as your own.',
    ]],
    ['Who owns what', [
      'The game, its look and its sound belong to its maker. You may play it, share the link, and tell your friends. The harbour and boat names you type are yours.',
    ]],
    ['No promises', [
      'The game is given as it is. We try to keep it working, but we do not promise it will always work, have no mistakes, or stay online. We are not responsible for losses that come from playing, to the most that the law allows. Nothing here takes away rights that you always have by law.',
    ]],
    ['Changes and stopping', [
      'We may change or stop the game, or these terms, at any time. If these terms change, the date below changes.',
    ]],
    ['Questions', [
      'You can reach us through ' + CONTACT + '.',
    ]],
  ] as const,
};

/** The question asked on the title screen, and the matching Settings row. Both answers look the same on purpose. */
export const CONSENT = {
  title: 'Can we count how you play?',
  text: 'It helps us make the game better. If you say no, nothing is recorded. You can change your mind in Settings.',
  yes: 'Yes',
  no: 'No thanks',
  settingsTitle: 'Play data',
  settingsTitleSection: 'Play data',
  settingsNote: 'Lets us count your visit, clicks, errors and screen recordings to improve the game. See Privacy.',
};
