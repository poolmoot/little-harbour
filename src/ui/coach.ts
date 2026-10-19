import { LAYOUT } from '../sim/config';
import { handCrates } from '../sim/crates';
import { tripCostFor, trackCost } from '../sim/fleet';
import { GUIDE_STEPS, guideDone } from '../sim/guide';
import type { StepId } from '../sim/guide';
import { isNight } from '../sim/time';
import type { GameState } from '../sim/state';
import type { PanelKind } from './panels';
import { meter, money } from './components';
import { TUTORIAL as T } from './tutorialText';

/**
 * The first-time tutorial, drawn over the starting guide in src/sim/guide.ts (the rules decide the step; this only shows
 * it). For each step it shows where to go (a bubble with a bouncing arrow over the
 * spot, or an arrow at the screen edge when the spot is out of view) and, once a window is open, rings the button to press.
 */

const OFF_KEY = 'harbour-tutorial-off';
/** Within this distance of a spot, the instruction changes from "walk there" to "press E". */
const NEAR = 2.6;
/** How long the closing "well done" stays up. */
const DONE_MS = 4000;
const EDGE_MARGIN = 56;

export interface Pt3 { x: number; y: number; z: number }
/** Screen position of a world point: x, y in CSS pixels, and whether it is in front of the camera. */
export type Project = (p: Pt3) => { x: number; y: number; front: boolean };

/** What to show: the instruction, the spot in the world to point at, and the button to ring once a window is open. */
export interface Hint { text: string; at?: Pt3; press?: string; need?: { have: number; cost: number } }

const pt = (x: number, z: number, y = 1.6): Pt3 => ({ x, y, z });
const BOAT = LAYOUT.berths[0];
const BOAT_SPOT = pt(BOAT.edgeX, BOAT.edgeZ);
const PIER_END = pt(LAYOUT.fishingSpot.x, LAYOUT.fishingSpot.z, 1.4);
const MARKET = pt(LAYOUT.market.x, LAYOUT.market.z + 2.4, 2.2);

/**
 * How to earn money right now, used whenever the next step costs more than the player has: unload a waiting boat, carry
 * fish to the market, send the boat out again, or fish from the pier while it is away (or at night).
 */
function earnMore(s: GameState, open: PanelKind | null, px: number, pz: number): Hint {
  const boat = s.boats[0];
  if (open === 'market') return { text: T.pressSell, press: '[data-act="sell"], [data-act="sellall"]' };
  if (handCrates(s).length) return { text: T.toMarket, at: MARKET };
  const crate = s.crates.find((c) => c.loc === 'dock');
  if (crate) return { text: T.pickUp, at: pt(crate.x ?? 0, crate.z ?? 0, 1.2) };
  if (boat?.status === 'returned') return { text: Math.hypot(BOAT_SPOT.x - px, BOAT_SPOT.z - pz) < NEAR ? T.unload : T.walkToUnload, at: BOAT_SPOT };
  if (boat?.status === 'docked' && !isNight(s) && s.money >= tripCostFor(boat.target)) {
    if (open === 'boat') return { text: T.pressSend, press: '[data-act="send"]' };
    return { text: T.sendAgain, at: BOAT_SPOT };
  }
  return pierFishing(s);
}

function pierFishing(s: GameState): Hint {
  if (s.fishing.phase === 'bite') return { text: T.pullNow };
  if (s.fishing.phase === 'waiting') return { text: T.waitBite };
  return { text: T.toPierEnd, at: PIER_END };
}

