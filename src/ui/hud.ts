import { FISH, HOUR_SECONDS } from '../sim/config';
import { carryCapacity, handCrates } from '../sim/crates';
import { holdSize } from '../sim/state';
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
  private boats = this.el('card');
  private prompt = this.el('card prompt');
  private hints = this.el('card hints');
  private toasts = this.el('toasts');

  constructor(root: HTMLElement) {
    const right = document.createElement('div');
    right.className = 'hud-right';
    right.append(this.carry, this.orders, this.boats);
    root.append(this.money, this.clock, right, this.prompt, this.hints, this.toasts);
    this.hints.textContent = 'WASD walk  ·  E interact  ·  L logbook  ·  Esc close';
    this.prompt.style.display = 'none';
  }

  private el(cls: string): HTMLDivElement {
    const d = document.createElement('div');
    d.className = cls;
    return d;
  }

  update(state: GameState, prompt: Prompt | null): void {
    set(this.money, `<div class="big">$${state.money}</div><div class="sub">Day ${state.day}</div>`);
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

    let boats = `<h4>Boats (hold ${holdSize(state)})</h4>`;
    state.boats.forEach((b, i) => {
      const txt =
        b.status === 'docked' ? 'in the harbour'
          : b.status === 'returned' ? `<b>back! unload ${b.catch.length} crates</b>`
            : `at sea, back in ${Math.max(0, Math.ceil(b.tripTime - b.progress))}s`;
      boats += `<div class="line">Boat ${i + 1}: ${txt}</div>`;
    });
    set(this.boats, boats);

    if (prompt) {
      this.prompt.style.display = '';
      this.prompt.className = `card prompt${prompt.hot ? ' hot' : ''}${prompt.dim ? ' dim' : ''}`;
      set(this.prompt, `${prompt.key ? '<kbd>E</kbd>' : ''}${prompt.text}`);
    } else {
      this.prompt.style.display = 'none';
    }
  }

  toast(text: string, kind: 'info' | 'good' | 'warn' = 'info'): void {
    const t = document.createElement('div');
    t.className = `card toast ${kind}`;
    t.textContent = text;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.remove(), 3800);
  }
}
