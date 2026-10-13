import { ICE_CAPACITY, UPGRADES } from '../../sim/config';
import { handCrates, iceCrates } from '../../sim/crates';
import type { Crate } from '../../sim/state';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, empty, freshMeter, item, section } from '../components';
import { fishIcon, icon } from '../icons';
import { FISH_NAME } from '../text';
import type { Screen } from './types';

const crateRow = (c: Crate, label: string, act: string): string => item({
  art: fishIcon(hex(SPECIES_COLOUR[c.species]), 24),
  title: FISH_NAME[c.species],
  extra: freshMeter(c.freshness),
  right: button({ label, act, a: c.id, tone: 'info', size: 'sm' }),
});

export const iceboxScreen: Screen = ({ state: s }) => {
  const title = 'Ice box';
  const ic = icon('ice', 28);
  if (!s.upgrades.icebox) {
    return { title, icon: ic, body: empty(`You do not have an ice box yet. Buy one at the shipyard for $${UPGRADES.icebox.cost}. Fish stay fresh 4 times longer.`) };
  }
  const hand = handCrates(s).filter((c) => !c.smoked && !c.king), ice = iceCrates(s);
  const body = section('In your hands') + (hand.length ? hand.map((c) => crateRow(c, 'Put on ice', 'store')).join('') : empty('Nothing.'))
    + section(`On ice ${ice.length} / ${ICE_CAPACITY}`) + (ice.length ? ice.map((c) => crateRow(c, 'Take out', 'take')).join('') : empty('Empty.'));
  return { title, icon: ic, note: 'Crates on ice go bad 4 times slower.', body };
};
