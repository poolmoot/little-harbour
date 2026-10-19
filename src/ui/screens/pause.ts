import { button } from '../components';
import { icon } from '../icons';
import { MENU } from '../menuText';
import { GUIDE } from '../guideText';
import type { Screen } from './types';

/** Shown when Esc is pressed with no window open. The game waits behind it. */
export const pauseScreen: Screen = () => ({
  title: MENU.paused,
  icon: icon('anchor', 28),
  menu: true,
  note: MENU.pauseNote,
  body: `<div class="menu-list">
    ${button({ label: `${icon('play', 24)}${MENU.resume}`, act: 'resume', tone: 'go', size: 'lg', wide: true })}
    ${button({ label: `${icon('gear', 24)}${MENU.settings}`, act: 'settings', tone: 'info', size: 'lg', wide: true })}
    ${button({ label: `${icon('help', 24)}${MENU.howToPlay}`, act: 'howto', tone: 'info', size: 'lg', wide: true })}
    ${button({ label: `${icon('note', 24)}${GUIDE.menuButton}`, act: 'tips', tone: 'info', size: 'lg', wide: true })}
    ${button({ label: MENU.backToTitle, act: 'totitle', tone: 'ghost', size: 'lg', wide: true })}</div>`,
  foot: `<span class="dim">${MENU.pauseFoot}</span>`,
});
