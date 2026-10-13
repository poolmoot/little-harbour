import { button, item, section } from '../components';
import { icon } from '../icons';
import type { IconName } from '../icons';
import { HOWTO, MENU } from '../menuText';
import type { Screen } from './types';

const cap = (k: string) => `<span class="kbd">${k}</span>`;

/** One short page: what the game is, the keys, and a few plain tips. */
export const howtoScreen: Screen = () => ({
  title: MENU.howToPlay,
  icon: icon('help', 28),
  menu: true,
  body: section(HOWTO.aboutTitle)
    + HOWTO.about.map((t) => `<p class="howto-about">${t}</p>`).join('')
    + section(HOWTO.keysTitle)
    + `<div class="keys">${HOWTO.keys.map(([keys, what]) => `<span class="caps">${keys.map(cap).join('')}</span><span>${what}</span>`).join('')}</div>`
    + section(HOWTO.tipsTitle)
    + HOWTO.tips.map(([ic, text]) => item({ art: icon(ic as IconName, 30), title: text })).join(''),
  foot: `${button({ label: MENU.back, act: 'menuback', tone: 'info', size: 'sm' })}<span class="dim">Esc</span>`,
});
