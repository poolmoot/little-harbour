import { REST_DECOR_INCOME, REST_KITCHEN_MULT, REST_MAX, REST_TABLES_EXTRA, REST_TRACKS, REST_WAITERS_MIN_FRESH, RESTAURANT_VARIETY_BONUS } from '../../sim/config';
import type { RestTrack } from '../../sim/config';
import { canUpgradeRest, restaurantMinFresh, restCost } from '../../sim/restaurant';
import { rankOf } from '../../sim/rank';
import { restaurantCapacity, restaurantPrice, restaurantRoom } from '../../sim/buildings';
import { handCrates } from '../../sim/crates';
import type { Crate, GameState } from '../../sim/state';
import { hex, SPECIES_COLOUR } from '../../palette';
import { buildingIcon, fishArt, levelNote, upgradeRow } from '../buildingParts';
import { crateFacts, crateRowState, crateTitle } from '../fishParts';
import { button, buyLabel, chip, empty, freshMeter, item, levelDots, lockNote, section } from '../components';
import { fishIcon, icon } from '../icons';
import type { IconName } from '../icons';
import { LABEL } from '../text';
import { PLOT_TEXT, REST_UP_TEXT, RESTAURANT_TEXT } from '../screenText';
import { BUILDING_DESC, BUILDING_NAME, FISH_NAME } from '../text';
import type { ScreenView, TabDef } from './types';

const TABS: TabDef[] = [{ id: 'today', label: REST_UP_TEXT.tabToday }, { id: 'upgrade', label: REST_UP_TEXT.tabUpgrade }];
const REST_ICON: Record<RestTrack, IconName> = { tables: 'stall', kitchen: 'smoke', waiters: 'dockhand', decor: 'star' };

/** What a restaurant upgrade gives at a level, in plain words. */
function restNow(s: GameState, t: RestTrack, lvl: number): string {
  const base = restaurantCapacity(s) - REST_TABLES_EXTRA[s.restaurantUp.tables];
  switch (t) {
    case 'tables': return REST_UP_TEXT.now.tables(base + REST_TABLES_EXTRA[lvl]);
    case 'kitchen': return REST_UP_TEXT.now.kitchen(REST_KITCHEN_MULT[lvl]);
    case 'waiters': return REST_UP_TEXT.now.waiters(REST_WAITERS_MIN_FRESH[lvl]);
    case 'decor': return REST_UP_TEXT.now.decor(REST_DECOR_INCOME[lvl]);
  }
}

/** One upgrade row: name, level dots, now and next in plain words, a button with the price. */
function restRow(s: GameState, t: RestTrack): string {
  const lvl = s.restaurantUp[t];
  const cost = restCost(s, t);
  const chk = canUpgradeRest(s, t);
  const maxed = cost === null;
  const lock = maxed || chk.ok ? '' : lockNote({ cost: cost ?? 0, money: s.money, rank: rankOf(s), reason: chk.reason });
  const act = maxed ? button({ label: LABEL.maxed, tone: 'gold', off: true }) : button({ label: buyLabel('Upgrade', cost), act: 'restup', a: t, off: !chk.ok });
  return `<div class="urow${maxed ? ' maxed' : ''}"><div class="urow-art">${icon(REST_ICON[t], 40)}</div>`
    + `<div class="urow-main"><div class="urow-head"><span class="item-title ol">${REST_UP_TEXT.name[t]}</span>${levelDots(lvl, REST_MAX)}</div>`
    + `<div class="urow-line">Now: <b>${restNow(s, t, lvl)}</b></div>`
    + (maxed ? '' : `<div class="urow-line">Next: ${restNow(s, t, lvl + 1)}</div>`) + `${lock}</div>`
    + `<div class="urow-act">${act}</div></div>`;
}

/** The live 3D room is put into this slot by the game after the window is drawn. */
const roomSlot = '<div class="room-slot"></div>';

/** Why the restaurant will not take this crate right now, or null when it will. */
export function restaurantRefusal(s: GameState, c: Crate): string | null {
  if (c.king) return RESTAURANT_TEXT.refuse.king;
  if (c.golden) return RESTAURANT_TEXT.refuse.golden;
  if (c.smoked) return RESTAURANT_TEXT.refuse.smoked;
  if (c.freshness <= 0) return RESTAURANT_TEXT.refuse.gone;
  if (c.freshness < restaurantMinFresh(s)) return RESTAURANT_TEXT.refuse.stale(restaurantMinFresh(s));
  if (restaurantRoom(s) <= 0) return RESTAURANT_TEXT.refuse.full;
  return null;
}

export function restaurantView(s: GameState, tab = ''): ScreenView {
  const which = TABS.some((t) => t.id === tab) ? tab : 'today';
  if (which === 'upgrade') {
    return {
      title: BUILDING_NAME.restaurant,
      icon: buildingIcon('restaurant'),
      tabs: TABS,
      tab: which,
      note: REST_UP_TEXT.note,
      body: roomSlot + REST_TRACKS.map((t) => restRow(s, t)).join('') + `<div style="height:6px"></div>` + upgradeRow(s, 'restaurant'),
    };
  }
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
    tabs: TABS,
    tab: which,
    note: `${levelNote(s, 'restaurant')} ${BUILDING_DESC.restaurant}`,
    body: roomSlot + section(RESTAURANT_TEXT.todayTitle)
      + `<p class="${room > 0 ? '' : 'warn'}">${room > 0 ? RESTAURANT_TEXT.leftToday(room) : RESTAURANT_TEXT.doneToday} <span class="dim">(${s.restaurant.served} of ${cap})</span></p>`
      + section(RESTAURANT_TEXT.tried) + tried
      + `<p class="dim">${RESTAURANT_TEXT.bonus(kinds.length)}${kinds.length ? ` (${Math.round(RESTAURANT_VARIETY_BONUS * 100)}% for each other fish)` : ''}</p>`
      + section(PLOT_TEXT.inHands) + rows,
  };
}
