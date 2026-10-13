import { rackRoom, smokeRacks, smokeSeconds } from '../../sim/buildings';
import { smokeCrates } from '../../sim/crates';
import { smokedPrice } from '../../sim/market';
import type { GameState } from '../../sim/state';
import { buildingIcon, fishArt, fishName, handsFull, levelNote, smokable, upgradeRow } from '../buildingParts';
import { button, empty, item, meter, section } from '../components';
import { PLOT_TEXT, SMOKE_TEXT } from '../screenText';
import { BUILDING_NAME, FISH_NAME } from '../text';
import type { ScreenView } from './types';

export function smokehouseView(s: GameState): ScreenView {
  const racks = smokeRacks(s);
  const total = smokeSeconds(s);
  const inside = smokeCrates(s);
  const hold = handsFull(s);
  let rows = '';
  for (let i = 0; i < racks; i++) {
    const c = inside[i];
    if (!c) {
      rows += item({ art: `<span class="dim">${i + 1}</span>`, title: SMOKE_TEXT.free, state: 'locked' });
    } else if (c.smoked) {
      rows += item({
        art: fishArt(c), title: `${FISH_NAME[c.species]} · ${SMOKE_TEXT.ready}`, sub: SMOKE_TEXT.worth(smokedPrice(s, c.species)),
        right: button({ label: SMOKE_TEXT.take, act: 'smokeout', a: c.id, size: 'sm', off: hold }),
      });
    } else {
      const left = Math.max(0, c.smokeLeft ?? 0);
      rows += item({
        art: fishArt(c), title: FISH_NAME[c.species], sub: SMOKE_TEXT.smoking(Math.ceil(left)),
        extra: meter(1 - left / total, 'amber'),
      });
    }
  }
  const room = rackRoom(s);
  const carried = smokable(s);
  const list = carried.length ? carried.map((c) => item({
    art: fishArt(c), title: fishName(c), sub: `${Math.round(c.freshness)}% fresh`,
    right: button({ label: room > 0 ? SMOKE_TEXT.smoke : SMOKE_TEXT.allFull, act: 'smokein', a: c.id, tone: 'info', size: 'sm', off: room <= 0 }),
  })).join('') : empty(PLOT_TEXT.nothingForThis);
  return {
    title: BUILDING_NAME.smokehouse,
    icon: buildingIcon('smokehouse'),
    note: `${levelNote(s, 'smokehouse')} ${SMOKE_TEXT.note}`,
    body: section(`${SMOKE_TEXT.racks} ${inside.length} / ${racks}`) + rows + section(SMOKE_TEXT.carried) + list + `<div style="height:10px"></div>` + upgradeRow(s, 'smokehouse'),
  };
}
