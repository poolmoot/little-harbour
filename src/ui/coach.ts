import { GUIDE_STEPS, guideDone } from '../sim/guide';
import type { StepId } from '../sim/guide';
import type { GuideAdvice } from '../sim/guideAdvice';
import type { GameState } from '../sim/state';
import { GUIDE } from './guideText';
import type { PanelKind } from './panels';

/**
 * The pointers that go with the starting guide (the guide itself, its steps and its cards are in sim/guide.ts and guideCards.ts).
 * Once a window is open, a gold ring shows the button to press. When the place to go is off the edge of the screen, an arrow
 * at the screen edge points the way. The glowing ground trail (view/guideTrail.ts) does the rest.
 */

const EDGE_MARGIN = 56;
/** With a window open the words sit up here, under the top bar, so they never cover the window's own text. */
const TIP_Y = 100;

export interface Pt3 { x: number; y: number; z: number }
/** Screen position of a world point: x, y in CSS pixels, and whether it is in front of the camera. */
export type Project = (p: Pt3) => { x: number; y: number; front: boolean };

export interface Hint { text: string; press: string }

/** The button to ring in an open window for this step, or null when the step has no window button. */
export function hintFor(step: StepId, open: PanelKind | null, advice: GuideAdvice | null = null): Hint | null {
  // Never ring a purchase the player cannot afford; ring the way to earn instead.
  if (advice && (step === 'send' || step === 'space')) return open === 'market' && advice.how === 'carry' ? { text: GUIDE.pressSell, press: '[data-act="sell"], [data-act="sellall"]' } : null;
  switch (step) {
    case 'send': return open === 'boat' ? { text: GUIDE.pressSend, press: '[data-act="send"]' } : null;
    case 'sell': return open === 'market' ? { text: GUIDE.pressSell, press: '[data-act="sell"], [data-act="sellall"]' } : null;
    case 'space':
      if (open === 'boat') return { text: GUIDE.buySpace, press: '[data-act="up"][data-b="hold"]' };
      if (open === 'shipyard') return { text: GUIDE.openYourBoat, press: '[data-act="openboat"]' };
      return null;
    default: return null;
  }
}

export class Coach {
  private tip = document.createElement('div');
  private edge = document.createElement('div');
  private ring = document.createElement('div');
  private point = document.createElement('div');
  private lastText = '';

  constructor(root: HTMLElement) {
    this.tip.className = 'coach-tip';
    this.edge.className = 'coach-edge';
    this.ring.className = 'coach-ring';
    this.point.className = 'coach-point';
    this.point.innerHTML = '<div class="coach-arrow"></div>';
    this.edge.innerHTML = '<div class="coach-edge-arrow"></div>';
    root.append(this.tip, this.edge, this.ring, this.point);
    this.hideAll();
  }

  private hideAll(): void {
    for (const el of [this.tip, this.edge, this.ring, this.point]) el.style.display = 'none';
  }

  /** Call every frame. `on` is false on the title screen, when paused or when guide tips are off. `target` is the world point the trail leads to. */
  update(s: GameState, open: PanelKind | null, on: boolean, target: Pt3 | null, project: Project, advice: GuideAdvice | null = null): void {
    if (!on || guideDone(s)) { this.hideAll(); return; }
    const hint = hintFor(GUIDE_STEPS[s.guide.step].id, open, advice);
    // A greyed-out button is never ringed.
    const btn = hint ? [...document.querySelectorAll<HTMLElement>(hint.press.split(', ').map((q) => `.overlay.open ${q}`).join(', '))].find((b) => !b.classList.contains('off')) : null;
    if (hint && btn) {
      const r = btn.getBoundingClientRect();
      Object.assign(this.ring.style, { display: '', left: `${r.left - 8}px`, top: `${r.top - 8}px`, width: `${r.width + 16}px`, height: `${r.height + 16}px` });
      Object.assign(this.point.style, { display: '', left: `${r.left + r.width / 2}px`, top: `${r.top - 12}px` });
      this.place(hint.text, innerWidth / 2, TIP_Y);
      this.edge.style.display = 'none';
      return;
    }
    this.ring.style.display = this.point.style.display = 'none';
    this.tip.style.display = 'none';
    if (!target || open) { this.edge.style.display = 'none'; return; }
    const p = project(target);
    const inView = p.front && p.x > EDGE_MARGIN && p.x < innerWidth - EDGE_MARGIN && p.y > EDGE_MARGIN && p.y < innerHeight - EDGE_MARGIN;
    if (inView) { this.edge.style.display = 'none'; return; }
    // Off screen: an arrow at the screen edge points the way.
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let dx = p.x - cx, dy = p.y - cy;
    if (!p.front) { dx = -dx; dy = -dy; }
    const k = Math.min((cx - EDGE_MARGIN) / Math.max(1e-3, Math.abs(dx)), (cy - EDGE_MARGIN) / Math.max(1e-3, Math.abs(dy)));
    Object.assign(this.edge.style, { display: '', left: `${cx + dx * k}px`, top: `${cy + dy * k}px` });
    this.edge.style.setProperty('--angle', `${Math.atan2(dy, dx)}rad`);
  }

  /** The short instruction under the top bar. */
  private place(text: string, x: number, y: number): void {
    if (text !== this.lastText) {
      this.lastText = text;
      this.tip.innerHTML = `<div class="coach-text pn ol">${text}</div><div class="coach-arrow"></div>`;
      this.tip.classList.remove('pop');
      void this.tip.offsetWidth;
      this.tip.classList.add('pop');
    }
    this.tip.classList.remove('pointing');
    const w = this.tip.offsetWidth / 2;
    Object.assign(this.tip.style, { display: '', left: `${Math.min(innerWidth - w - 12, Math.max(w + 12, x))}px`, top: `${y}px` });
  }
}
