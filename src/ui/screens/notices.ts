import { HOUR_SECONDS, ORDER_BONUS, ORDER_REFILL_DELAY } from '../../sim/config';
import { contractsUnlocked } from '../../sim/contracts';
import { formatClock, gameSecondsFor } from '../../sim/time';
import type { Contract, GameState } from '../../sim/state';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, empty, item, meter, money, price, section } from '../components';
import { fishIcon, icon } from '../icons';
import { CONTRACT_TEXT, ORDER_TEXT } from '../screenText';
import { CONTRACT_LABEL, FISH_NAME, contractProgress, contractTimeLeft, crates } from '../text';
import { pickTab } from './types';
import type { Screen, ScreenCtx, TabDef } from './types';

/** Seconds of deadline that fill the urgency meter. */
const FULL_METER_SECONDS = 60;
const DAY_SECONDS = HOUR_SECONDS * 24;

const TABS: TabDef[] = [{ id: 'orders', label: CONTRACT_LABEL.orders }, { id: 'contracts', label: CONTRACT_LABEL.tab }];

function orders(s: GameState): string {
  let body = s.orders.length ? '' : empty('No orders right now.');
  for (const o of s.orders) {
    const left = Math.max(0, o.deadline - s.clock);
    const by = formatClock((s.dayTime + gameSecondsFor(s.dayTime, left)) % DAY_SECONDS);
    const frac = left / FULL_METER_SECONDS;
    body += item({
      art: fishIcon(hex(SPECIES_COLOUR[o.species]), 28),
      title: `${o.name} wants ${o.qty} × ${FISH_NAME[o.species]}`,
      sub: `${o.filled} of ${o.qty} done · by ${by} (${Math.ceil(left)}s left)`,
      extra: meter(frac, frac > 0.6 ? 'green' : frac > 0.3 ? 'amber' : 'red'),
      right: price(`+${money(o.baseValue * ORDER_BONUS)}`),
    });
  }
  return body;
}

const fishName = (c: Contract): string => `${FISH_NAME[c.species]} (${c.smoked ? CONTRACT_TEXT.smoked : CONTRACT_TEXT.sellFresh})`;

/** The contracts tab: two offers to choose from, the active contract, or "come back tomorrow". */
export function contracts(s: GameState): string {
  if (!contractsUnlocked(s)) return empty(CONTRACT_LABEL.locked);
  const board = s.contracts;
  if (board.active) {
    const c = board.active;
    const left = Math.max(0, c.deadline - s.clock);
    return section(CONTRACT_LABEL.active) + item({
      art: fishIcon(hex(SPECIES_COLOUR[c.species]), 30),
      title: `${crates(c.qty)} of ${fishName(c)}`,
      sub: contractTimeLeft(c, s.clock, DAY_SECONDS),
      extra: meter(c.filled / c.qty, left < DAY_SECONDS ? 'amber' : 'green', contractProgress(c)),
      right: price(`+${money(c.reward)}`),
    }) + `<p class="dim">${CONTRACT_LABEL.note}</p>`;
  }
  if (!board.offers.length) return empty(CONTRACT_TEXT.backTomorrow);
  return section(CONTRACT_LABEL.choose) + board.offers.map((c) => item({
    art: fishIcon(hex(SPECIES_COLOUR[c.species]), 30),
    title: `${crates(c.qty)} of ${fishName(c)}`,
    sub: CONTRACT_TEXT.offerSub(c.days),
    right: `${price(`+${money(c.reward)}`)}${button({ label: CONTRACT_LABEL.accept, act: 'accept', a: c.id, size: 'sm' })}`,
  })).join('') + `<p class="dim">${CONTRACT_LABEL.note}</p>`;
}

export const noticesScreen: Screen = (ctx: ScreenCtx) => {
  const s = ctx.state;
  const tab = pickTab(ctx, TABS);
  return {
    title: 'Notice board',
    icon: icon('note', 28),
    tabs: TABS,
    tab,
    note: tab === 'orders' ? ORDER_TEXT.note : CONTRACT_TEXT.only1,
    body: tab === 'orders' ? orders(s) : contracts(s),
    foot: tab === 'orders' && s.orderCooldowns.length
      ? `<span class="dim">A new order comes in about ${Math.ceil(Math.min(...s.orderCooldowns))}s (${ORDER_REFILL_DELAY}s after one ends).</span>`
      : undefined,
  };
};
