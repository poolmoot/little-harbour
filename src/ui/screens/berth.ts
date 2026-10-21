import { HOLD_SIZES } from '../../sim/config';
import type { GameState } from '../../sim/state';
import { NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import { boatOffer, nextSpot, offerButton, offerIcon } from '../boatOffer';
import { button, chip, esc, money, price } from '../components';
import { HULL_ICONS, icon } from '../icons';
import { BOAT_OFFER_TEXT } from '../screenText';
import { LABEL, boatType, crates } from '../text';
import type { Screen, ScreenView } from './types';

/** An empty boat spot with a boat already tied up: say so, and offer to open it. */
function taken(s: GameState, spot: number): ScreenView | null {
  const boat = s.boats.find((b) => b.berth === spot);
  if (!boat) return null;
  return {
    title: BOAT_OFFER_TEXT.title(spot + 1), icon: icon(HULL_ICONS[boat.hull], 28),
    body: `<div class="offer-hero">${icon(HULL_ICONS[boat.hull], 96)}<div class="offer-name ol">${esc(boat.name)}</div><div class="offer-spot">${boatType(boat.hull)}</div></div><p class="offer-text">${BOAT_OFFER_TEXT.taken(esc(boat.name))}</p>`,
    foot: `<span></span>${button({ label: `${LABEL.open} ${esc(boat.name)}`, act: 'openboat', a: boat.id, tone: 'info', size: 'lg' })}`,
  };
}

/** The window for an empty boat spot on the pier: the boat you would get, what it can do, its price and a big Buy button (or why it is locked). ctx.arg is the spot's place, from 0. */
export const berthScreen: Screen = (ctx) => {
  const s = ctx.state;
  const spot = ctx.arg;
  const had = taken(s, spot);
  if (had) return had;
  const o = boatOffer(s);
  const next = nextSpot(s);
  const chips = `<div class="chips" style="justify-content:center">${chip(`${icon('crate', 16)}${crates(HOLD_SIZES[0])}`)}</div>`;
  return {
    title: BOAT_OFFER_TEXT.title(spot + 1),
    icon: icon('anchor', 28),
    host: portrait(NPC_LOOK.shipwright),
    body: o.cost === null
      ? `<p class="offer-text">${BOAT_OFFER_TEXT.full}</p>`
      : `<div class="offer-hero">${offerIcon(104)}<div class="offer-name ol">${BOAT_OFFER_TEXT.name}</div><div class="offer-spot">${BOAT_OFFER_TEXT.spot(spot + 1)}</div><div>${price(money(o.cost))}</div>${chips}</div>`
        + `<p class="offer-text">${o.can}</p>${next !== spot ? `<p class="dim">${BOAT_OFFER_TEXT.otherSpot(next + 1)}</p>` : ''}${o.lock}`,
    foot: o.cost === null ? undefined : `<span></span>${offerButton(s, o, true)}`,
  };
};
