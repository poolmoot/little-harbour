import { FISH, ICE_CAPACITY, SPECIES, UPGRADES, UPGRADE_IDS, ZONES, ZONE_IDS } from '../sim/config';
import type { UpgradeId, ZoneId } from '../sim/config';
import { zoneWeights } from '../sim/catch';
import { handCrates, iceCrates } from '../sim/crates';
import { crateValue, unitPrice } from '../sim/market';
import { sellAll } from '../sim/market';
import { holdSize } from '../sim/state';
import type { DayStats, GameState } from '../sim/state';
import { formatClock, isNight, phaseOf } from '../sim/time';
import { canBuy } from '../sim/upgrades';
import { zoneUnlocked } from '../sim/boats';
import { hex, SPECIES_COLOUR } from '../palette';
import { ORDER_BONUS, ORDER_REFILL_DELAY } from '../sim/config';

export function fishSvg(colour: string, size = 30, silhouette = false): string {
  const fill = silhouette ? '#3b2f25' : colour;
  const eye = silhouette ? '' : '<circle cx="8" cy="10" r="1.7" fill="#222"/>';
  return `<svg width="${size * 1.6}" height="${size}" viewBox="0 0 40 24" style="flex:none"><ellipse cx="17" cy="12" rx="14" ry="8" fill="${fill}" stroke="#3b2f25" stroke-width="1.2"/><polygon points="29,12 39,3 39,21" fill="${fill}" stroke="#3b2f25" stroke-width="1.2"/>${eye}</svg>`;
}

export type PanelKind = 'dispatch' | 'market' | 'shipyard' | 'board' | 'logbook' | 'ice' | 'summary';

export interface PanelActions {
  dispatch(boatId: number, zone: ZoneId): void;
  sellAll(): void;
  sellCrate(id: number): void;
  buy(id: UpgradeId): void;
  store(id: number): void;
  take(id: number): void;
  resetGame(): void;
  onClose(): void;
}

const bar = (f: number) => {
  const col = f > 60 ? '#4f8a52' : f > 30 ? '#e0a82e' : '#c0572d';
  return `<div class="bar"><i style="width:${Math.round(f)}%;background:${col}"></i></div>`;
};

export class Panels {
  private overlay = document.createElement('div');
  private panel = document.createElement('div');
  private kind: PanelKind | null = null;
  private arg = 0;
  private summary: { day: number; stats: DayStats } | null = null;
  private confirmReset = false;
  private lastUpdate = 0;
  private last = '';

