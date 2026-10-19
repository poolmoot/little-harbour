import { trackUiScale } from './uiScale';
import { HOUR_SECONDS } from '../sim/config';
import { carryCapacity, handCrates } from '../sim/crates';
import { holdSize } from '../sim/fleet';
import { rankOf, rankProgress } from '../sim/rank';
import type { Boat, Crate, GameState, Order } from '../sim/state';
import { formatClock, isNight, phaseOf } from '../sim/time';
import { hex, SPECIES_COLOUR } from '../palette';
import { esc, meter, money, stars } from './components';
import { crateArt, crateTitle } from './fishParts';
import { crateSize, crateStars } from '../sim/fishbook';
import { fishIcon, HULL_ICONS, icon } from './icons';
import { goalDoneHtml, goalHtml, rateHtml, weatherHtml } from './hudParts';
import { HUD_TEXT } from './screenText';
import { HINTS } from './menuText';
import type { PanelKind } from './panels';
import { FISH_NAME, LABEL, PHASE_NAME, RANK_NAME, boatType, crates, sizeText, starText } from './text';

/** Orders with less than this many seconds left are flagged as urgent. */
const URGENT_SECONDS = 15;
/** Seconds of deadline that fill an order's meter. */
const ORDER_METER_SECONDS = 60;
const TOAST_MS = 3400;
const TOAST_FADE_MS = 400;
/** How long a HUD panel's attention flash lasts (matches hud-flash in scale.css). */
const FLASH_MS = 1400;
const MAX_TOASTS = 4;
/** How long the "goal done" panel stays before the next goal is shown. */
const GOAL_DONE_MS = 1800;
/** The money counter and prompt follow every frame; the other panels change slowly and are rebuilt about 8 times a second. */
const SLOW_REFRESH_MS = 120;

/** Replace an element's HTML only when it changed, so animations and hover states survive idle frames. */
function set(el: HTMLElement, html: string): void {
  if (el.dataset.h !== html) {
    el.dataset.h = html;
    el.innerHTML = html;
  }
}

function div(cls: string, parent?: HTMLElement): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  parent?.appendChild(d);
  return d;
}

export interface Prompt {
  text: string;
  key: boolean;
  hot?: boolean;
  dim?: boolean;
}

function orderRow(state: GameState, o: Order): string {
  const left = Math.max(0, o.deadline - state.clock);
  const by = formatClock((state.dayTime + left) % (HOUR_SECONDS * 24));
  const frac = left / ORDER_METER_SECONDS;
  return `<div class="hud-orders-row${left < URGENT_SECONDS ? ' urgent' : ''}">${fishIcon(hex(SPECIES_COLOUR[o.species]), 18)}<div class="grow">
    <div class="hud-orders-text ol">${o.name} · ${o.filled}/${o.qty} ${FISH_NAME[o.species]}</div>
    ${meter(frac, frac > 0.6 ? 'green' : frac > 0.3 ? 'amber' : 'red')}<div class="dim">by ${by} · ${Math.ceil(left)}s</div></div></div>`;
}

/** One carry slot: the fish picture, its stars, and how fresh it is. Golden fish shine. */
export function slotHtml(c: Crate): string {
  const label = c.king ? HUD_TEXT.carryKing : c.smoked ? HUD_TEXT.carrySmoked : `${Math.round(c.freshness)}%`;
  const tip = c.king ? crateTitle(c) : `${crateTitle(c)}, ${sizeText(crateSize(c))}, ${starText(crateStars(c))}`;
  return `<div class="slot full ol${c.golden ? ' golden' : ''}" title="${esc(tip)}">${crateArt(c, 18)}${c.king ? '' : stars(crateStars(c), 3, 9)}${label}</div>`;
}

