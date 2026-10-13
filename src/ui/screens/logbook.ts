import { SPECIES } from '../../sim/config';
import { hex, SPECIES_COLOUR } from '../../palette';
import { card, cards } from '../components';
import { fishIcon, icon } from '../icons';
import { FISH_NAME } from '../text';
import type { Screen } from './types';

export const logbookScreen: Screen = ({ state: s }) => {
  const caught = SPECIES.filter((sp) => s.book[sp].caught > 0).length;
  const body = cards(SPECIES.map((sp) => {
    const r = s.book[sp];
    return r.caught > 0
      ? card({ tone: 'blue', art: fishIcon(hex(SPECIES_COLOUR[sp]), 34), lines: [`Caught ${r.caught}`, r.bestSale ? `Best sale $${r.bestSale}` : 'Not sold yet'], name: FISH_NAME[sp] })
      : card({ tone: 'grey', art: fishIcon('', 34, true), lines: ['Not caught yet'], name: '???' });
  }));
  const foot = `<span class="dim">${caught} of ${SPECIES.length} fish found</span>`;
  return { title: 'Fish book', icon: icon('book', 28), note: 'Fish you have not caught yet show as dark shapes.', body, foot };
};
