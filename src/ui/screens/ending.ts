import { endingSummary } from '../../sim/ending';
import { NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import { button, money, stat } from '../components';
import { icon } from '../icons';
import { ENDING_TEXT } from '../screenText';
import { ENDING } from '../text';
import type { Screen } from './types';

/** The story ends: a short tale and the summary of the game so far, with a button to carry on. */
export const endingScreen: Screen = ({ state }) => {
  const e = endingSummary(state);
  return {
    title: ENDING.title,
    icon: icon('star', 28),
    host: portrait(NPC_LOOK.innkeeper),
    note: ENDING.story,
    body: stat(ENDING_TEXT.days, String(e.days)) + stat(ENDING_TEXT.earned, `$${money(e.earned)}`) + stat(ENDING_TEXT.fish, money(e.fishCaught)) + stat(ENDING_TEXT.boats, String(e.boats)),
    foot: `<span class="dim">${ENDING_TEXT.bram}</span>${button({ label: ENDING.keepPlaying, act: 'close', size: 'lg' })}`,
  };
};
