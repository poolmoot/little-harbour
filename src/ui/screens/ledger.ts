import { SPECIES } from '../../sim/config';
import type { GameState } from '../../sim/state';
import { netProfit } from '../../sim/ledger';
import { rankOf, rankProgress } from '../../sim/rank';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, empty, meter, money, section, stat } from '../components';
import { fishIcon, icon } from '../icons';
import { REPORT_TEXT, WEATHER_ICON } from '../screenText';
import { AWAY, FISH_NAME, LABEL, RANK_NAME, RANK_UNLOCKS, WEATHER, specialDesc, specialName } from '../text';
import type { Screen } from './types';

/** Tomorrow's weather and special day, from the forecast the new day has just rolled. */
export function forecast(s: GameState): string {
  const sp = s.nextSpecial;
  return section(REPORT_TEXT.tomorrow)
    + `<div class="row-x">${icon(WEATHER_ICON[s.nextWeather], 26)}<span class="ol">${WEATHER[s.nextWeather].name}</span></div><p class="dim">${WEATHER[s.nextWeather].desc}</p>`
    + (sp ? `<p><span class="ol warn">${specialName(sp)}</span> <span class="dim">${specialDesc(sp)}</span></p>` : '')
    + (s.nextWeather === 'storm' ? `<p class="warn">${REPORT_TEXT.stormSoon}</p>` : '');
}

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
  const body = forecast(s) + section(LABEL.moneyIn) + (sales || stat('No sales', '$0'))
    + stat(`Order bonuses (${st.filled} done, ${st.missed} late)`, `+$${money(st.bonus)}`)
    + (st.rewards > 0 ? stat(REPORT_TEXT.rewards, `+$${money(st.rewards)}`) : '')
    + (st.away > 0 ? stat(AWAY.statsLine, `+$${money(st.away)}`) : '')
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
    note: `06:00. A new day starts. ${REPORT_TEXT.today}: ${WEATHER[s.weather].name}${s.special ? ` · ${specialName(s.special)}` : ''}.`,
    body,
    foot: `<span></span>${button({ label: 'Start the day', act: 'close', hero: true })}`,
  };
};
