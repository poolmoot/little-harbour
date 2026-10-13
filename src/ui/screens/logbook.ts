import { SPECIES } from '../../sim/config';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, card, cards, item, section } from '../components';
import { fishIcon, icon } from '../icons';
import { FISH_NAME, QUALITY_CHOICES, QUALITY_NOTE, QUALITY_TITLE } from '../text';
import type { Screen } from './types';

export const logbookScreen: Screen = ({ state: s, confirmReset, quality }) => {
  const caught = SPECIES.filter((sp) => s.book[sp].caught > 0).length;
  const body = cards(SPECIES.map((sp) => {
    const r = s.book[sp];
    return r.caught > 0
      ? card({ tone: 'blue', art: fishIcon(hex(SPECIES_COLOUR[sp]), 34), lines: [`Caught ${r.caught}`, r.bestSale ? `Best sale $${r.bestSale}` : 'Not sold yet'], name: FISH_NAME[sp] })
      : card({ tone: 'grey', art: fishIcon('', 34, true), lines: ['Not caught yet'], name: '???' });
  })) + section(QUALITY_TITLE) + item({
    title: QUALITY_CHOICES.find(([k]) => k === quality)?.[1] ?? '',
    sub: QUALITY_NOTE,
    right: QUALITY_CHOICES.map(([k, name]) => button({ label: name, act: 'quality', a: k, tone: quality === k ? 'go' : 'ghost', size: 'sm' })).join(''),
  });
  const foot = confirmReset
    ? `<span class="ol">Delete your save and start again?</span><span class="row-x">${button({ label: 'Yes, start again', act: 'resetyes', tone: 'danger', size: 'sm' })}${button({ label: 'No', act: 'resetno', tone: 'ghost', size: 'sm' })}</span>`
    : `<span class="dim">${caught} of ${SPECIES.length} fish found</span>${button({ label: 'Start again', act: 'reset', tone: 'ghost', size: 'sm' })}`;
  return { title: 'Fish book', icon: icon('book', 28), note: 'Fish you have not caught yet show as dark shapes.', body, foot };
};
