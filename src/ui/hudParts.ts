/** Pure builders for the new HUD pieces (goal tracker, weather chip, money per minute), so they can be tested without a page. */
import { GOALS } from '../sim/config';
import { currentGoal, moneyPerMinute } from '../sim/sim';
import type { GameState } from '../sim/state';
import { meter, money } from './components';
import { icon } from './icons';
import { HUD_TEXT, WEATHER_ICON } from './screenText';
import { GOAL_LABEL, GOAL_TEXT, WEATHER, goalCount, perMinute, specialName } from './text';

const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The goal panel: which goal, its line, progress when it has a count, and the reward. */
export function goalHtml(state: GameState): string {
  const g = currentGoal(state);
  if (!g) return `<div class="hud-goal-head ol"><span>${GOAL_LABEL.done}</span></div><div class="hud-goal-text">${GOAL_LABEL.all}</div>`;
  const bar = g.need > 1 ? meter(g.have / g.need, 'cyan', goalCount(g.have, g.need)) : '';
  return `<div class="hud-goal-head ol"><span>${HUD_TEXT.goalNumber(g.index + 1, GOALS.length)}</span><span class="hud-goal-reward" title="${HUD_TEXT.reward}">${icon('coin', 16)}+${money(g.reward)}</span></div>
    <div class="hud-goal-text">${GOAL_TEXT[g.id] ?? ''}</div>${bar}`;
}

/** The brief "goal done" panel shown for a moment after a goal is finished. */
export const goalDoneHtml = (reward: number): string =>
  `<div class="hud-goal-head ol"><span>${icon('check', 20)}${HUD_TEXT.goalDone(reward)}</span></div>`;

/** The weather chip: today (with a special day), tomorrow on a small second line, the full story as a tooltip. */
export function weatherHtml(state: GameState): { html: string; tip: string } {
  const today = `${WEATHER[state.weather].name}${state.special ? ` · ${specialName(state.special)}` : ''}`;
  return {
    html: `${icon(WEATHER_ICON[state.weather], 30)}<span class="hud-weather-text"><span class="ol">${today}</span><small class="ol">${HUD_TEXT.tomorrow(state.nextWeather, state.nextSpecial)}</small></span>`,
    tip: esc(HUD_TEXT.weatherTip(state.weather, state.special, state.nextWeather, state.nextSpecial)),
  };
}

/** "$40 a minute", or nothing before any money has come in. */
export function rateHtml(state: GameState): string {
  const n = moneyPerMinute(state);
  return n >= 1 ? `<span class="hud-rate" title="${esc(HUD_TEXT.rateTip)}">${perMinute(n)}</span>` : '';
}
