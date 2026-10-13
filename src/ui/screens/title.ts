import { button, esc, money } from '../components';
import { icon } from '../icons';
import { GAME_NAME, GAME_TAGLINE, MENU } from '../menuText';
import type { Screen } from './types';

const hero = `<div class="menu-hero ol">${GAME_NAME}</div><p class="menu-tag">${GAME_TAGLINE}</p>`;

/** The first screen: Continue (only with a save), New game, Settings, How to play. */
export const titleScreen: Screen = ({ state: s, hasSave, confirmNew }) => {
  if (confirmNew) {
    return {
      title: GAME_NAME, icon: '', menu: true, bare: true,
      body: `${hero}<div class="menu-list"><div class="menu-ask ol">${MENU.newGameAsk}</div><p class="menu-warn">${MENU.newGameWarn}</p>
        ${button({ label: MENU.newGameYes, act: 'newyes', tone: 'danger', size: 'lg', wide: true })}
        ${button({ label: MENU.newGameNo, act: 'newno', tone: 'ghost', size: 'lg', wide: true })}</div>`,
    };
  }
  const harbour = hasSave ? `<div class="menu-harbour ol">${esc(s.harbourName)}</div>` : '';
  const items = [
    hasSave ? `${button({ label: MENU.continueGame, act: 'continue', tone: 'go', size: 'lg', wide: true })}<div class="menu-save">${MENU.saveLine(s.day, money(s.money))}</div>` : '',
    button({ label: MENU.newGame, act: 'newgame', tone: hasSave ? 'gold' : 'go', size: 'lg', wide: true }),
    button({ label: `${icon('gear', 24)}${MENU.settings}`, act: 'settings', tone: 'info', size: 'lg', wide: true }),
    button({ label: `${icon('help', 24)}${MENU.howToPlay}`, act: 'howto', tone: 'info', size: 'lg', wide: true }),
  ].filter(Boolean);
  return { title: GAME_NAME, icon: '', menu: true, bare: true, body: `${hero}${harbour}<div class="menu-list">${items.join('')}</div>` };
};
