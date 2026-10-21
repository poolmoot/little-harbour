/** The boat you would get from "Buy a new boat": one description, shared by the shipyard page and the boat spot window. */
import { HOLD_SIZES, ZONES, ZONE_IDS } from '../sim/config';
import { canBuyBoat } from '../sim/fleet';
import { rankOf } from '../sim/rank';
import type { GameState } from '../sim/state';
import { button, buyLabel, lockNote } from './components';
import { HULL_ICONS, icon } from './icons';
import { BOAT_OFFER_TEXT, LOCK_TEXT } from './screenText';
import { ZONE_NAME } from './text';

export interface BoatOffer {
  /** Null when every boat spot is used. */
  cost: number | null;
  ok: boolean;
  /** The boat spot (1 to 4) the new boat takes. */
  spot: number;
  /** What the boat can do, in plain words. */
  can: string;
  /** The padlock note, empty when the boat can be bought or all spots are used. */
  lock: string;
}

/** The lowest empty boat spot, as a place from 0 (the same rule the sim uses when it buys). */
export function nextSpot(s: GameState): number {
  let n = 0;
  while (s.boats.some((b) => b.berth === n)) n++;
  return n;
}

export function boatOffer(s: GameState): BoatOffer {
  const chk = canBuyBoat(s);
  const zone = ZONE_IDS[0];
  const can = `${BOAT_OFFER_TEXT.can(HOLD_SIZES[0], ZONE_NAME[zone], ZONES[zone].trip)} ${BOAT_OFFER_TEXT.later}`;
  const lock = chk.ok || chk.cost === null ? '' : lockNote({ cost: chk.cost, money: s.money, rank: rankOf(s), needRank: chk.needRank, reason: chk.reason });
  return { cost: chk.cost, ok: chk.ok, spot: nextSpot(s) + 1, can, lock };
}

/** The Buy button for the offer. A locked one says Locked (rank) or keeps the price (money) and stays greyed out. */
export function offerButton(s: GameState, o: BoatOffer, hero = false): string {
  if (o.cost === null) return button({ label: BOAT_OFFER_TEXT.full, tone: 'ghost', off: true });
  const rankLocked = !o.ok && canBuyBoat(s).needRank !== undefined;
  const label = rankLocked ? `${icon('lock', 20)}${LOCK_TEXT.locked}` : buyLabel(BOAT_OFFER_TEXT.buyShort, o.cost);
  return button({ label, act: 'buyboat', off: !o.ok, hero: hero && o.ok, size: hero ? undefined : 'sm' });
}

export const offerIcon = (size: number): string => icon(HULL_ICONS[0], size);
