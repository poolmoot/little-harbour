import { button, item, section } from '../components';
import { icon } from '../icons';
import { MENU } from '../menuText';
import { GUIDE } from '../guideText';
import { helpEntries } from '../guideParts';
import { HARBOUR_MASTER_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import type { Screen, ScreenCtx } from './types';

/** The harbour master's short welcome at the start of a new game. */
export const welcomeScreen: Screen = () => ({
  title: GUIDE.welcomeTitle,
  icon: icon('anchor', 28),
  host: portrait(HARBOUR_MASTER_LOOK),
  note: GUIDE.masterName,
  body: GUIDE.welcome.map((t) => `<p class="guide-welcome">${t}</p>`).join(''),
  foot: `${button({ label: GUIDE.welcomeSkip, act: 'welcomeskip', tone: 'ghost', size: 'sm' })}${button({ label: GUIDE.welcomeGo, act: 'close', tone: 'go', hero: true })}`,
});

function listBody(ctx: ScreenCtx): string {
  const entries = helpEntries(ctx.state);
  const row = (e: (typeof entries)[number]) => item({
    title: e.title,
    sub: e.line,
    right: button({ label: GUIDE.showMe, act: 'guidereplay', a: e.key, tone: 'info', size: 'sm' }),
  });
  const open = entries.filter((e) => e.group === 'opening');
  const more = entries.filter((e) => e.group === 'more');
  const off = ctx.guideTips !== false ? '' : `<p class="dim">${GUIDE.tipsOffNote}</p>`;
  if (!entries.length) return `${off}<p class="dim">${GUIDE.helpEmpty}</p>`;
  return off + (open.length ? section(GUIDE.groupOpening) + open.map(row).join('') : '') + (more.length ? section(GUIDE.groupMore) + more.map(row).join('') : '');
}

/** The "?" window opened from the HUD. */
export const helpScreen: Screen = (ctx) => ({
  title: GUIDE.helpTitle,
  icon: icon('help', 28),
  note: GUIDE.helpNote,
  body: listBody(ctx),
});

/** The same list inside the menus, next to How to play. */
export const tipsScreen: Screen = (ctx) => ({
  title: GUIDE.helpTitle,
  icon: icon('help', 28),
  menu: true,
  note: GUIDE.helpNote,
  body: listBody(ctx),
  foot: `${button({ label: MENU.back, act: 'menuback', tone: 'info', size: 'sm' })}<span class="dim">Esc</span>`,
});