function boatCard(b: Boat): string {
  const art = icon(HULL_ICONS[b.hull], 28);
  const name = `${esc(b.name)}${b.captain && !b.captain.unpaid ? ` ${icon('anchor', 12)}` : ''}`;
  const title = `${boatType(b.hull)}, carries ${crates(holdSize(b))}`;
  if (b.status === 'returned') return `<div class="pn hud-boat back" title="${title}">${art}<div class="grow"><div class="ol">${name}</div><div class="ol">Back! Unload ${b.catch.length}</div></div></div>`;
  if (b.status === 'out') {
    const left = Math.max(0, Math.ceil(b.tripTime - b.progress));
    return `<div class="pn hud-boat" title="${title}">${art}<div class="grow"><div class="ol">${name} · ${left}s</div>${meter(b.progress / b.tripTime, 'cyan')}</div></div>`;
  }
  return `<div class="pn hud-boat" title="${title}">${art}<div class="grow"><div class="ol">${name}</div><div class="dim">At the pier</div></div></div>`;
}

/** The always-on overlay: rank, clock, money, orders, fleet status, hands, prompt, toasts. */
export class Hud {
  private rank: HTMLDivElement;
  private clock: HTMLDivElement;
  private money: HTMLDivElement;
  private goal: HTMLDivElement;
  private weather: HTMLDivElement;
  private orders: HTMLDivElement;
  private tiles: HTMLDivElement;
  private boats: HTMLDivElement;
  private carry: HTMLDivElement;
  private prompt: HTMLDivElement;
  private toasts: HTMLDivElement;
  private shownMoney = -1;
  private lastTick = performance.now();
  private lastSlow = -1000;
  /** What each flashing panel last showed, so it only flashes on a real change. */
  private seen = new Map<HTMLElement, string>();
  /** After a goal is finished the panel shows "Goal done" for a moment before the next goal appears. */
  private goalDoneUntil = 0;
  private goalDoneReward = 0;

  constructor(private root: HTMLElement, onOpen: (kind: PanelKind) => void) {
    trackUiScale();
    this.rank = div('hud-tl', root);
    const tr = div('hud-tr', root);
    this.clock = div('well pill hud-clock ol', tr);
    this.weather = div('well pill hud-weather', tr);
    this.money = div('well pill hud-money ol', tr);
    const left = div('hud-left', root);
    this.goal = div('pn hud-goal', left);
    this.orders = div('pn hud-orders', left);
    const right = div('hud-right', root);
    this.tiles = div('hud-tiles', right);
    this.boats = div('hud-boats', right);
    const bl = div('hud-bl', root);
    this.carry = div('', bl);
    div('hud-hints ol', bl).textContent = HINTS;
    this.prompt = div('prompt', root);
    this.toasts = div('toasts', root);
    this.tiles.addEventListener('pointerdown', (e) => {
      const kind = ((e.target as HTMLElement).closest('[data-open]') as HTMLElement | null)?.dataset.open;
      if (kind) onOpen(kind as PanelKind);
    });
  }

