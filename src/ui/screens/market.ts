import { SPECIES } from '../../sim/config';
import { handCrates } from '../../sim/crates';
import { crateValue, sellAll, unitPrice } from '../../sim/market';
import type { GameState } from '../../sim/state';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, chip, empty, freshMeter, item, money, price } from '../components';
import { fishIcon, icon } from '../icons';
import { NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import { KING, FISH_NAME } from '../text';
import { pickTab } from './types';
import type { Screen, TabDef } from './types';

const TABS: TabDef[] = [{ id: 'sell', label: 'Sell' }, { id: 'prices', label: 'Prices' }];

function sell(s: GameState): string {
  const hand = handCrates(s);
  if (!hand.length) return empty('Nothing in your hands. Carry crates here from the dock.');
  return hand.map((c) => {
    if (c.king) return item({ art: fishIcon(hex(SPECIES_COLOUR[c.species]), 26), title: 'King Fish', sub: KING.noSell });
    const wanted = s.orders.some((o) => o.species === c.species && o.filled < o.qty);
    return item({
      art: fishIcon(hex(SPECIES_COLOUR[c.species]), 26),
      title: `${FISH_NAME[c.species]}${c.smoked ? ' (smoked)' : ''}${wanted ? ` ${chip('<span class="warn">Order: double</span>')}` : ''}`,
      sub: c.smoked ? 'Smoked. It never goes bad.' : c.freshness <= 0 ? 'Gone bad' : `${Math.round(c.freshness)}% fresh`,
      extra: c.smoked ? '' : freshMeter(c.freshness),
      right: `${price(money(crateValue(s, c)))}${button({ label: 'Sell', act: 'sell', a: c.id, size: 'sm' })}`,
    });
  }).join('');
}

function prices(s: GameState): string {
  let h = '<table class="board"><tr><th></th><th>Fish</th><th>Fresh price</th><th>Price level</th></tr>';
  for (const sp of SPECIES) {
    if (s.book[sp].caught > 0) {
      const d = Math.round(s.demand[sp] * 100);
      h += `<tr><td>${fishIcon(hex(SPECIES_COLOUR[sp]), 16)}</td><td>${FISH_NAME[sp]}</td><td>$${Math.round(unitPrice(s, sp, 100))}</td><td class="${d < 90 ? 'bad' : 'good'}">${d}%</td></tr>`;
    } else {
      h += `<tr class="unknown"><td>${fishIcon('', 16, true)}</td><td>???</td><td>-</td><td>-</td></tr>`;
    }
  }
  return h + '</table>';
}

/** What selling everything in hand would earn, worked out on a copy of the state. */
function sellAllValue(s: GameState): number {
  const copy = structuredClone(s);
  sellAll(copy);
  return copy.money - s.money;
}

export const marketScreen: Screen = (ctx) => {
  const s = ctx.state;
  const tab = pickTab(ctx, TABS);
  const carrying = handCrates(s).length > 0;
  return {
    title: 'Fish Market',
    icon: icon('stall', 28),
    host: portrait(NPC_LOOK.fishmonger),
    tabs: TABS,
    tab,
    body: tab === 'sell' ? sell(s) : prices(s),
    foot: `<span class="dim">Fresh fish sell for more. Prices go down when you sell a lot. Fish that an order wants pay double.</span>${carrying ? button({ label: `Sell all ${icon('coin', 18)}${money(sellAllValue(s))}`, act: 'sellall' }) : ''}`,
  };
};
