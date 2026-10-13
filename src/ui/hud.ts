import { FISH, HOUR_SECONDS, HULL_NAMES } from '../sim/config';
import { carryCapacity, handCrates } from '../sim/crates';
import { holdSize } from '../sim/fleet';
import { rankName, rankOf, rankProgress } from '../sim/rank';
import type { Boat, GameState, Order } from '../sim/state';
import { formatClock, isNight, phaseOf } from '../sim/time';
import { hex, SPECIES_COLOUR } from '../palette';
import { meter, money } from './components';
import { fishIcon, HULL_ICONS, icon } from './icons';
import type { PanelKind } from './panels';

/** Orders with less than this many seconds left are flagged as urgent. */
const URGENT_SECONDS = 15;
/** Seconds of deadline that fill an order's meter. */
const ORDER_METER_SECONDS = 60;
const TOAST_MS = 3400;
const TOAST_FADE_MS = 400;
const MAX_TOASTS = 4;

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
    <div class="hud-orders-text ol">${o.name} · ${o.filled}/${o.qty} ${FISH[o.species].name}</div>
    ${meter(frac, frac > 0.6 ? 'green' : frac > 0.3 ? 'amber' : 'red')}<div class="dim">by ${by} · ${Math.ceil(left)}s</div></div></div>`;
}

function boatCard(b: Boat): string {
  const art = icon(HULL_ICONS[b.hull], 28);
  const name = `${b.name}${b.captain && !b.captain.unpaid ? ` ${icon('anchor', 12)}` : ''}`;
  const title = `${HULL_NAMES[b.hull]}, hold ${holdSize(b)}`;
  if (b.status === 'returned') return `<div class="pn hud-boat back" title="${title}">${art}<div class="grow"><div class="ol">${name}</div><div class="ol">Back, unload ${b.catch.length}</div></div></div>`;
  if (b.status === 'out') {
    const left = Math.max(0, Math.ceil(b.tripTime - b.progress));
    return `<div class="pn hud-boat" title="${title}">${art}<div class="grow"><div class="ol">${name} · ${left}s</div>${meter(b.progress / b.tripTime, 'cyan')}</div></div>`;
  }
  return `<div class="pn hud-boat" title="${title}">${art}<div class="grow"><div class="ol">${name}</div><div class="dim">In harbour</div></div></div>`;
}

/** The always-on overlay: rank, clock, money, orders, fleet status, hands, prompt, toasts. */
export class Hud {
  private rank: HTMLDivElement;
  private clock: HTMLDivElement;
  private money: HTMLDivElement;
  private orders: HTMLDivElement;
  private tiles: HTMLDivElement;
  private boats: HTMLDivElement;
  private carry: HTMLDivElement;
  private prompt: HTMLDivElement;
  private toasts: HTMLDivElement;
  private shownMoney = -1;
  private lastTick = performance.now();

  constructor(private root: HTMLElement, onOpen: (kind: PanelKind) => void) {
    this.rank = div('hud-tl', root);
    const tr = div('hud-tr', root);
    this.clock = div('well pill hud-clock ol', tr);
    this.money = div('well pill hud-money ol', tr);
    this.orders = div('pn hud-left', root);
    const right = div('hud-right', root);
    this.tiles = div('hud-tiles', right);
    this.boats = div('hud-boats', right);
    const bl = div('hud-bl', root);
    this.carry = div('', bl);
    div('hud-hints ol', bl).textContent = 'WASD walk · E interact · L logbook · Esc close';
    this.prompt = div('prompt', root);
    this.toasts = div('toasts', root);
    this.tiles.addEventListener('pointerdown', (e) => {
      const kind = ((e.target as HTMLElement).closest('[data-open]') as HTMLElement | null)?.dataset.open;
      if (kind) onOpen(kind as PanelKind);
    });
  }

  update(state: GameState, prompt: Prompt | null): void {
    this.updateMoney(state);
    set(this.clock, `${formatClock(state.dayTime)} · ${phaseOf(state.dayTime)}${icon(isNight(state) ? 'moon' : 'sun', 34)}`);

    const rp = rankProgress(state);
    set(this.rank, `<div class="hud-shield">${icon('shield', 48)}<span class="ol">${rankOf(state) + 1}</span></div>
      <div class="hud-rank"><div class="hud-rank-name ol">${rankName(state)} · Day ${state.day}</div>${meter(rp?.frac ?? 1, 'cyan', rp ? `$${money(rp.have)} / $${money(rp.need)}` : 'Top rank')}</div>`);

    set(this.orders, `<div class="pn-head"><span class="ol warn">Orders</span><span class="ol">${state.orders.length}</span></div>${
      state.orders.length ? state.orders.map((o) => orderRow(state, o)).join('') : '<div class="hud-orders-row dim">No orders right now.</div>'}`);

    set(this.tiles, `<button class="tile ol" data-open="board">${icon('note', 30)}Notices${state.orders.length ? `<span class="dot">${state.orders.length}</span>` : ''}</button>
      <button class="tile ol" data-open="logbook">${icon('book', 30)}Logbook</button>`);
    set(this.boats, state.boats.map(boatCard).join(''));

    const hand = handCrates(state);
    const cap = carryCapacity(state);
    let slots = '';
    for (let i = 0; i < cap; i++) {
      const c = hand[i];
      slots += c ? `<div class="slot full ol">${fishIcon(hex(SPECIES_COLOUR[c.species]), 18)}${Math.round(c.freshness)}%</div>` : '<div class="slot empty">+</div>';
    }
    set(this.carry, `<div class="ol">Carrying ${hand.length} / ${cap}</div><div class="hud-slots">${slots}</div>`);

    set(this.prompt, prompt
      ? `<div class="btn lg ol${prompt.hot ? ' gold hot' : ''}${prompt.dim ? ' ghost dim' : ''}">${prompt.key ? '<span class="kbd">E</span>' : ''}<span>${prompt.text}</span></div>`
      : '');
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
    set(this.money, `${money(this.shownMoney)}${icon('coin', 34)}`);
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
