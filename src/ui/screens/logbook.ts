import { FISH, SPECIES } from '../../sim/config';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, card, cards } from '../components';
import { fishIcon, icon } from '../icons';
import type { Screen } from './types';

export const logbookScreen: Screen = ({ state: s, confirmReset }) => {
  const caught = SPECIES.filter((sp) => s.book[sp].caught > 0).length;
  const body = cards(SPECIES.map((sp) => {
    const r = s.book[sp];
    return r.caught > 0
      ? card({ tone: 'blue', art: fishIcon(hex(SPECIES_COLOUR[sp]), 34), lines: [`Caught ${r.caught}`, r.bestSale ? `Best sale $${r.bestSale}` : 'Not sold yet'], name: FISH[sp].name })
      : card({ tone: 'grey', art: fishIcon('', 34, true), lines: ['Not caught yet'], name: '???' });
  }));
  const foot = confirmReset
    ? `<span class="ol">Delete your save and start over?</span><span class="row-x">${button({ label: 'Yes, reset', act: 'resetyes', tone: 'danger', size: 'sm' })}${button({ label: 'Cancel', act: 'resetno', tone: 'ghost', size: 'sm' })}</span>`
    : `<span class="dim">${caught} of ${SPECIES.length} species found</span>${button({ label: 'Reset game', act: 'reset', tone: 'ghost', size: 'sm' })}`;
  return { title: 'Logbook', icon: icon('book', 28), body, foot };
};
