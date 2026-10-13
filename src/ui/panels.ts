import {
  ICE_CAPACITY, MAX_BOATS, MAX_DOCKHANDS, ORDER_BONUS, ORDER_REFILL_DELAY, SPECIES, TRACKS, TRACK_MAX, UPGRADES, UPGRADE_IDS,
  ZONE_IDS, DOCKHAND_WAGE,
} from '../sim/config';
import type { Track, UpgradeId, ZoneId } from '../sim/config';
import { zoneWeights } from '../sim/catch';
import { carryCapacity, handCrates, iceCrates } from '../sim/crates';
import { crateValue, unitPrice, sellAll } from '../sim/market';
import type { DayStats, GameState, HaulPolicy } from '../sim/state';
import { formatClock, isNight, phaseOf } from '../sim/time';
import { canBuy } from '../sim/upgrades';
import { canBuyBoat, canUpgradeBoat, holdSize, tripCostFor, trackCost, tripTimeFor, zoneUnlockedFor } from '../sim/fleet';
import { canHireCaptain, canHireDockhand, dailyWages } from '../sim/staff';
import { netProfit } from '../sim/ledger';
import { CAPTAINS_RANK, rankOf, rankProgress } from '../sim/rank';
import { hex, SPECIES_COLOUR } from '../palette';
import type { QualityMode } from '../view/quality';
import {
  FISH_NAME, LABEL, QUALITY_CHOICES, QUALITY_NOTE, QUALITY_TITLE, RANK_NAME, RANK_UNLOCKS, TRACK_NAME, TRAIT, UPGRADE, ZONE_NAME, boatType, crates, denyText, needsRank, trackNext, trackNow,
  zoneNeeds,
} from './text';

export function fishSvg(colour: string, size = 30, silhouette = false): string {
  const fill = silhouette ? '#3b2f25' : colour;
  const eye = silhouette ? '' : '<circle cx="8" cy="10" r="1.7" fill="#222"/>';
  return `<svg width="${size * 1.6}" height="${size}" viewBox="0 0 40 24" style="flex:none"><ellipse cx="17" cy="12" rx="14" ry="8" fill="${fill}" stroke="#3b2f25" stroke-width="1.2"/><polygon points="29,12 39,3 39,21" fill="${fill}" stroke="#3b2f25" stroke-width="1.2"/>${eye}</svg>`;
}

export type PanelKind = 'boat' | 'hire' | 'market' | 'shipyard' | 'board' | 'logbook' | 'ice' | 'summary';

