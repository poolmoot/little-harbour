import { BUILDING_IDS, BUILDINGS } from '../../sim/config';
import type { BuildingId } from '../../sim/config';
import { buildingMaxLevel, canBuyBuilding, nextBuildingCost } from '../../sim/buildings';
import { rankOf } from '../../sim/rank';
import type { GameState } from '../../sim/state';
import { buildingIcon } from '../buildingParts';
import { button, buyLabel, lockNote, section, stat } from '../components';
import { icon } from '../icons';
import { LOCK_TEXT, PLOT_TEXT } from '../screenText';
import { BUILDING_DESC, BUILDING_LABEL, BUILDING_LEVELS, BUILDING_NAME, PLOT_SIGN, RANK_NAME } from '../text';
import { lighthouseView } from './lighthouse';
import { restaurantView } from './restaurant';
import { smokehouseView } from './smokehouse';
import type { Screen, ScreenView } from './types';

/** The window for an empty plot: what the building does, its price, the rank it needs, and a Build button. */
export function forSaleView(s: GameState, id: BuildingId): ScreenView {
  const chk = canBuyBuilding(s, id);
  const cost = nextBuildingCost(s, id) ?? 0;
  const rankOk = rankOf(s) >= BUILDINGS[id].rank;
  let later = '';
  const max = buildingMaxLevel(id);
  for (let l = 2; l <= max; l++) later += `<p class="dim">${PLOT_TEXT.later(l, BUILDINGS[id].cost[l], BUILDING_LEVELS[id][l - 1])}</p>`;
  return {
    title: `${PLOT_SIGN}: ${BUILDING_NAME[id]}`,
    icon: buildingIcon(id),
    body: section(PLOT_TEXT.whatItDoes) + `<p>${BUILDING_DESC[id]}</p>`
      + `<p class="dim">${PLOT_TEXT.thisLevel}: ${BUILDING_LEVELS[id][0]}</p>`
      + stat(PLOT_TEXT.price, `$${cost.toLocaleString('en')}`)
      + stat(PLOT_TEXT.rankNeeded, `<span class="${rankOk ? 'good' : 'bad'}">${RANK_NAME[BUILDINGS[id].rank]}</span>`)
      + (chk.ok ? '' : `<div style="margin:10px 0">${lockNote({ cost, money: s.money, rank: rankOf(s), needRank: chk.needRank, reason: chk.reason })}</div>`)
      + (later ? section(PLOT_TEXT.laterTitle) + later : ''),
    foot: `<span class="dim">${BUILDING_LABEL.empty}</span>${button({ label: chk.ok || rankOk ? buyLabel(PLOT_TEXT.build, cost) : `${icon('lock', 22)}${LOCK_TEXT.locked}`, act: 'build', a: id, off: !chk.ok, hero: true })}`,
  };
}

/** One window for all four plots: ctx.arg is the building's place in BUILDING_IDS. */
export const plotScreen: Screen = (ctx) => {
  const id = BUILDING_IDS[ctx.arg] ?? BUILDING_IDS[0];
  const s = ctx.state;
  if (s.buildings[id] === 0) return forSaleView(s, id);
  switch (id) {
    case 'smokehouse': return smokehouseView(s);
    case 'restaurant': return restaurantView(s);
    case 'lighthouse': return lighthouseView(s);
  }
};
