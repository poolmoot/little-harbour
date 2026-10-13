import { RESTAURANT_MIN_FRESH, RESTAURANT_VARIETY_BONUS } from '../../sim/config';
import { restaurantCapacity, restaurantPrice, restaurantRoom } from '../../sim/buildings';
import { handCrates } from '../../sim/crates';
import type { Crate, GameState } from '../../sim/state';
import { hex, SPECIES_COLOUR } from '../../palette';
import { buildingIcon, fishArt, levelNote, upgradeRow } from '../buildingParts';
import { crateFacts, crateRowState, crateTitle } from '../fishParts';
import { button, chip, empty, freshMeter, item, section } from '../components';
import { fishIcon } from '../icons';
import { PLOT_TEXT, RESTAURANT_TEXT } from '../screenText';
import { BUILDING_DESC, BUILDING_NAME, FISH_NAME } from '../text';
import type { ScreenView } from './types';

/** Why the restaurant will not take this crate right now, or null when it will. */
export function restaurantRefusal(s: GameState, c: Crate): string | null {
  if (c.king) return RESTAURANT_TEXT.refuse.king;
  if (c.golden) return RESTAURANT_TEXT.refuse.golden;
  if (c.smoked) return RESTAURANT_TEXT.refuse.smoked;
  if (c.freshness <= 0) return RESTAURANT_TEXT.refuse.gone;
  if (c.freshness < RESTAURANT_MIN_FRESH) return RESTAURANT_TEXT.refuse.stale;
  if (restaurantRoom(s) <= 0) return RESTAURANT_TEXT.refuse.full;
  return null;
}

export function restaurantView(s: GameState): ScreenView {
  const room = restaurantRoom(s);
  const cap = restaurantCapacity(s);
  const kinds = s.restaurant.kinds;
  const hands = handCrates(s);
  const rows = hands.length ? hands.map((c) => {
    const why = restaurantRefusal(s, c);
    return item({
      art: fishArt(c),
      title: crateTitle(c),
      state: crateRowState(c),
      sub: why ? `<span class="${c.golden ? 'warn' : 'bad'}">${why}</span>` : RESTAURANT_TEXT.pays(restaurantPrice(s, c)),
      extra: `<div class="facts-row">${crateFacts(c)}</div>${c.king || c.smoked ? '' : freshMeter(c.freshness)}`,
      right: button({ label: RESTAURANT_TEXT.sell, act: 'restsell', a: c.id, size: 'sm', off: why !== null }),
    });
  }).join('') : empty(PLOT_TEXT.nothingInHands);
  const tried = kinds.length
    ? `<div class="chips">${kinds.map((k) => chip(`${fishIcon(hex(SPECIES_COLOUR[k]), 13)}${FISH_NAME[k]}`)).join('')}</div>`
    : `<p class="dim">${RESTAURANT_TEXT.none}</p>`;
  return {
    title: BUILDING_NAME.restaurant,
    icon: buildingIcon('restaurant'),
    note: `${levelNote(s, 'restaurant')} ${BUILDING_DESC.restaurant}`,
    body: section(RESTAURANT_TEXT.todayTitle)
      + `<p class="${room > 0 ? '' : 'warn'}">${room > 0 ? RESTAURANT_TEXT.leftToday(room) : RESTAURANT_TEXT.doneToday} <span class="dim">(${s.restaurant.served} of ${cap})</span></p>`
      + section(RESTAURANT_TEXT.tried) + tried
      + `<p class="dim">${RESTAURANT_TEXT.bonus(kinds.length)}${kinds.length ? ` (${Math.round(RESTAURANT_VARIETY_BONUS * 100)}% for each other fish)` : ''}</p>`
      + section(PLOT_TEXT.inHands) + rows
      + `<div style="height:10px"></div>` + upgradeRow(s, 'restaurant'),
  };
}