export interface PanelActions {
  dispatch(boatId: number, zone: ZoneId): void;
  sellAll(): void;
  sellCrate(id: number): void;
  buy(id: UpgradeId): void;
  setTarget(boatId: number, zone: ZoneId): void;
  upgradeBoat(boatId: number, track: Track): void;
  buyBoat(): void;
  hireCaptain(candidateId: number, boatId: number): void;
  fireCaptain(boatId: number): void;
  hireDockhand(): void;
  fireDockhand(id: number): void;
  setPolicy(p: HaulPolicy): void;
  store(id: number): void;
  take(id: number): void;
  getQuality(): QualityMode;
  setQuality(m: QualityMode): void;
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
      case 'target': this.actions.setTarget(Number(a), b as ZoneId); break;
      case 'up': this.actions.upgradeBoat(Number(a), b as Track); break;
      case 'buyboat': this.actions.buyBoat(); break;
      case 'hirecap': this.actions.hireCaptain(Number(a), Number(b)); break;
      case 'firecap': this.actions.fireCaptain(Number(a)); break;
      case 'hiredock': this.actions.hireDockhand(); break;
      case 'firedock': this.actions.fireDockhand(Number(a)); break;
      case 'policy': this.actions.setPolicy(a as HaulPolicy); break;
      case 'openboat': this.open('boat', Number(a)); break;
      case 'store': this.actions.store(Number(a)); break;
      case 'take': this.actions.take(Number(a)); break;
      case 'quality': this.actions.setQuality(a as QualityMode); break;
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
      case 'boat': body = this.boat(s); break;
      case 'hire': body = this.hire(s); break;
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
    return `<button class="btn ghost xbtn" data-act="close">${LABEL.close}</button><h2>${title}</h2><p class="sub">${sub}</p>`;
  }

  private boat(s: GameState): string {
    const boat = s.boats.find((b) => b.id === this.arg);
    if (!boat) return this.head('Boat', 'There is no such boat.');
    const phase = phaseOf(s.dayTime);
    const night = isNight(s);
    const cap = boat.captain;
    let h = this.head(`${boat.name}, ${boatType(boat.hull)}`,
      `Carries ${crates(holdSize(boat))}. You have <b>$${Math.floor(s.money)}</b>.${night ? ' <b>It is too dark to go out.</b>' : ''}`);
    h += `<h3>Where to fish</h3><p class="sub" style="margin-bottom:6px">${LABEL.tripCostNote}</p>`;
    for (const z of ZONE_IDS) {
      const unlocked = zoneUnlockedFor(boat, z);
      const w = zoneWeights(z, phase);
      const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
      const fish = (Object.keys(w) as (keyof typeof w)[])
        .map((sp) => `<span class="chip">${fishSvg(hex(SPECIES_COLOUR[sp]), 16)}${FISH_NAME[sp]} ${Math.round(((w[sp] ?? 0) / total) * 100)}% · $${Math.round(unitPrice(s, sp, 100))}</span>`)
        .join(' ');
      const sel = boat.target === z;
      const cost = tripCostFor(z);
      const poor = s.money < cost;
      h += `<div class="row ${unlocked ? '' : 'locked'} ${sel ? 'sel' : ''}"><div class="grow"><b>${ZONE_NAME[z]}</b> · ${Math.round(tripTimeFor(boat, z))} s trip · <span style="${unlocked && poor ? 'color:#c0572d;font-weight:700' : ''}">${LABEL.tripCost} $${cost}</span>${unlocked ? '' : ` · ${zoneNeeds(z)}`}<small class="chips" style="margin-top:4px">${fish}</small></div>
        <button class="btn ${sel ? 'ghost off' : unlocked ? '' : 'off'}" data-act="target" data-a="${boat.id}" data-b="${z}">${sel ? 'Chosen' : unlocked ? 'Choose' : LABEL.locked}</button></div>`;
    }
    if (!cap) {
      const cost = tripCostFor(boat.target);
      const poor = s.money < cost;
      const ok = boat.status === 'docked' && !night && !poor;
      const label = night ? 'Too dark' : boat.status !== 'docked' ? 'Boat is away' : poor ? `Not enough money ($${cost} needed)` : `Send to ${ZONE_NAME[boat.target]} ($${cost})`;
      h += `<div class="center" style="margin-top:6px"><button class="btn good ${ok ? '' : 'off'}" data-act="send" data-a="${boat.id}" data-b="${boat.target}">${label}</button></div>`;
    }
    h += `<h3>${LABEL.captain}</h3>`;
    if (cap) {
      const info = TRAIT[cap.trait];
      h += `<div class="row"><div class="grow"><b>${cap.name}</b> <span class="badge">${info.name}</span><small>${info.desc} · $${cap.wage} a day${cap.unpaid ? ' · <b style="color:#c0572d">not paid, no work today</b>' : ' · sails by day and pays the trip cost'}</small></div><button class="btn warn" data-act="firecap" data-a="${boat.id}">${LABEL.endJob}</button></div>`;
    } else {
      h += `<div class="row"><div class="grow"><small>${rankOf(s) >= CAPTAINS_RANK ? 'No captain. A captain sails the boat for you. Hire one at the inn.' : `Captains come at rank ${RANK_NAME[CAPTAINS_RANK]}.`}</small></div></div>`;
    }
    h += '<h3>Make it better</h3>';
    for (const t of TRACKS) {
      const lvl = boat[t], max = TRACK_MAX[t];
      const c = trackCost(boat, t);
      const chk = canUpgradeBoat(s, boat.id, t);
      const pips = Array.from({ length: max + 1 }, (_, i) => `<i class="pip ${i <= lvl ? 'on' : ''}"></i>`).join('');
      h += `<div class="row ${c === null ? 'locked' : ''}"><div class="grow"><b>${TRACK_NAME[t]}</b> <span class="pips">${pips}</span> <small style="display:inline">${trackNow(boat, t)}</small><small>${c === null ? 'All done' : trackNext(boat, t)}</small></div>
        <div class="price">${c === null ? '' : '$' + c}</div>
        <button class="btn ${c === null ? 'ghost off' : chk.ok ? 'good' : 'off'}" data-act="up" data-a="${boat.id}" data-b="${t}">${c === null ? LABEL.maxed : chk.ok ? LABEL.buy : denyText(chk.reason, chk.needRank)}</button></div>`;
    }
    return h;
  }

  private hire(s: GameState): string {
    const rank = rankOf(s);
    let h = this.head('The Anchor Inn: hire people', `Pay is taken at 06:00 each day (the bill is <b>$${dailyWages(s)}</b>). People you cannot pay do not work that day. You have <b>$${Math.floor(s.money)}</b>.`);
    h += `<h3>Workers (${s.dockhands.length}/${MAX_DOCKHANDS}) · $${DOCKHAND_WAGE} a day</h3>`;
    for (const d of s.dockhands) {
      const doing = d.unpaid ? 'not paid, resting' : !d.job ? 'waiting for crates' : d.job.phase === 'out' ? 'going to the dock' : d.job.phase === 'haul' ? `carrying ${d.job.crateIds.length} to the ${d.job.dest === 'ice' ? 'ice box' : 'market'}` : 'walking back';
      h += `<div class="row"><div class="grow"><b>${d.name}</b><small>${doing}</small></div><button class="btn warn" data-act="firedock" data-a="${d.id}">${LABEL.endJob}</button></div>`;
    }
    const chk = canHireDockhand(s);
    h += `<div class="center" style="margin-top:6px"><button class="btn ${chk.ok ? 'good' : 'off'}" data-act="hiredock">${chk.ok ? 'Hire a worker' : denyText(chk.reason, chk.needRank)}</button></div>`;
    h += `<h3>Where workers take the fish</h3><div class="row"><div class="grow"><small>Workers carry ${carryCapacity(s)} crates at a time. The ice box keeps fish fresh, but holds only ${ICE_CAPACITY} (now ${iceCrates(s).length}). When it is full, they go to the market.</small></div>
      <button class="btn ${s.haulPolicy === 'market' ? 'good' : 'ghost'}" data-act="policy" data-a="market">Market</button>
      <button class="btn ${s.haulPolicy === 'ice' ? 'good' : 'ghost'} ${s.upgrades.icebox ? '' : 'off'}" data-act="policy" data-a="ice">${s.upgrades.icebox ? 'Ice box' : 'Ice box (buy first)'}</button></div>`;
    h += '<h3>Captains to hire (new faces each day)</h3>';
    if (rank < CAPTAINS_RANK) h += `<div class="row"><div class="grow"><small>Captains come at rank ${RANK_NAME[CAPTAINS_RANK]}.</small></div></div>`;
    for (const c of s.candidates) {
      const info = TRAIT[c.trait];
      const free = s.boats.filter((b) => !b.captain);
      h += `<div class="row"><div class="grow"><b>${c.name}</b> <span class="badge">${info.name}</span><small>${info.desc} · $${c.wage} a day</small></div>`;
      if (free.length === 0 || rank < CAPTAINS_RANK) h += `<button class="btn off">${rank < CAPTAINS_RANK ? LABEL.locked : 'No free boat'}</button>`;
      else for (const b of free) h += `<button class="btn good ${canHireCaptain(s, b.id).ok ? '' : 'off'}" data-act="hirecap" data-a="${c.id}" data-b="${b.id}">${b.name}</button>`;
      h += '</div>';
    }
    const cap = s.boats.filter((b) => b.captain);
    if (cap.length) h += '<h3>Your captains</h3>';
    for (const b of cap) h += `<div class="row"><div class="grow"><b>${b.captain!.name}</b> <span class="badge">${TRAIT[b.captain!.trait].name}</span><small>${b.name} · $${b.captain!.wage} a day</small></div><button class="btn warn" data-act="firecap" data-a="${b.id}">${LABEL.endJob}</button></div>`;
    return h;
  }

  private market(s: GameState): string {
    const hand = handCrates(s);
    let h = this.head('Fish Market', 'Fresh fish sell for more. Each fish also has a price level: it goes down when you sell a lot. Fish that an order wants pay double.');
    h += '<h3>In your hands</h3>';
    if (hand.length === 0) h += '<div class="row"><div class="grow"><small>Nothing in your hands. Carry crates here from the dock.</small></div></div>';
    for (const c of hand) {
      const v = crateValue(s, c);
      const matched = s.orders.some((o) => o.species === c.species && o.filled < o.qty);
      h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[c.species]), 24)}<div class="grow"><b>${FISH_NAME[c.species]}</b> ${matched ? '<span class="badge">ORDER: DOUBLE</span>' : ''}<small>${c.freshness <= 0 ? 'Gone bad' : `${Math.round(c.freshness)}% fresh`}</small>${bar(c.freshness)}</div>
        <div class="price">$${v}</div><button class="btn good" data-act="sell" data-a="${c.id}">Sell</button></div>`;
    }
    if (hand.length) {
      const sim = structuredClone(s);
      sellAll(sim);
      h += `<div class="center"><button class="btn good" data-act="sellall">Sell all (+$${sim.money - s.money})</button></div>`;
    }
    h += '<h3>Price board</h3><table class="board"><tr><th></th><th>Fish</th><th>Fresh price</th><th>Price level</th></tr>';
    for (const sp of SPECIES) {
      const known = s.book[sp].caught > 0;
      const d = Math.round(s.demand[sp] * 100);
      h += known
        ? `<tr><td>${fishSvg(hex(SPECIES_COLOUR[sp]), 16)}</td><td>${FISH_NAME[sp]}</td><td>$${Math.round(unitPrice(s, sp, 100))}</td><td style="color:${d < 90 ? '#c0572d' : '#4f8a52'}">${d}%</td></tr>`
        : `<tr style="opacity:.5"><td>${fishSvg('', 16, true)}</td><td>???</td><td>-</td><td>-</td></tr>`;
    }
    return h + '</table>';
  }

  private shipyard(s: GameState): string {
    const rank = rankOf(s);
    let h = this.head('Shipyard', `You have <b>$${Math.floor(s.money)}</b>. To make a boat better, open it here or walk to it on the pier.`);
    const bb = canBuyBoat(s);
    h += `<h3>Your boats (${s.boats.length}/${MAX_BOATS})</h3>`;
    for (const b of s.boats) h += `<div class="row"><div class="grow"><b>${b.name}</b><small>${boatType(b.hull)} · carries ${holdSize(b)}${b.captain ? ' · captain ' + b.captain.name : ''}</small></div><button class="btn ghost" data-act="openboat" data-a="${b.id}">${LABEL.open}</button></div>`;
    h += `<div class="row ${bb.cost === null ? 'locked' : ''}"><div class="grow"><b>${bb.cost === null ? 'You have all four boats' : 'New rowboat'}</b><small>${bb.cost === null ? 'Every boat spot is used.' : `It gets boat spot ${s.boats.length + 1}. Make it better after you buy it.`}</small></div>
      <div class="price">${bb.cost === null ? '' : '$' + bb.cost}</div><button class="btn ${bb.cost === null ? 'ghost off' : bb.ok ? 'good' : 'off'}" data-act="buyboat">${bb.cost === null ? LABEL.full : bb.ok ? LABEL.buy : denyText(bb.reason, bb.needRank)}</button></div>`;
    h += '<h3>For the harbour</h3>';
    for (const id of UPGRADE_IDS) {
      const u = UPGRADES[id];
      const chk = canBuy(s, id);
      const owned = s.upgrades[id];
      h += `<div class="row ${owned ? 'locked' : ''}"><div class="grow"><b>${UPGRADE[id].name}</b><small>${UPGRADE[id].desc}${rank < u.rank && !owned ? ` · ${needsRank(u.rank)}` : ''}</small></div>
        <div class="price">${owned ? '' : '$' + u.cost}</div>
        <button class="btn ${owned ? 'ghost off' : chk.ok ? 'good' : 'off'}" data-act="buy" data-a="${id}">${owned ? LABEL.owned : chk.ok ? LABEL.buy : denyText(chk.reason, chk.needRank)}</button></div>`;
    }
    return h;
  }

  private board(s: GameState): string {
    let h = this.head('Notice board', `Orders pay double for the fish they want. Finish a whole order and you get ${Math.round(ORDER_BONUS * 100)}% extra.`);
    if (s.orders.length === 0) h += '<div class="row"><div class="grow"><small>No orders right now.</small></div></div>';
    for (const o of s.orders) {
      const left = Math.max(0, o.deadline - s.clock);
      const by = formatClock((s.dayTime + left) % 360);
      h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[o.species]), 26)}<div class="grow"><b>${o.name}</b> wants ${o.qty} × ${FISH_NAME[o.species]}
        <small>${o.filled}/${o.qty} done · by ${by} (${Math.ceil(left)} s left)</small>${bar((left / 60) * 100)}</div>
        <div class="price">+$${Math.round(o.baseValue * ORDER_BONUS)}</div></div>`;
    }
    if (s.orderCooldowns.length) h += `<p class="sub">A new order comes in about ${Math.ceil(Math.min(...s.orderCooldowns))} s (${ORDER_REFILL_DELAY} s after one ends).</p>`;
    return h;
  }

  private logbook(s: GameState): string {
    let h = this.head('Fish book', 'Fish you have not caught yet show as dark shapes.');
    h += '<div class="grid">';
    for (const sp of SPECIES) {
      const r = s.book[sp];
      h += r.caught > 0
        ? `<div class="fcard">${fishSvg(hex(SPECIES_COLOUR[sp]), 34)}<br><b>${FISH_NAME[sp]}</b><br>Caught: ${r.caught}<br>Best sale: ${r.bestSale ? '$' + r.bestSale : '-'}</div>`
        : `<div class="fcard unknown">${fishSvg('', 34, true)}<br><b>???</b><br>Not caught yet</div>`;
    }
    h += '</div>';
    const q = this.actions.getQuality();
    h += `<h3>${QUALITY_TITLE}</h3><div class="row"><div class="grow"><small>${QUALITY_NOTE}</small></div>${QUALITY_CHOICES.map(([k, name]) => `<button class="btn ${q === k ? 'good' : 'ghost'}" data-act="quality" data-a="${k}">${name}</button>`).join(' ')}</div>`;
    h += '<div class="center">';
    h += this.confirmReset
      ? '<b>Delete your save and start again?</b><br><br><button class="btn warn" data-act="resetyes">Yes, start again</button> <button class="btn ghost" data-act="resetno">No</button>'
      : '<button class="btn ghost" data-act="reset">Start again</button>';
    return h + '</div>';
  }

  private ice(s: GameState): string {
    if (!s.upgrades.icebox) return this.head('Ice box', `You do not have an ice box yet. Buy one at the shipyard for $${UPGRADES.icebox.cost}. Fish stay fresh 4 times longer.`);
    const hand = handCrates(s), ice = iceCrates(s);
    let h = this.head(`Ice box (${ice.length}/${ICE_CAPACITY})`, 'Crates on ice go bad 4 times slower.');
    h += '<h3>In your hands</h3>';
    if (!hand.length) h += '<div class="row"><div class="grow"><small>Nothing.</small></div></div>';
    for (const c of hand) h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[c.species]), 22)}<div class="grow"><b>${FISH_NAME[c.species]}</b>${bar(c.freshness)}</div><button class="btn" data-act="store" data-a="${c.id}">Put on ice</button></div>`;
    h += '<h3>On ice</h3>';
    if (!ice.length) h += '<div class="row"><div class="grow"><small>Empty.</small></div></div>';
    for (const c of ice) h += `<div class="row">${fishSvg(hex(SPECIES_COLOUR[c.species]), 22)}<div class="grow"><b>${FISH_NAME[c.species]}</b>${bar(c.freshness)}</div><button class="btn" data-act="take" data-a="${c.id}">Take out</button></div>`;
    return h;
  }

  private summaryHtml(): string {
    const m = this.summary;
    if (!m) return '';
    const st = m.stats, s = this.getState();
    const net = netProfit(st);
    const rows = SPECIES.filter((sp) => st.income[sp] > 0).map((sp) => `<div class="stat sub1"><span>${fishSvg(hex(SPECIES_COLOUR[sp]), 14)} ${FISH_NAME[sp]}</span><b>+$${st.income[sp]}</b></div>`).join('');
    const rp = rankProgress(s);
    const r = rankOf(s);
    return `<h2>Day ${m.day}: day report</h2><p class="sub">06:00. A new day starts.</p>
      <h3>${LABEL.moneyIn}</h3>${rows || '<div class="stat sub1"><span>No sales</span><b>$0</b></div>'}
      <div class="stat sub1"><span>Order bonuses (${st.filled} done, ${st.missed} late)</span><b>+$${st.bonus}</b></div>
      <h3>${LABEL.moneyOut}</h3>
      <div class="stat sub1"><span>Pay for workers and captains</span><b>-$${st.wages}</b></div>
      <div class="stat sub1"><span>Trip costs</span><b>-$${st.tripCosts}</b></div>
      <div class="stat sub1"><span>Upgrades and boats</span><b>-$${st.spent}</b></div>
      <div class="stat sub1"><span>Crates that went bad</span><b>${st.spoiled}</b></div>
      <div class="stat total ${net >= 0 ? 'up' : 'down'}"><span>Profit for the day</span><b>${net >= 0 ? '+' : '-'}$${Math.abs(net)}</b></div>
      <div class="stat sub1"><span>Best sale</span><b>${st.best.species ? `${FISH_NAME[st.best.species]} $${st.best.price}` : '-'}</b></div>
      <h3>${LABEL.rank}: ${RANK_NAME[r]}</h3>
      ${rp ? `<div class="rankbar"><i style="width:${Math.round(rp.frac * 100)}%"></i></div><small>You have earned $${rp.have.toLocaleString()} of $${rp.need.toLocaleString()} to reach ${RANK_NAME[rp.next]}. New then: ${RANK_UNLOCKS[rp.next]}.</small>` : '<small>You are at the top rank. The weathervane is gold.</small>'}
      <div class="center"><button class="btn good" data-act="close">Start the day</button></div>`;
  }
}
