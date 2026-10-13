import { FISH, HOUR_SECONDS, ORDER_BONUS, ORDER_REFILL_DELAY } from '../../sim/config';
import { formatClock } from '../../sim/time';
import { hex, SPECIES_COLOUR } from '../../palette';
import { empty, item, meter, money, price } from '../components';
import { fishIcon, icon } from '../icons';
import type { Screen } from './types';

/** Seconds of deadline that fill the urgency meter. */
const FULL_METER_SECONDS = 60;

export const noticesScreen: Screen = ({ state: s }) => {
  let body = s.orders.length ? '' : empty('No notices right now.');
  for (const o of s.orders) {
    const left = Math.max(0, o.deadline - s.clock);
    const by = formatClock((s.dayTime + left) % (HOUR_SECONDS * 24));
    const frac = left / FULL_METER_SECONDS;
    body += item({
      art: fishIcon(hex(SPECIES_COLOUR[o.species]), 28),
      title: `${o.name} wants ${o.qty} × ${FISH[o.species].name}`,
      sub: `${o.filled} of ${o.qty} delivered · by ${by} (${Math.ceil(left)}s left)`,
      extra: meter(frac, frac > 0.6 ? 'green' : frac > 0.3 ? 'amber' : 'red'),
      right: price(`+${money(o.baseValue * ORDER_BONUS)}`),
    });
  }
  return {
    title: 'Notice board',
    icon: icon('note', 28),
    note: `Sell matching crates at the market. Each pays double, and finishing an order adds a ${Math.round(ORDER_BONUS * 100)}% bonus.`,
    body,
    foot: s.orderCooldowns.length
      ? `<span class="dim">Next notice in about ${Math.ceil(Math.min(...s.orderCooldowns))}s. A new one appears ${ORDER_REFILL_DELAY}s after a slot frees.</span>`
      : undefined,
  };
};
