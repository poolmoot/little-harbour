import { SPECIES } from '../../sim/config';
import { handCrates } from '../../sim/crates';
import { crateValue, demandLoss, priceParts, sellAll, unitPrice } from '../../sim/market';
import type { Crate, GameState } from '../../sim/state';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, freshMeter, money } from '../components';
import { crateArt, crateFacts, crateTitle } from '../fishParts';
import { fishIcon, icon } from '../icons';
import { NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import { MARKET_TEXT as T } from '../screenText';
import { KING, FISH_NAME } from '../text';
import type { Screen } from './types';

/**
 * The market in two big boxes side by side: on the left the fish you are carrying, each with what it will fetch and its own
 * Sell button; on the right today's price for every fish you know, with how high its price is and whether an order wants it.
 */

const wantedSpecies = (s: GameState) => new Set(s.orders.filter((o) => o.filled < o.qty).map((o) => o.species));

function crateRow(s: GameState, c: Crate, wanted: boolean): string {
  if (c.king) {
    return `<div class="mk-row king"><div class="mk-art">${fishIcon(hex(SPECIES_COLOUR[c.species]), 40)}</div><div class="mk-main"><div class="mk-name ol">King Fish</div><div class="mk-sub">${KING.noSell}</div></div></div>`;
  }
  const state = c.smoked ? T.smoked : c.freshness <= 0 ? T.bad : T.fresh(Math.round(c.freshness));
  return `<div class="mk-row${c.golden ? ' gold' : ''}">
    <div class="mk-art">${crateArt(c, 40)}</div>
    <div class="mk-main">
      <div class="mk-name ol">${crateTitle(c)}</div>
      ${wanted ? `<div class="mk-badge ol">${T.wanted}</div>` : ''}
      <div class="mk-sub">${state}</div>
      <div class="mk-facts">${crateFacts(c)}</div>
      ${c.smoked ? '' : freshMeter(c.freshness)}
      ${c.freshness > 0 || c.smoked ? receipt(s, c) : ''}
    </div>
    <div class="mk-side"><div class="mk-price ol">${icon('coin', 24)}${money(crateValue(s, c))}</div>${button({ label: T.sell, act: 'sell', a: c.id, size: 'sm' })}</div>
  </div>`;
}

/** The price as plain money lines: normal price, then each plus or minus, then what you get. */
export function receipt(s: GameState, c: Crate): string {
  const lines = priceParts(s, c).map((p) => {
    const label = p.kind === 'size' ? (p.amount > 0 ? T.part.sizeUp : T.part.sizeDown) : T.part[p.kind];
    const amount = p.kind === 'base' ? `$${money(p.amount)}` : `${p.amount > 0 ? '+' : '−'}$${money(Math.abs(p.amount))}`;
    return `<div class="mk-line${p.kind === 'base' ? '' : p.amount > 0 ? ' up' : ' down'}"><span>${label}</span><span class="ol">${amount}</span></div>`;
  }).join('');
  return `<div class="mk-receipt">${lines}<div class="mk-line total"><span>${T.youGet}</span><span class="ol">$${money(crateValue(s, c))}</span></div></div>`;
}

function sellBox(s: GameState, total: number): string {
  const hand = handCrates(s), wanted = wantedSpecies(s);
  const head = `<header class="mk-head"><span class="ol">${icon('crate', 28)}${T.yourFish}</span>${hand.length ? `<span class="mk-count">${T.carrying(hand.length, total)}</span>` : ''}</header>`;
  if (!hand.length) {
    const steps = T.emptySteps.map((t, i) => `<li><span class="mk-step ol">${i + 1}</span>${t}</li>`).join('');
    return `<section class="mk-box">${head}<div class="mk-empty">${icon('crate', 64)}<div class="mk-name ol">${T.emptyTitle}</div><ol>${steps}</ol></div></section>`;
  }
  return `<section class="mk-box">${head}<div class="mk-list">${hand.map((c) => crateRow(s, c, wanted.has(c.species))).join('')}</div></section>`;
}

function priceBox(s: GameState): string {
  const wanted = wantedSpecies(s);
  const known = SPECIES.filter((sp) => s.book[sp].caught > 0);
  const unknown = SPECIES.length - known.length;
  const rows = known.map((sp) => {
    const normal = Math.round(unitPrice(s, sp, 100) + demandLoss(s, sp));
    const loss = demandLoss(s, sp);
    return `<div class="mk-row price-row${wanted.has(sp) ? ' wanted' : ''}">
      <div class="mk-art">${fishIcon(hex(SPECIES_COLOUR[sp]), 30)}</div>
      <div class="mk-main"><div class="mk-name ol">${FISH_NAME[sp]}</div>${wanted.has(sp) ? `<div class="mk-badge ol">${T.wanted}</div>` : ''}
        <div class="mk-sub${loss > 0 ? ' down' : ''}">${loss > 0 ? T.down(normal, loss) : T.normalOnly(normal)}</div></div>
      <div class="mk-side"><div class="mk-today">${T.today}</div><div class="mk-price ol">${icon('coin', 22)}${money(unitPrice(s, sp, 100))}</div></div>
    </div>`;
  }).join('');
  const more = unknown ? `<div class="mk-unknown">${fishIcon('', 22, true)}<span>${unknown} × ${T.unknown}</span></div>` : '';
  return `<section class="mk-box"><header class="mk-head"><span class="ol">${icon('coin', 28)}${T.prices}</span></header><p class="mk-note">${T.pricesNote}</p><div class="mk-list">${rows}${more}</div></section>`;
}

/** What selling everything in hand would earn, worked out on a copy of the state. */
function sellAllValue(s: GameState): number {
  const copy = structuredClone(s);
  sellAll(copy);
  return copy.money - s.money;
}

/** The big first-time message: shown until the first fish is sold. */
const hello = (): string => `<div class="mk-hello"><div class="mk-hello-art">${icon('coin', 56)}</div><div><div class="mk-hello-title ol">${T.helloTitle}</div><div class="mk-hello-line">${T.helloLine}</div></div></div>`;

export const marketScreen: Screen = (ctx) => {
  const s = ctx.state;
  const carrying = handCrates(s).some((c) => !c.king);
  const total = carrying ? sellAllValue(s) : 0;
  return {
    title: T.title,
    icon: icon('stall', 28),
    host: portrait(NPC_LOOK.fishmonger),
    body: `${s.tally.sold === 0 ? hello() : ''}<div class="mk">${sellBox(s, total)}${priceBox(s)}</div>`,
    foot: `<span class="dim">${T.tip}</span>${carrying ? button({ label: `${T.sellAll} ${icon('coin', 22)}${money(total)}`, act: 'sellall', hero: true }) : ''}`,
  };
};
