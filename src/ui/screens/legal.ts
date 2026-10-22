import { button } from '../components';
import { LEGAL, MENU } from '../menuText';
import type { Screen } from './types';

type Parts = readonly (readonly [string, readonly string[]])[];

/** Plain text pages: a heading, then lines. Lines that start with "- " become a short list. */
function page(title: string, parts: Parts): ReturnType<Screen> {
  const lines = (ls: readonly string[]) => ls.map((l) => (l.startsWith('- ') ? `<li>${l.slice(2)}</li>` : `</ul><p>${l}</p><ul>`)).join('');
  const body = parts.map(([h, ls]) => `<h3 class="legal-h">${h}</h3><div class="legal-text"><ul>${lines(ls)}</ul></div>`).join('')
    .replace(/<ul><\/ul>/g, '');
  return {
    title, icon: '', menu: true,
    body: `${body}<p class="legal-date">${LEGAL.updated}</p>`,
    foot: `${button({ label: MENU.back, act: 'menuback', tone: 'info', size: 'sm' })}<span class="dim">Esc</span>`,
  };
}

export const privacyScreen: Screen = () => page(LEGAL.privacyTitle, LEGAL.privacyParts);
export const termsScreen: Screen = () => page(LEGAL.termsTitle, LEGAL.termsParts);
