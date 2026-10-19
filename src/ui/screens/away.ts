import { button, money } from '../components';
import { countedUp, wasCapped } from '../awayFlow';
import { icon } from '../icons';
import { AWAY } from '../text';
import type { Screen } from './types';

/** The window shown after Continue: how long the player was away and what the harbour earned (arg 0), or the one-time captain tip (arg 1). */
export const awayScreen: Screen = ({ away, arg, age = 0 }) => {
  const foot = `<span></span>${button({ label: AWAY.go, act: 'close', hero: true })}`;
  if (!away) return { title: AWAY.title, icon: icon('anchor', 28), body: `<p>${AWAY.note}</p>`, foot };
  const time = `<p class="away-line">${AWAY.away(away.seconds)}</p>`;
  if (arg === 1) {
    return {
      title: AWAY.title, icon: icon('anchor', 28),
      body: `${time}<div class="away-tip"><div class="ol warn">${AWAY.tipTitle}</div><p>${AWAY.tip}</p></div>`,
      foot,
    };
  }
  return {
    title: AWAY.title,
    icon: icon('anchor', 28),
    note: AWAY.note,
    body: `${time}<div class="away-hero"><div class="dim">${AWAY.earnedLabel}</div>
      <div class="away-money ol" data-count="${away.earned}">${icon('coin', 40)}+$${money(countedUp(away.earned, age))}</div></div>
      <p class="dim">${AWAY.rate(away.perMinute)}</p><p class="dim">${AWAY.workLine}</p>${wasCapped(away.seconds) ? `<p class="dim">${AWAY.capped}</p>` : ''}`,
    foot,
  };
};