/** What to tell the player right now for a step of the starting guide. */
export function hintFor(step: StepId, s: GameState, open: PanelKind | null, px: number, pz: number): Hint {
  const near = (p: Pt3) => Math.hypot(p.x - px, p.z - pz) < NEAR;
  const boat = s.boats[0];
  switch (step) {
    case 'walk':
      return { text: T.walk, at: BOAT_SPOT };
    case 'send': {
      // Sending costs a little and only works by day; if either is missing, fish from the pier meanwhile.
      if (isNight(s)) return { ...pierFishing(s), text: s.fishing.phase === 'idle' ? T.nightPier : pierFishing(s).text };
      const cost = boat ? tripCostFor(boat.target) : 0;
      if (s.money < cost) return { ...pierFishing(s), need: { have: s.money, cost } };
      if (open === 'boat') return { text: T.pressSend, press: '[data-act="send"]' };
      return { text: near(BOAT_SPOT) ? T.openBoat : T.walkToBoat, at: BOAT_SPOT };
    }
    case 'pier':
      return pierFishing(s);
    case 'unload':
      if (boat?.status === 'out') return { text: T.boatAway(Math.max(0, Math.ceil(boat.tripTime - boat.progress))), at: BOAT_SPOT };
      return { text: near(BOAT_SPOT) ? T.unload : T.walkToUnload, at: BOAT_SPOT };
    case 'carry': {
      const crate = s.crates.find((c) => c.loc === 'dock');
      return crate ? { text: T.pickUp, at: pt(crate.x ?? 0, crate.z ?? 0, 1.2) } : { text: T.toMarket, at: MARKET };
    }
    case 'sell':
      if (open === 'market') return { text: T.pressSell, press: '[data-act="sell"], [data-act="sellall"]' };
      return handCrates(s).length ? { text: T.toMarket, at: MARKET } : earnMore(s, open, px, pz);
    case 'space': {
      // Crate space costs more than a first trip earns: until it is affordable, show how far off it is and how to earn it.
      const cost = boat ? trackCost(boat, 'hold') : null;
      if (boat && cost !== null && s.money < cost) {
        const how = earnMore(s, open, px, pz);
        return { ...how, text: `${T.saveUp(cost)} ${how.text}`, need: { have: s.money, cost } };
      }
      if (open === 'boat') return { text: T.buySpace, press: '[data-act="up"][data-b="hold"]' };
      if (open === 'shipyard') return { text: T.openYourBoat, press: '[data-act="openboat"]' };
      return { text: T.toShipyard, at: pt(LAYOUT.shipyard.x, LAYOUT.shipyard.z + 3, 3) };
    }
    case 'board':
      return { text: T.toBoard, at: pt(LAYOUT.noticeBoard.x, LAYOUT.noticeBoard.z, 2.4) };
  }
}

function stored(): boolean {
  try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
}

export class Coach {
  private bar = document.createElement('div');
  private tip = document.createElement('div');
  private edge = document.createElement('div');
  private ring = document.createElement('div');
  private point = document.createElement('div');
  private off = stored();
  private lastStep = -1;
  private doneUntil = 0;
  private lastText = '';

