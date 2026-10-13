import { coldCapacity } from '../../sim/buildings';
import { coldCrates } from '../../sim/crates';
import type { GameState } from '../../sim/state';
import { buildingIcon, fishArt, fishName, handsFull, levelNote, storable, upgradeRow } from '../buildingParts';
import { crateFacts, crateRowState } from '../fishParts';
import { button, empty, freshMeter, item, meter, section } from '../components';
import { COLD_TEXT, PLOT_TEXT } from '../screenText';
import { BUILDING_NAME, LABEL } from '../text';
import type { ScreenView } from './types';

export function coldstoreView(s: GameState): ScreenView {
  const cap = coldCapacity(s);
  const inside = coldCrates(s);
  const full = inside.length >= cap;
  const hands = storable(s);
  const hold = handsFull(s);
  const stored = inside.length ? inside.map((c) => item({
    art: fishArt(c), title: fishName(c), state: crateRowState(c), sub: crateFacts(c), extra: freshMeter(c.freshness),
    right: button({ label: COLD_TEXT.takeOut, act: 'coldout', a: c.id, tone: 'info', size: 'sm', off: hold }),
  })).join('') : empty(COLD_TEXT.empty);
  const carried = hands.length ? hands.map((c) => item({
    art: fishArt(c), title: fishName(c), state: crateRowState(c), sub: crateFacts(c), extra: freshMeter(c.freshness),
    right: button({ label: full ? LABEL.full : COLD_TEXT.putIn, act: 'coldin', a: c.id, tone: 'info', size: 'sm', off: full }),
  })).join('') : empty(PLOT_TEXT.nothingForThis);
  return {
    title: BUILDING_NAME.coldstore,
    icon: buildingIcon('coldstore'),
    note: `${levelNote(s, 'coldstore')} ${COLD_TEXT.note}`,
    body: section(COLD_TEXT.inside(inside.length, cap)) + meter(inside.length / cap, full ? 'red' : 'cyan', COLD_TEXT.howFull(inside.length, cap))
      + `<div style="height:8px"></div>` + stored
      + section(PLOT_TEXT.inHands) + carried
      + (full ? `<p class="dim">${COLD_TEXT.full}</p>` : '') + (hold && inside.length ? `<p class="dim">${COLD_TEXT.hands}</p>` : '')
      + `<div style="height:10px"></div>` + upgradeRow(s, 'coldstore'),
  };
}
