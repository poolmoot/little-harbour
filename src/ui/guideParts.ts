/** Pure builders for the guide cards and the help list, so they can be tested without a page. */
import { GUIDE_STEPS, UNLOCKS } from '../sim/guide';
import type { GuideTarget } from '../sim/guide';
import type { GameState } from '../sim/state';
import { icon } from './icons';
import type { GuideAdvice } from '../sim/guideAdvice';
import { meter, money } from './components';
import { ADVICE, GUIDE, STEP_TEXT, TRAIL_HINT, UNLOCK_TEXT } from './guideText';

/** Key for a card: 'step:send', 'unlock:workers' or 'welcome'. */
export type GuideKey = string;

export const keycaps = (keys: readonly string[]): string => `<span class="caps">${keys.map((k) => `<span class="kbd">${k}</span>`).join('')}</span>`;

/** The words for a step; while the step cannot be done yet, the advice replaces them. */
export function adviceLine(a: GuideAdvice): string {
  return `${ADVICE.cost(a.need!.cost)} ${ADVICE.how[a.how]}`;
}

export function stepCardHtml(index: number, advice: GuideAdvice | null = null): string {
  const st = GUIDE_STEPS[index];
  const t = STEP_TEXT[st.id];
  const line = advice ? adviceLine(advice) : t.line;
  const need = advice?.need ? meter(advice.need.have / advice.need.cost, 'gold', `$${money(advice.need.have)} / $${money(advice.need.cost)}`) : '';
  return `<div class="guide-head ol"><span>${GUIDE.stepLabel(index + 1, GUIDE_STEPS.length)}</span></div>
    <div class="guide-body">${keycaps(t.keys)}<div class="grow"><div class="guide-title ol">${t.title}</div><div class="guide-line">${line}</div>${need}</div></div>`;
}

export function unlockCardHtml(id: string, withClose = true): string {
  const t = UNLOCK_TEXT[id as keyof typeof UNLOCK_TEXT];
  if (!t) return '';
  return `<div class="guide-head ol"><span>${icon('star', 16)}${GUIDE.newLabel}</span>${withClose ? `<button class="guide-x ol" data-guide="close" aria-label="${GUIDE.close}">×</button>` : ''}</div>
    <div class="guide-body"><div class="grow"><div class="guide-title ol">${t.title}</div><div class="guide-line">${t.line}</div>${unlockTarget(id) ? `<div class="guide-hint">${TRAIL_HINT}</div>` : ''}</div></div>`;
}

export const unlockTarget = (id: string): GuideTarget | null => UNLOCKS.find((u) => u.id === id)?.target ?? null;

export interface HelpEntry { key: GuideKey; title: string; line: string; group: 'opening' | 'more' }

/** Everything the player has been told so far: the welcome, the steps reached, and the unlock cards shown. */
export function helpEntries(state: GameState): HelpEntry[] {
  const out: HelpEntry[] = [];
  const g = state.guide;
  if (g.welcomed) out.push({ key: 'welcome', title: GUIDE.welcomeEntry, line: GUIDE.welcome[0], group: 'opening' });
  GUIDE_STEPS.forEach((st, i) => {
    if (i <= g.step) out.push({ key: `step:${i}`, title: STEP_TEXT[st.id].title, line: STEP_TEXT[st.id].line, group: 'opening' });
  });
  for (const id of g.seen) {
    const t = UNLOCK_TEXT[id as keyof typeof UNLOCK_TEXT];
    if (t) out.push({ key: `unlock:${id}`, title: t.title, line: t.line, group: 'more' });
  }
  return out;
}