  update(state: GameState, prompt: Prompt | null): void {
    this.updateMoney(state);
    set(this.prompt, prompt
      ? `<div class="btn lg ol${prompt.hot ? ' gold hot' : ''}${prompt.dim ? ' ghost dim' : ''}">${prompt.key ? '<span class="kbd">E</span>' : ''}<span>${prompt.text}</span></div>`
      : '');
    const now = performance.now();
    if (now - this.lastSlow < SLOW_REFRESH_MS) return;
    this.lastSlow = now;
    set(this.clock, `${formatClock(state.dayTime)} · ${PHASE_NAME[phaseOf(state.dayTime)]}${icon(isNight(state) ? 'moon' : 'sun', 34)}`);

    const w = weatherHtml(state);
    set(this.weather, w.html);
    this.weather.title = w.tip.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    const done = now < this.goalDoneUntil;
    this.goal.classList.toggle('done', done);
    set(this.goal, done ? goalDoneHtml(this.goalDoneReward) : goalHtml(state));
    this.notice(this.goal, `goal${state.goal}`);

    const rp = rankProgress(state);
    set(this.rank, `<div class="hud-shield">${icon('shield', 48)}<span class="ol">${rankOf(state) + 1}</span></div>
      <div class="hud-rank"><div class="hud-harbour ol">${esc(state.harbourName)}</div><div class="hud-rank-name ol">${RANK_NAME[rankOf(state)]} · Day ${state.day}</div>${meter(rp?.frac ?? 1, 'cyan', rp ? `$${money(rp.have)} / $${money(rp.need)}` : LABEL.topRank)}</div>`);

    set(this.orders, `<div class="pn-head"><span class="ol warn">Orders</span><span class="ol">${state.orders.length}</span></div>${
      state.orders.length ? state.orders.map((o) => orderRow(state, o)).join('') : '<div class="hud-orders-row dim">No orders right now.</div>'}`);

    set(this.tiles, `<button class="tile ol" data-open="board">${icon('note', 30)}Orders${state.orders.length ? `<span class="dot">${state.orders.length}</span>` : ''}</button>
      <button class="tile ol" data-open="logbook">${icon('book', 30)}Fish book</button>`);
    set(this.boats, state.boats.map(boatCard).join(''));
    this.notice(this.boats, `back${state.boats.filter((b) => b.status === 'returned').length}`, true);
    this.notice(this.orders, `orders${state.orders.map((o) => o.id).join(',')}`, state.orders.length > 0);

    const hand = handCrates(state);
    const cap = carryCapacity(state);
    let slots = '';
    for (let i = 0; i < cap; i++) {
      const c = hand[i];
      slots += c ? slotHtml(c) : '<div class="slot empty">+</div>';
    }
    set(this.carry, `<div class="ol">Carrying ${hand.length} / ${cap}</div><div class="hud-slots">${slots}</div>`);
  }

  /** Flash a HUD panel when what it shows changes in a way the player should act on (a new goal, order or returned boat). */
  private notice(el: HTMLElement, key: string, worth = true): void {
    const last = this.seen.get(el);
    this.seen.set(el, key);
    if (last === undefined || last === key || !worth) return;
    el.classList.remove('flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), FLASH_MS);
  }

  /** The counter ticks up (or down) towards the real balance. */
  private updateMoney(state: GameState): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.shownMoney < 0) this.shownMoney = state.money;
    const diff = state.money - this.shownMoney;
    if (Math.abs(diff) > 0.5) {
      this.shownMoney += Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 7));
      if (Math.abs(state.money - this.shownMoney) < 1) this.shownMoney = state.money;
    } else {
      this.shownMoney = state.money;
    }
    this.money.classList.toggle('tick', diff > 0.5);
    set(this.money, `${rateHtml(state)}${money(this.shownMoney)}${icon('coin', 34)}`);
  }

  /** Shows "Goal done" in the goal panel for a moment. */
  goalDone(reward: number): void {
    this.goalDoneReward = reward;
    this.goalDoneUntil = performance.now() + GOAL_DONE_MS;
    this.lastSlow = -1000;
  }

  /** Big centred banner (rank-ups). */
  banner(title: string, sub: string): void {
    const b = div('banner', this.root);
    b.innerHTML = `<h2 class="ol">${title}</h2><p class="ol">${sub}</p>`;
    b.addEventListener('animationend', () => b.remove());
  }

  toast(text: string, kind: 'info' | 'good' | 'warn' = 'info'): void {
    const t = div(`pn toast ol ${kind}`, this.toasts);
    t.textContent = text;
    while (this.toasts.children.length > MAX_TOASTS) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('out'), TOAST_MS);
    setTimeout(() => t.remove(), TOAST_MS + TOAST_FADE_MS);
  }

  /** Floating "+$12" that rises and fades at a screen position. */
  floatText(text: string, x: number, y: number): void {
    const f = div('floaty ol', this.root);
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.addEventListener('animationend', () => f.remove());
  }
}
