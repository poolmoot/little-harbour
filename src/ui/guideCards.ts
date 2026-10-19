import { GUIDE_STEPS, guideDone } from '../sim/guide';
import type { GuideTarget } from '../sim/guide';
import type { GuideAdvice } from '../sim/guideAdvice';
import type { GameState } from '../sim/state';
import { adviceLine, stepCardHtml, unlockCardHtml, unlockTarget } from './guideParts';

/** How long an unlock card (or a replayed card) stays up before it closes by itself. */
const CARD_MS = 18000;
const SWAP_MS = 220;

/**
 * The little cards that slide in at the left of the screen: the current guide step, and one unlock card at a time.
 * A step card closes by itself when the step is finished (the sim moves on). Nothing here changes game state.
 */
export class GuideCards {
  readonly el = document.createElement('div');
  private stepEl = document.createElement('div');
  private cardEl = document.createElement('div');
  private stepKey = '';
  private stepHtml = '';
  private advice: GuideAdvice | null = null;
  private stepTimer = 0;
  private cardId: string | null = null;
  private cardUntil = 0;
  private queue: string[] = [];
  private replayStep: { index: number; until: number } | null = null;

  constructor(parent: HTMLElement) {
    this.el.className = 'guide-wrap';
    this.stepEl.className = 'pn guide-card step';
    this.cardEl.className = 'pn guide-card unlock';
    this.el.append(this.cardEl, this.stepEl);
    parent.prepend(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('[data-guide="close"]')) this.dismissCard();
    });
  }

  /** An unlock card is ready to show; it waits its turn. */
  push(id: string): void {
    if (!this.queue.includes(id) && this.cardId !== id) this.queue.push(id);
  }

  /** Show a card again from the help list. Key is 'step:3', 'unlock:workers'. */
  replay(key: string, nowMs: number): void {
    const [kind, id] = key.split(':');
    if (kind === 'step') this.replayStep = { index: Number(id), until: nowMs + CARD_MS };
    else if (kind === 'unlock') {
      this.queue = this.queue.filter((q) => q !== id);
      this.queue.unshift(id);
      this.cardUntil = 0; // swap out whatever card is up
    }
  }

  private dismissCard(): void {
    this.cardUntil = 0;
  }

  /** True while a step card (or a replayed one) is on screen, so the HUD can leave out the goal panel in the same place. */
  get stepShown(): boolean {
    return this.stepKey !== '';
  }

  /** Where the glowing trail should lead right now, or null for nowhere. */
  trailTarget(state: GameState): GuideTarget | null {
    if (this.cardId) return unlockTarget(this.cardId);
    if (this.replayStep) return GUIDE_STEPS[this.replayStep.index]?.target ?? null;
    if (this.advice) return this.advice.target;
    return guideDone(state) ? null : GUIDE_STEPS[state.guide.step].target;
  }

  /** Call every frame. `on` is false on the title screen, when paused, or when guide tips are switched off. */
  update(state: GameState, on: boolean, nowMs: number, advice: GuideAdvice | null = null): void {
    this.advice = this.replayStep ? null : advice;
    if (!on) {
      this.queue.length = 0;
      this.replayStep = null;
      this.cardUntil = 0;
    }
    if (this.replayStep && nowMs > this.replayStep.until) this.replayStep = null;

    // unlock card
    if (this.cardId && nowMs > this.cardUntil) {
      this.cardId = null;
      this.cardEl.classList.remove('in');
      this.cardEl.classList.add('out');
    }
    if (!this.cardId && on && this.queue.length) {
      this.cardId = this.queue.shift()!;
      this.cardUntil = nowMs + CARD_MS;
      this.cardEl.innerHTML = unlockCardHtml(this.cardId);
      this.cardEl.classList.remove('out');
      void this.cardEl.offsetWidth;
      this.cardEl.classList.add('in');
    }

    // step card
    const idx = !on ? -1 : this.replayStep ? this.replayStep.index : guideDone(state) ? -1 : state.guide.step;
    const adv = this.replayStep ? null : advice;
    const key = idx >= 0 ? `step:${idx}${adv ? `:${adviceLine(adv)}` : ''}` : '';
    const html = idx >= 0 ? stepCardHtml(idx, adv) : '';
    if (adv && key === this.stepKey && html !== this.stepHtml) {
      // Same advice, only the money moved: update the card in place so it does not flicker.
      this.stepHtml = html;
      this.stepEl.innerHTML = html;
    }
    if (key !== this.stepKey) {
      this.stepHtml = html;
      const had = this.stepKey !== '';
      this.stepKey = key;
      clearTimeout(this.stepTimer);
      this.stepEl.classList.remove('in');
      this.stepEl.classList.add('out');
      if (key) {
        this.stepTimer = window.setTimeout(() => {
          this.stepEl.innerHTML = html;
          this.stepEl.classList.remove('out');
          void this.stepEl.offsetWidth;
          this.stepEl.classList.add('in');
        }, had ? SWAP_MS : 0);
      }
    }
  }
}
