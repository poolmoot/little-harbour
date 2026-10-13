import { FISH, HOUR_SECONDS } from '../sim/config';
import { carryCapacity, handCrates } from '../sim/crates';
import { holdSize } from '../sim/fleet';
import { rankName, rankProgress } from '../sim/rank';
import { HULL_NAMES } from '../sim/config';
import type { GameState } from '../sim/state';
import { formatClock, phaseOf } from '../sim/time';
import { hex, SPECIES_COLOUR } from '../palette';
import { fishSvg } from './panels';

function set(el: HTMLElement, html: string): void {
  if (el.dataset.h !== html) {
    el.dataset.h = html;
    el.innerHTML = html;
  }
}

export interface Prompt {
  text: string;
  key: boolean;
  hot?: boolean;
  dim?: boolean;
}

export class Hud {
  private money = this.el('card hud-money');
  private clock = this.el('card hud-clock');
  private carry = this.el('card');
  private orders = this.el('card');
  private boats = this.el('card btrack');
  private rank = this.el('card hud-rank');
  private prompt = this.el('card prompt');
  private hints = this.el('card hints');
  private toasts = this.el('toasts');
  private shownMoney = -1;
  private lastTick = performance.now();

  constructor(root: HTMLElement) {
    const right = document.createElement('div');
    right.className = 'hud-right';
    right.append(this.carry, this.orders, this.boats);
    root.append(this.money, this.clock, this.rank, right, this.prompt, this.hints, this.toasts);
    this.hints.textContent = 'WASD walk  ·  E interact  ·  L logbook  ·  Esc close';
    this.prompt.style.display = 'none';
  }

  private el(cls: string): HTMLDivElement {
    const d = document.createElement('div');
    d.className = cls;
    return d;
  }

  update(state: GameState, prompt: Prompt | null): void {
    // Counter ticks up (or down) towards the real balance.
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.shownMoney < 0) this.shownMoney = state.money;
    const diff = state.money - this.shownMoney;
    if (Math.abs(diff) > 0.5) {
      this.shownMoney += Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 7));
      if (Math.abs(state.money - this.shownMoney) < 1) this.shownMoney = state.money;
      if (diff > 0) this.money.classList.add('tick');
    } else {
      this.shownMoney = state.money;
      this.money.classList.remove('tick');
    }
    set(this.money, `<div class="big">$${Math.round(this.shownMoney)}</div><div class="sub">Day ${state.day}</div>`);
    const ph = phaseOf(state.dayTime);
    set(this.clock, `<div class="t">${formatClock(state.dayTime)}</div><div class="p">${ph}</div>`);

    const hand = handCrates(state);
    const cap = carryCapacity(state);
    let chips = '';
    for (let i = 0; i < cap; i++) {
      const c = hand[i];
      chips += c
        ? `<span class="chip">${fishSvg(hex(SPECIES_COLOUR[c.species]), 22)}${Math.round(c.freshness)}%</span>`
        : `<span class="chip empty">empty</span>`;
    }
    set(this.carry, `<h4>Carrying ${hand.length}/${cap}</h4><div class="chips">${chips}</div>`);

    let orders = '<h4>Orders</h4>';
    if (state.orders.length === 0) orders += '<div class="line"><small>No orders right now.</small></div>';
    for (const o of state.orders) {
      const left = Math.max(0, o.deadline - state.clock);
      const by = formatClock((state.dayTime + left) % (HOUR_SECONDS * 24));
      orders += `<div class="line ${left < 15 ? 'urgent' : ''}">${o.name}: ${o.filled}/${o.qty} ${FISH[o.species].name}<br><small>by ${by} (${Math.ceil(left)}s)</small></div>`;
    }
    set(this.orders, orders);

    const rp = rankProgress(state);
    set(this.rank, `<b>${rankName(state)}</b><div class="rankbar"><i style="width:${Math.round((rp?.frac ?? 1) * 100)}%"></i></div><small>${rp ? `$${rp.have.toLocaleString()} / $${rp.need.toLocaleString()}` : 'Top rank'}</small>`);

    let boats = `<h4>Boats</h4>`;
    for (const b of state.boats) {
      const cap = b.captain && !b.captain.unpaid ? ' ⚓' : '';
      let cls = '', fill = 0, txt = 'in harbour';
      if (b.status === 'out') { fill = Math.min(100, (b.progress / b.tripTime) * 100); txt = `${Math.max(0, Math.ceil(b.tripTime - b.progress))}s`; }
      else if (b.status === 'returned') { cls = 'back'; txt = `back! unload ${b.catch.length}`; }
      boats += `<div class="brow ${cls}" title="${HULL_NAMES[b.hull]}, hold ${holdSize(b)}"><span class="tier" style="background:${['#c89c62', '#6f9ac4', '#6fae7e', '#c4584c'][b.hull]}"></span><span class="bn">${b.name}${cap}</span><span class="bst"><i style="width:${fill}%"></i><em>${txt}</em></span></div>`;
    }
    set(this.boats, boats);

    if (prompt) {
      this.prompt.style.display = '';
      this.prompt.className = `card prompt${prompt.hot ? ' hot' : ''}${prompt.dim ? ' dim' : ''}`;
      set(this.prompt, `${prompt.key ? '<kbd>E</kbd>' : ''}${prompt.text}`);
    } else {
      this.prompt.style.display = 'none';
    }
  }

  /** Big centred banner (rank-ups). */
  banner(title: string, sub: string): void {
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
    this.toasts.parentElement?.appendChild(b);
    setTimeout(() => b.remove(), 4300);
  }

  toast(text: string, kind: 'info' | 'good' | 'warn' = 'info'): void {
    const t = document.createElement('div');
    t.className = `card toast ${kind}`;
    t.textContent = text;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('out'), 3400);
    setTimeout(() => t.remove(), 3800);
  }

  /** Floating "+$12" that rises and fades at a screen position. */
  floatText(text: string, x: number, y: number): void {
    const f = document.createElement('div');
    f.className = 'floaty';
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    this.toasts.parentElement?.appendChild(f);
    setTimeout(() => f.remove(), 1500);
  }
}