  constructor(root: HTMLElement, private actions: PanelActions, private getState: () => GameState) {
    this.overlay.className = 'overlay';
    this.panel.className = 'card panel';
    this.overlay.appendChild(this.panel);
    root.appendChild(this.overlay);
    this.overlay.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.overlay) {
        this.close();
        return;
      }
      const b = t.closest('[data-act]') as HTMLElement | null;
      if (!b || b.hasAttribute('disabled') || b.classList.contains('off')) return;
      e.preventDefault();
      this.act(b.dataset.act ?? '', b.dataset.a ?? '', b.dataset.b ?? '');
    });
  }

  get current(): PanelKind | null {
    return this.kind;
  }
  isOpen(): boolean {
    return this.kind !== null;
  }

  open(kind: PanelKind, arg = 0): void {
    this.kind = kind;
    this.arg = arg;
    this.confirmReset = false;
    this.overlay.classList.add('open');
    this.render(true);
  }

  showSummary(day: number, stats: DayStats): void {
    this.summary = { day, stats };
    this.open('summary');
  }

  close(): void {
    if (!this.kind) return;
    this.kind = null;
    this.overlay.classList.remove('open');
    this.actions.onClose();
  }

  toggle(kind: PanelKind): void {
    if (this.kind === kind) this.close();
    else this.open(kind);
  }

  /** Re-render (throttled) so countdowns and prices stay live. */
  update(): void {
    if (!this.kind || performance.now() / 1000 - this.lastUpdate < 0.4) return;
    this.render(false);
  }
  refresh(): void {
    if (this.kind) this.render(true);
  }

  private act(act: string, a: string, b: string): void {
    switch (act) {
      case 'close': this.close(); break;
      case 'send': this.actions.dispatch(Number(a), b as ZoneId); break;
      case 'sellall': this.actions.sellAll(); break;
      case 'sell': this.actions.sellCrate(Number(a)); break;
      case 'buy': this.actions.buy(a as UpgradeId); break;
      case 'store': this.actions.store(Number(a)); break;
      case 'take': this.actions.take(Number(a)); break;
      case 'reset': this.confirmReset = true; this.render(true); break;
      case 'resetno': this.confirmReset = false; this.render(true); break;
      case 'resetyes': this.actions.resetGame(); break;
    }
  }

  private render(force: boolean): void {
    if (!this.kind) return;
    this.lastUpdate = performance.now() / 1000;
    const s = this.getState();
    let body = '';
    switch (this.kind) {
      case 'dispatch': body = this.dispatch(s); break;
      case 'market': body = this.market(s); break;
      case 'shipyard': body = this.shipyard(s); break;
      case 'board': body = this.board(s); break;
      case 'logbook': body = this.logbook(s); break;
      case 'ice': body = this.ice(s); break;
      case 'summary': body = this.summaryHtml(); break;
    }
    if (force || body !== this.last) {
      this.last = body;
      this.panel.innerHTML = body;
    }
  }

  private head(title: string, sub: string): string {
    return `<button class="btn ghost xbtn" data-act="close">Close (Esc)</button><h2>${title}</h2><p class="sub">${sub}</p>`;
  }

  private dispatch(s: GameState): string {
    const boat = s.boats.find((b) => b.id === this.arg);
    if (!boat) return this.head('Boat', 'No such boat.');
    const phase = phaseOf(s.dayTime);
    const night = isNight(s);
    let h = this.head(`Send out Boat ${s.boats.indexOf(boat) + 1}`, `Hold: ${holdSize(s)} crates. Pick a zone, then unload when it returns.${night ? ' <b>It is too dark to sail.</b>' : ''}`);
    for (const z of ZONE_IDS) {
      const zone = ZONES[z];
      const unlocked = zoneUnlocked(s, z);
      const w = zoneWeights(z, phase);
      const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
      const fish = (Object.keys(w) as (keyof typeof w)[])
        .map((sp) => {
          const pct = Math.round(((w[sp] ?? 0) / total) * 100);
          return `<span class="chip">${fishSvg(hex(SPECIES_COLOUR[sp]), 16)}${FISH[sp].name} ${pct}% · $${Math.round(unitPrice(s, sp, 100))}</span>`;
        })
        .join(' ');
      const ok = unlocked && !night;
      h += `<div class="row ${unlocked ? '' : 'locked'}"><div class="grow"><b>${zone.name}</b> · ${zone.trip} s trip${unlocked ? '' : ' · needs the Reinforced hull (shipyard)'}<small class="chips" style="margin-top:4px">${fish}</small></div>
        <button class="btn good ${ok ? '' : 'off'}" data-act="send" data-a="${boat.id}" data-b="${z}">${unlocked ? (night ? 'Too dark' : 'Send') : 'Locked'}</button></div>`;
    }
    return h;
  }

  private market(s: GameState): string {
    const hand = handCrates(s);
    let h = this.head('Fish Market', 'Price = base × freshness × demand. Matching a notice-board order pays double.');
    h += '<h3>You are carrying</h3>';
    if (hand.length === 0) h += '<div class="row"><div class="grow"><small>Nothing in your hands. Haul crates from the dock.</small></div></div>';
    for (const c of hand) {
      const v = crateValue(s, c);
      const matched = s.orders.some((o) => o.species === c.species && o.filled < o.qty);
      h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[c.species]), 24)}<div class="grow"><b>${FISH[c.species].name}</b> ${matched ? '<span class="badge">ORDER x2</span>' : ''}<small>${c.freshness <= 0 ? 'Spoiled' : `Freshness ${Math.round(c.freshness)}%`}</small>${bar(c.freshness)}</div>
        <div class="price">$${v}</div><button class="btn good" data-act="sell" data-a="${c.id}">Sell</button></div>`;
    }
    if (hand.length) {
      const sim = structuredClone(s);
      sellAll(sim);
      h += `<div class="center"><button class="btn good" data-act="sellall">Sell all (+$${sim.money - s.money})</button></div>`;
    }
    h += '<h3>Price board</h3><table class="board"><tr><th></th><th>Fish</th><th>Fresh price</th><th>Demand</th></tr>';
    for (const sp of SPECIES) {
      const known = s.book[sp].caught > 0;
      const d = Math.round(s.demand[sp] * 100);
      h += known
        ? `<tr><td>${fishSvg(hex(SPECIES_COLOUR[sp]), 16)}</td><td>${FISH[sp].name}</td><td>$${Math.round(unitPrice(s, sp, 100))}</td><td style="color:${d < 90 ? '#c0572d' : '#4f8a52'}">${d}%</td></tr>`
        : `<tr style="opacity:.5"><td>${fishSvg('', 16, true)}</td><td>???</td><td>-</td><td>-</td></tr>`;
    }
    return h + '</table>';
  }

  private shipyard(s: GameState): string {
    let h = this.head('Shipyard', `You have <b>$${s.money}</b>. Hold and hull upgrades apply to every boat.`);
    for (const id of UPGRADE_IDS) {
      const u = UPGRADES[id];
      const chk = canBuy(s, id);
      const owned = s.upgrades[id];
      h += `<div class="row ${owned ? 'locked' : ''}"><div class="grow"><b>${u.name}</b><small>${u.desc}</small></div>
        <div class="price">${owned ? '' : '$' + u.cost}</div>
        <button class="btn ${owned ? 'ghost off' : chk.ok ? 'good' : 'off'}" data-act="buy" data-a="${id}">${owned ? 'Owned' : chk.ok ? 'Buy' : chk.reason}</button></div>`;
    }
    return h;
  }

  private board(s: GameState): string {
    let h = this.head('Notice board', `Sell matching crates at the market: each pays double, and finishing an order adds a ${Math.round(ORDER_BONUS * 100)}% bonus.`);
    if (s.orders.length === 0) h += '<div class="row"><div class="grow"><small>No notices right now.</small></div></div>';
    for (const o of s.orders) {
      const left = Math.max(0, o.deadline - s.clock);
      const by = formatClock((s.dayTime + left) % 360);
      h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[o.species]), 26)}<div class="grow"><b>${o.name}</b> wants ${o.qty} × ${FISH[o.species].name}
        <small>${o.filled}/${o.qty} delivered · by ${by} (${Math.ceil(left)} s left)</small>${bar((left / 60) * 100)}</div>
        <div class="price">+$${Math.round(o.baseValue * ORDER_BONUS)}</div></div>`;
    }
    if (s.orderCooldowns.length) h += `<p class="sub">Next notice in about ${Math.ceil(Math.min(...s.orderCooldowns))} s (a new one appears ${ORDER_REFILL_DELAY} s after a slot frees).</p>`;
    return h;
  }

  private logbook(s: GameState): string {
    let h = this.head('Logbook', 'Species show as silhouettes until you catch one.');
    h += '<div class="grid">';
    for (const sp of SPECIES) {
      const r = s.book[sp];
      h += r.caught > 0
        ? `<div class="fcard">${fishSvg(hex(SPECIES_COLOUR[sp]), 34)}<br><b>${FISH[sp].name}</b><br>Caught: ${r.caught}<br>Best sale: ${r.bestSale ? '$' + r.bestSale : '-'}</div>`
        : `<div class="fcard unknown">${fishSvg('', 34, true)}<br><b>???</b><br>Not caught yet</div>`;
    }
    h += '</div><div class="center">';
    h += this.confirmReset
      ? '<b>Delete your save and start over?</b><br><br><button class="btn warn" data-act="resetyes">Yes, reset</button> <button class="btn ghost" data-act="resetno">Cancel</button>'
      : '<button class="btn ghost" data-act="reset">Reset game</button>';
    return h + '</div>';
  }

  private ice(s: GameState): string {
    if (!s.upgrades.icebox) return this.head('Ice box', 'You do not own an ice box yet. Buy one at the shipyard for $120: crates keep fresh four times longer.');
    const hand = handCrates(s), ice = iceCrates(s);
    let h = this.head(`Ice box (${ice.length}/${ICE_CAPACITY})`, 'Crates in the ice box lose freshness four times slower.');
    h += '<h3>In your hands</h3>';
    if (!hand.length) h += '<div class="row"><div class="grow"><small>Nothing.</small></div></div>';
    for (const c of hand) h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[c.species]), 22)}<div class="grow"><b>${FISH[c.species].name}</b>${bar(c.freshness)}</div><button class="btn" data-act="store" data-a="${c.id}">Store</button></div>`;
    h += '<h3>On ice</h3>';
    if (!ice.length) h += '<div class="row"><div class="grow"><small>Empty.</small></div></div>';
    for (const c of ice) h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[c.species]), 22)}<div class="grow"><b>${FISH[c.species].name}</b>${bar(c.freshness)}</div><button class="btn" data-act="take" data-a="${c.id}">Take</button></div>`;
    return h;
  }

  private summaryHtml(): string {
    const m = this.summary;
    if (!m) return '';
    const st = m.stats;
    return `<h2>Day ${m.day} complete</h2><p class="sub">A new day dawns over the harbour.</p>
      <div class="stat"><span>Earned</span><b>$${st.earned}</b></div>
      <div class="stat"><span>Crates sold</span><b>${st.sold}</b></div>
      <div class="stat"><span>Crates spoiled</span><b>${st.spoiled}</b></div>
      <div class="stat"><span>Orders filled</span><b>${st.filled}</b></div>
      <div class="stat"><span>Orders missed</span><b>${st.missed}</b></div>
      <div class="center"><button class="btn good" data-act="close">Start the day</button></div>`;
  }
}
