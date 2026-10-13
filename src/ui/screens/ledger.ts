import { SPECIES } from '../../sim/config';
import { netProfit } from '../../sim/ledger';
import { rankOf, rankProgress } from '../../sim/rank';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, empty, meter, money, section, stat } from '../components';
import { fishIcon, icon } from '../icons';
import { FISH_NAME, LABEL, RANK_NAME, RANK_UNLOCKS } from '../text';
import type { Screen } from './types';

/** End-of-day summary shown at 06:00. */
export const ledgerScreen: Screen = ({ state: s, summary }) => {
  const ic = icon('ledger', 28);
  if (!summary) return { title: 'Day report', icon: ic, body: empty('No day to report yet.') };
  const st = summary.stats;
  const net = netProfit(st);
  const sales = SPECIES.filter((sp) => st.income[sp] > 0)
    .map((sp) => stat(`<span class="row-x">${fishIcon(hex(SPECIES_COLOUR[sp]), 14)}${FISH_NAME[sp]}</span>`, `+$${money(st.income[sp])}`))
    .join('');
  const rp = rankProgress(s);
  const rank = rankOf(s);
  const body = section(LABEL.moneyIn) + (sales || stat('No sales', '$0'))
    + stat(`Order bonuses (${st.filled} done, ${st.missed} late)`, `+$${money(st.bonus)}`)
    + section(LABEL.moneyOut) + stat('Pay for workers and captains', `-$${money(st.wages)}`) + stat('Trip costs', `-$${money(st.tripCosts)}`)
    + stat('Upgrades and boats', `-$${money(st.spent)}`) + stat('Crates that went bad', `${st.spoiled}`)
    + stat('Profit for the day', `<span class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : '-'}$${money(Math.abs(net))}</span>`, true)
    + stat('Best sale', st.best.species ? `${FISH_NAME[st.best.species]} $${money(st.best.price)}` : '-')
    + section(`${LABEL.rank}: ${RANK_NAME[rank]}`)
    + (rp
      ? `${meter(rp.frac, 'gold', `$${money(rp.have)} / $${money(rp.need)}`)}<p class="dim" style="margin-top:6px">Next rank: ${RANK_NAME[rp.next]}. New then: ${RANK_UNLOCKS[rp.next]}.</p>`
      : '<p class="dim">You are at the top rank. The weathervane is gold.</p>');
  return {
    title: `Day ${summary.day}: day report`,
    icon: ic,
    note: '06:00. A new day starts.',
    body,
    foot: `<span></span>${button({ label: 'Start the day', act: 'close' })}`,
  };
};
