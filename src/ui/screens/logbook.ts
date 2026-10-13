import { BOOK_REWARD_CAUGHT, BOOK_REWARD_STARS, ZONE_IDS } from '../../sim/config';
import type { Species, ZoneId } from '../../sim/config';
import { bookCompletion, zoneFish } from '../../sim/fishbook';
import type { GameState } from '../../sim/state';
import { hex, SPECIES_COLOUR } from '../../palette';
import { card, cards, chip, item, meter, money, price, section, stars } from '../components';
import { GOLD_FISH } from '../fishParts';
import { fishIcon, icon } from '../icons';
import { FISH_BOOK, FISH_NAME, ZONE_NAME, sizeText } from '../text';
import type { Screen } from './types';

/** One fish: a card with its numbers, or a dark silhouette until it has been caught. */
export function fishCard(s: GameState, sp: Species): string {
  const r = s.book[sp];
  if (r.caught <= 0) return card({ tone: 'grey', art: fishIcon('', 34, true), lines: [FISH_BOOK.unseen], name: '???' });
  const golden = r.golden > 0;
  return card({
    tone: golden ? 'gold' : 'blue',
    art: fishIcon(golden ? GOLD_FISH : hex(SPECIES_COLOUR[sp]), 34),
    tag: golden ? FISH_BOOK.goldenName : undefined,
    lines: [
      `${FISH_BOOK.caught} ${r.caught}`,
      `${FISH_BOOK.biggest} ${sizeText(r.biggest)}`,
      stars(r.bestStars, 3, 13),
      `${FISH_BOOK.golden} ${r.golden}`,
      r.bestSale ? `${FISH_BOOK.bestSale} $${money(r.bestSale)}` : FISH_BOOK.notSold,
    ],
    name: FISH_NAME[sp],
  });
}

function rewardRow(done: boolean, title: string, sub: string, amount: number): string {
  return item({
    art: icon(done ? 'check' : 'coin', 26),
    title,
    sub,
    right: done ? chip(`<span class="good">${FISH_BOOK.zoneRewardEarned}</span>`) : price(`+${money(amount)}`),
  });
}

/** A sea zone: its two rewards (earned or still to earn) and its three fish. */
function zoneBlock(s: GameState, z: ZoneId): string {
  const fish = zoneFish(z);
  const seen = fish.filter((f) => s.book[f].caught > 0).length;
  const three = fish.filter((f) => s.book[f].bestStars >= 3).length;
  const claims = s.bookClaims[z];
  return section(ZONE_NAME[z])
    + rewardRow(claims.caught, FISH_BOOK.rewardCaughtRow, FISH_BOOK.zoneFound(seen, fish.length), BOOK_REWARD_CAUGHT[z])
    + rewardRow(claims.stars, FISH_BOOK.rewardStarsRow, FISH_BOOK.zoneStars(three, fish.length), BOOK_REWARD_STARS[z])
    + cards(fish.map((f) => fishCard(s, f)), 150);
}

export const logbookScreen: Screen = ({ state: s }) => {
  const c = bookCompletion(s);
  const overall = section(FISH_BOOK.overall) + `<div class="col-y">`
    + meter(c.seen / c.total, 'cyan', FISH_BOOK.seen(c.seen, c.total))
    + meter(c.threeStar / c.total, 'green', FISH_BOOK.threeStar(c.threeStar, c.total))
    + meter(c.golden / c.total, 'gold', FISH_BOOK.goldenFound(c.golden, c.total))
    + `</div>`;
  const body = overall + ZONE_IDS.map((z) => zoneBlock(s, z)).join('');
  return { title: 'Fish book', icon: icon('book', 28), note: `Fish you have not caught yet show as dark shapes. ${FISH_BOOK.starsHelp}`, body };
};
