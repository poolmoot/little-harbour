import type { Track, UpgradeId, ZoneId } from '../sim/config';
import type { DayStats, GameState, HaulPolicy } from '../sim/state';
import { boatScreen } from './screens/boat';
import { crewScreen } from './screens/crew';
import { iceboxScreen } from './screens/icebox';
import { ledgerScreen } from './screens/ledger';
import { logbookScreen } from './screens/logbook';
import { marketScreen } from './screens/market';
import { noticesScreen } from './screens/notices';
import { shipyardScreen } from './screens/shipyard';
import type { Screen, ScreenView } from './screens/types';

export type PanelKind = 'boat' | 'hire' | 'market' | 'shipyard' | 'board' | 'logbook' | 'ice' | 'summary';

const SCREENS: Record<PanelKind, Screen> = {
  boat: boatScreen,
  hire: crewScreen,
  market: marketScreen,
  shipyard: shipyardScreen,
  board: noticesScreen,
  logbook: logbookScreen,
  ice: iceboxScreen,
  summary: ledgerScreen,
};

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
  resetGame(): void;
  onClose(): void;
}

/** Seconds between live re-renders, so countdowns and prices stay current. */
const REFRESH_SECONDS = 0.4;
/** How long the "just opened" entrance animation class stays on the window. */
const FRESH_MS = 420;

function frame(v: ScreenView): string {
  const tabs = v.tabs
    ? `<nav class="tabs">${v.tabs.map((t) => `<button class="tab ol${t.id === v.tab ? ' on' : ''}" data-act="tab" data-a="${t.id}">${t.label}</button>`).join('')}</nav>`
    : '';
  return `<header class="win-head"><div class="win-title ol">${v.icon}${v.title}</div>${tabs}<button class="btn danger ol win-close" data-act="close" aria-label="Close">×</button></header>
    ${v.note ? `<p class="win-note">${v.note}</p>` : ''}<div class="win-body">${v.body}</div>${v.foot ? `<footer class="win-foot">${v.foot}</footer>` : ''}`;
}

/** The window manager: owns which screen is open, draws it in a floating window and routes button presses to game actions. */
export class Panels {
  private overlay = document.createElement('div');
  private win = document.createElement('div');
  private kind: PanelKind | null = null;
  private arg = 0;
  private tab = '';
  private summary: { day: number; stats: DayStats } | null = null;
  private confirmReset = false;
  private lastUpdate = 0;
  private last = '';
  private freshTimer = 0;

  constructor(root: HTMLElement, private actions: PanelActions, private getState: () => GameState) {
    this.overlay.className = 'overlay';
    this.win.className = 'win pn';
    this.overlay.appendChild(this.win);
    root.appendChild(this.overlay);
    this.overlay.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.overlay) {
        this.close();
        return;
      }
      const b = t.closest('[data-act]') as HTMLElement | null;
      if (!b || b.classList.contains('off')) return;
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
    this.tab = '';
    this.confirmReset = false;
    this.overlay.classList.add('open');
    this.render(true);
    this.playEntrance();
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
    if (!this.kind || performance.now() / 1000 - this.lastUpdate < REFRESH_SECONDS) return;
    this.render(false);
  }
  refresh(): void {
    if (this.kind) this.render(true);
  }

  private act(act: string, a: string, b: string): void {
    switch (act) {
      case 'close': this.close(); break;
      case 'tab': this.tab = a; this.render(true); this.playEntrance(); break;
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
      case 'reset': this.confirmReset = true; this.render(true); break;
      case 'resetno': this.confirmReset = false; this.render(true); break;
      case 'resetyes': this.actions.resetGame(); break;
    }
  }

  private playEntrance(): void {
    this.win.classList.remove('fresh');
    void this.win.offsetWidth; // restart the CSS animation
    this.win.classList.add('fresh');
    clearTimeout(this.freshTimer);
    this.freshTimer = window.setTimeout(() => this.win.classList.remove('fresh'), FRESH_MS);
  }

  private render(force: boolean): void {
    if (!this.kind) return;
    this.lastUpdate = performance.now() / 1000;
    const html = frame(SCREENS[this.kind]({ state: this.getState(), arg: this.arg, tab: this.tab, confirmReset: this.confirmReset, summary: this.summary }));
    if (!force && html === this.last) return;
    this.last = html;
    // Keep the reader's place when live data re-renders the list.
    const scroll = this.win.querySelector('.win-body')?.scrollTop ?? 0;
    this.win.innerHTML = html;
    const body = this.win.querySelector('.win-body');
    if (body) body.scrollTop = scroll;
  }
}