  constructor(root: HTMLElement) {
    this.bar.className = 'coach-bar pn';
    this.tip.className = 'coach-tip';
    this.edge.className = 'coach-edge';
    this.ring.className = 'coach-ring';
    this.point.className = 'coach-point';
    this.point.innerHTML = '<div class="coach-arrow"></div>';
    this.edge.innerHTML = '<div class="coach-edge-arrow"></div>';
    root.append(this.tip, this.edge, this.ring, this.point, this.bar);
    this.bar.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('[data-skip]')) return;
      this.off = true;
      try { localStorage.setItem(OFF_KEY, '1'); } catch { /* it will show again next time */ }
      this.hideAll();
    });
    this.hideAll();
  }

  private hideAll(): void {
    for (const el of [this.bar, this.tip, this.edge, this.ring, this.point]) el.style.display = 'none';
  }

  /** Call every frame while playing. `open` is the window currently open, if any. */
  update(s: GameState, open: PanelKind | null, px: number, pz: number, project: Project, playing: boolean): void {
    const index = guideDone(s) ? -1 : s.guide.step;
    const now = performance.now();
    if (this.lastStep >= 0 && index < 0) this.doneUntil = now + DONE_MS;
    this.lastStep = index;
    if (this.off || !playing || (index < 0 && now > this.doneUntil)) { this.hideAll(); return; }

    const hint: Hint = index < 0 ? { text: T.done } : hintFor(GUIDE_STEPS[index].id, s, open, px, pz);
    this.bar.style.display = '';
    const need = hint.need ? `<div class="coach-need">${meter(hint.need.have / hint.need.cost, 'gold', `$${money(hint.need.have)} / $${money(hint.need.cost)}`)}</div>` : '';
    const barHtml = `<span class="ol warn">${T.title}</span><span class="ol">${index < 0 ? '' : T.step(index + 1, GUIDE_STEPS.length)}</span><button class="btn ghost sm ol" data-skip>${T.skip}</button>${need}`;
    if (this.bar.dataset.h !== barHtml) { this.bar.dataset.h = barHtml; this.bar.innerHTML = barHtml; }
    const below = this.bar.getBoundingClientRect().bottom + 10;

    // A button to press inside an open window: ring it with an arrow, and put the words under the top bar so they never
    // cover the window's text. A greyed-out button is never ringed.
    const btn = hint.press ? [...document.querySelectorAll<HTMLElement>(hint.press.split(', ').map((q) => `.overlay.open ${q}`).join(', '))].find((b) => !b.classList.contains('off')) : null;
    if (btn) {
      const r = btn.getBoundingClientRect();
      Object.assign(this.ring.style, { display: '', left: `${r.left - 8}px`, top: `${r.top - 8}px`, width: `${r.width + 16}px`, height: `${r.height + 16}px` });
      Object.assign(this.point.style, { display: '', left: `${r.left + r.width / 2}px`, top: `${r.top - 12}px` });
      this.edge.style.display = 'none';
      this.place(hint.text, innerWidth / 2, below, false);
      return;
    }
    this.ring.style.display = this.point.style.display = 'none';
    if (!hint.at || open) {
      // No spot in the world (or a window covers it): show the instruction under the top bar.
      this.edge.style.display = 'none';
      this.place(hint.text, innerWidth / 2, below, false);
      return;
    }
    const p = project(hint.at);
    const inView = p.front && p.x > EDGE_MARGIN && p.x < innerWidth - EDGE_MARGIN && p.y > EDGE_MARGIN && p.y < innerHeight - EDGE_MARGIN;
    if (inView) {
      this.edge.style.display = 'none';
      this.place(hint.text, p.x, p.y, true);
      return;
    }
    // Off screen: an arrow at the screen edge points the way, with the instruction beside it.
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let dx = p.x - cx, dy = p.y - cy;
    if (!p.front) { dx = -dx; dy = -dy; }
    const k = Math.min((cx - EDGE_MARGIN) / Math.max(1e-3, Math.abs(dx)), (cy - EDGE_MARGIN) / Math.max(1e-3, Math.abs(dy)));
    const ex = cx + dx * k, ey = cy + dy * k;
    Object.assign(this.edge.style, { display: '', left: `${ex}px`, top: `${ey}px` });
    this.edge.style.setProperty('--angle', `${Math.atan2(dy, dx)}rad`);
    this.place(hint.text, ex - dx * 0.12 * k, ey - dy * 0.12 * k + 40, false);
  }

  /** Put the instruction bubble at a screen point; with `arrow` it sits above the point with an arrow bouncing down at it. */
  private place(text: string, x: number, y: number, arrow: boolean): void {
    if (text !== this.lastText) {
      this.lastText = text;
      this.tip.innerHTML = `<div class="coach-text pn ol">${text}</div><div class="coach-arrow"></div>`;
      this.tip.classList.remove('pop');
      void this.tip.offsetWidth;
      this.tip.classList.add('pop');
    }
    this.tip.classList.toggle('pointing', arrow);
    const w = this.tip.offsetWidth / 2;
    Object.assign(this.tip.style, { display: '', left: `${Math.min(innerWidth - w - 12, Math.max(w + 12, x))}px`, top: `${Math.max(90, y)}px` });
  }
}

