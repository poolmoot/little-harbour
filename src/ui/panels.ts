import type { BuildingId, ProjectId, Species, Track, UpgradeId, ZoneId } from '../sim/config';
import type { DayStats, GameState } from '../sim/state';
import type { AudioSettings, VolumeKey } from '../audio/settings';
import type { QualityMode } from '../view/quality';
import { money, nameFeedback } from './components';
import { isMenuKind } from './menuFlow';
import { LABEL } from './text';
import { awayScreen } from './screens/away';
import { countedUp } from './awayFlow';
import { berthScreen } from './screens/berth';
import { boatScreen } from './screens/boat';
import { crewScreen } from './screens/crew';
import { ledgerScreen } from './screens/ledger';
import { logbookScreen } from './screens/logbook';
import { marketScreen } from './screens/market';
import { noticesScreen } from './screens/notices';
import { endingScreen } from './screens/ending';
import { helpScreen, tipsScreen, welcomeScreen } from './screens/guide';
import type { Consent } from '../analytics';
import { howtoScreen } from './screens/howto';
import { privacyScreen, termsScreen } from './screens/legal';
import { plotScreen } from './screens/plot';
import { pauseScreen } from './screens/pause';
import { settingsScreen } from './screens/settings';
import { shipyardScreen } from './screens/shipyard';
import { titleScreen } from './screens/title';
import type { AwayInfo, Screen, ScreenView } from './screens/types';

export type PanelKind = 'boat' | 'hire' | 'market' | 'shipyard' | 'board' | 'logbook' | 'summary' | 'title' | 'pause' | 'settings' | 'howto' | 'plot' | 'ending' | 'away' | 'welcome' | 'help' | 'tips' | 'berth' | 'privacy' | 'terms';

const SCREENS: Record<PanelKind, Screen> = {
  boat: boatScreen,
  hire: crewScreen,
  market: marketScreen,
  shipyard: shipyardScreen,
  board: noticesScreen,
  logbook: logbookScreen,
  summary: ledgerScreen,
  title: titleScreen,
  pause: pauseScreen,
  settings: settingsScreen,
  howto: howtoScreen,
  privacy: privacyScreen,
  terms: termsScreen,
  plot: plotScreen,
  ending: endingScreen,
  away: awayScreen,
  welcome: welcomeScreen,
  help: helpScreen,
  tips: tipsScreen,
  berth: berthScreen,
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
  /** Build a building, or upgrade it. */
  build(id: BuildingId): void;
  buildProject(id: ProjectId): void;
  smokeIn(crateId: number): void;
  smokeOut(crateId: number): void;
  sellToRestaurant(crateId: number): void;
  setSmoke(species: Species, on: boolean): void;
  setStayHome(boatId: number, stay: boolean): void;
  repair(boatId: number): void;
  renameBoat(boatId: number, name: string): void;
  setHarbourName(name: string): void;
  acceptContract(contractId: number): void;
  getQuality(): QualityMode;
  setQuality(m: QualityMode): void;
  resetGame(): void;
  getAudio(): Readonly<AudioSettings>;
  setVolume(key: VolumeKey, v: number): void;
  setMuted(muted: boolean): void;
  /** True when a saved game exists. */
  hasSave(): boolean;
  /** What the harbour earned while the player was away, for the welcome-back window. */
  getAway(): AwayInfo | null;
  continueGame(): void;
  newGame(): void;
  resume(): void;
  toTitle(): void;
  onClose(): void;
  /** A window was opened (the guide notices the notice board). */
  onOpen(kind: PanelKind): void;
  getConsent(): Consent;
  setConsent(on: boolean): void;
  getGuideTips(): boolean;
  setGuideTips(on: boolean): void;
  /** Show a guide card and its trail again (from the help list). */
  replayGuide(key: string): void;
}

/** Seconds between live re-renders, so countdowns and prices stay current. */
const REFRESH_SECONDS = 0.4;
/** How long the "just opened" entrance animation class stays on the window. */
const FRESH_MS = 420;

function frame(v: ScreenView): string {
  const tabs = v.tabs
    ? `<nav class="tabs">${v.tabs.map((t) => `<button class="tab ol${t.id === v.tab ? ' on' : ''}" data-act="tab" data-a="${t.id}">${t.label}</button>`).join('')}</nav>`
    : '';
  const close = v.menu ? '' : `<button class="btn danger ol win-close" data-act="close" aria-label="${LABEL.close}" title="${LABEL.close}">×</button>`;
  const head = v.bare ? '' : `<header class="win-head"><div class="win-title ol">${v.icon}${v.title}</div>${tabs}${close}</header>`;
  return `${head}<div class="win-body">${v.body}</div>${v.note ? `<p class="win-note">${v.note}</p>` : ''}${v.foot ? `<footer class="win-foot">${v.foot}</footer>` : ''}`;
}

/** The window manager: owns which screen is open, draws it in a floating window and routes button presses to game actions. */
export class Panels {
  private overlay = document.createElement('div');
  private wrap = document.createElement('div');
  private host = document.createElement('img');
  private win = document.createElement('div');
  private kind: PanelKind | null = null;
  private arg = 0;
  private tab = '';
  private summary: { day: number; stats: DayStats } | null = null;
  private confirmReset = false;
  private confirmNew = false;
  /** Where Back goes from settings or how to play: the title screen or the pause menu. */
  private returnTo: PanelKind = 'title';
  private lastUpdate = 0;
  private last = '';
  private freshTimer = 0;
  private openedAt = 0;

  constructor(root: HTMLElement, private actions: PanelActions, private getState: () => GameState) {
    this.overlay.className = 'overlay';
    this.wrap.className = 'win-wrap';
    this.host.className = 'win-host';
    this.host.alt = '';
    this.win.className = 'win pn';
    this.wrap.append(this.host, this.win);
    this.overlay.appendChild(this.wrap);
    root.appendChild(this.overlay);
    this.overlay.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.overlay) {
        if (!isMenuKind(this.kind)) this.close();
        return;
      }
      const b = t.closest('[data-act]') as HTMLElement | null;
      if (!b || b.classList.contains('off')) return;
      e.preventDefault();
      this.act(b.dataset.act ?? '', b.dataset.a ?? '', b.dataset.b ?? '');
    });
    // Sliders change the setting as they move; the number and fill are updated in place so a drag is never interrupted by a redraw.
    this.overlay.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      const id = el.dataset.slider;
      if (!id) return;
      const pct = Number(el.value);
      el.style.setProperty('--fill', `${pct}%`);
      const val = el.nextElementSibling;
      if (val) val.textContent = `${pct}%`;
      this.actions.setVolume(id as VolumeKey, pct / 100);
    });
    // Name fields: check as you type, Enter saves, Esc puts the old name back. (The game's own keys ignore text fields: see input.ts.)
    this.overlay.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.field) this.checkField(el);
    });
    this.overlay.addEventListener('keydown', (e) => {
      const el = e.target as HTMLInputElement;
      if (!el.dataset?.field) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (nameFeedback(el.value).ok) this.act(el.dataset.save ?? '', el.dataset.a ?? '', el.dataset.b ?? '');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        el.value = el.dataset.orig ?? '';
        this.checkField(el);
        el.blur();
      }
    });
    // Let go of a slider: hand the keyboard back to the game (so M works) and redraw.
    window.addEventListener('pointerup', () => {
      const a = document.activeElement as HTMLElement | null;
      if (a && a.matches('input[type="range"]') && this.win.contains(a)) {
        a.blur();
        this.refresh();
      }
    });
  }

  get current(): PanelKind | null {
    return this.kind;
  }
  isOpen(): boolean {
    return this.kind !== null;
  }

  open(kind: PanelKind, arg = 0): void {
    this.focusedField()?.blur();
    this.kind = kind;
    this.arg = arg;
    this.tab = '';
    this.confirmReset = false;
    this.confirmNew = false;
    this.openedAt = performance.now();
    this.overlay.classList.add('open');
    this.render(true);
    this.playEntrance();
    this.actions.onOpen(kind);
  }

  showSummary(day: number, stats: DayStats): void {
    this.summary = { day, stats };
    this.open('summary');
  }

  close(): void {
    this.focusedField()?.blur();
    if (!this.kind) return;
    this.kind = null;
    this.overlay.classList.remove('open');
    this.actions.onClose();
  }

  /** Leave settings or how to play for the screen that opened it. */
  back(): void {
    if (this.kind === 'settings' || this.kind === 'howto' || this.kind === 'tips' || this.kind === 'privacy' || this.kind === 'terms') this.open(this.returnTo);
  }

  toggle(kind: PanelKind): void {
    if (this.kind === kind) this.close();
    else this.open(kind);
  }

  /** Re-render (throttled) so countdowns and prices stay live. */
  update(): void {
    if (this.kind === 'away') { this.tickCount(); return; }
    // Menu screens hold no live numbers, and redrawing one would interrupt a slider drag.
    if (!this.kind || isMenuKind(this.kind) || performance.now() / 1000 - this.lastUpdate < REFRESH_SECONDS) return;
    this.render(false);
  }
  /** The welcome-back money counts up in place, so the window is not redrawn every frame. */
  private tickCount(): void {
    const el = this.win.querySelector<HTMLElement>('[data-count]');
    if (!el) return;
    const total = Number(el.dataset.count);
    const text = `+$${money(countedUp(total, (performance.now() - this.openedAt) / 1000))}`;
    const node = el.lastChild;
    if (node && node.nodeType === Node.TEXT_NODE && node.textContent !== text) node.textContent = text;
  }

  refresh(): void {
    // Never redraw under a slider that is being dragged or held with the keyboard.
    const held = document.activeElement as HTMLElement | null;
    if (held && held.matches('input[type="range"]') && this.win.contains(held)) return;
    if (this.kind) this.render(true);
  }

  /** The name field that has the keyboard, if any. */
  private focusedField(): HTMLInputElement | null {
    const f = document.activeElement as HTMLInputElement | null;
    return f && f.dataset?.field && this.win.contains(f) ? f : null;
  }

  /** Show the plain message for the typed name and grey out Save when it is not allowed. */
  private checkField(el: HTMLInputElement): void {
    const fb = nameFeedback(el.value);
    const box = el.closest('.tf');
    if (!box) return;
    box.classList.toggle('bad', !fb.ok);
    const msg = box.querySelector('.tf-msg');
    if (msg) msg.textContent = fb.message;
    box.querySelector('.btn')?.classList.toggle('off', !fb.ok);
  }

  /** Enter presses the open window's main (hero) button, when it has one that can be pressed. Returns whether it did. */
  pressMain(): boolean {
    const b = this.win.querySelector<HTMLElement>('.btn.hero:not(.off)');
    if (!this.kind || !b) return false;
    this.act(b.dataset.act ?? '', b.dataset.a ?? '', b.dataset.b ?? '');
    return true;
  }

  private act(act: string, a: string, b: string): void {
    // A button press ends the typing: take what was typed, then hand the keyboard back so the window can redraw.
    const typed = this.focusedField()?.value ?? '';
    this.focusedField()?.blur();
    switch (act) {
      case 'renameboat': this.actions.renameBoat(Number(a), typed); return;
      case 'renameharbour': this.actions.setHarbourName(typed); return;
    }
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
      case 'openboat': this.open('boat', Number(a)); break;
      case 'build': this.actions.build(a as BuildingId); break;
      case 'project': this.actions.buildProject(a as ProjectId); break;
      case 'smokein': this.actions.smokeIn(Number(a)); break;
      case 'smokeout': this.actions.smokeOut(Number(a)); break;
      case 'restsell': this.actions.sellToRestaurant(Number(a)); break;
      case 'smokelist': this.actions.setSmoke(a as Species, b === '1'); break;
      case 'stayhome': this.actions.setStayHome(Number(a), b === '1'); break;
      case 'repair': this.actions.repair(Number(a)); break;
      case 'accept': this.actions.acceptContract(Number(a)); break;
      case 'quality': this.actions.setQuality(a as QualityMode); break;
      case 'reset': this.confirmReset = true; this.render(true); break;
      case 'resetno': this.confirmReset = false; this.render(true); break;
      case 'resetyes': this.actions.resetGame(); break;
      case 'settings': case 'howto': case 'tips': case 'privacy': case 'terms':
        this.returnTo = this.kind === 'pause' ? 'pause' : 'title';
        this.open(act);
        break;
      case 'menuback': this.back(); break;
      case 'consent': this.actions.setConsent(this.actions.getConsent() !== 'granted'); this.render(true); break;
      case 'consent-yes': this.actions.setConsent(true); this.render(true); break;
      case 'consent-no': this.actions.setConsent(false); this.render(true); break;
      case 'guidetips': this.actions.setGuideTips(!this.actions.getGuideTips()); this.render(true); break;
      case 'welcomeskip': this.actions.setGuideTips(false); this.close(); break;
      case 'guidereplay': this.actions.replayGuide(a); break;
      case 'mute': this.actions.setMuted(!this.actions.getAudio().muted); this.render(true); break;
      case 'continue': this.actions.continueGame(); break;
      case 'newgame':
        if (this.actions.hasSave()) { this.confirmNew = true; this.render(true); } else this.actions.newGame();
        break;
      case 'newyes': this.actions.newGame(); break;
      case 'newno': this.confirmNew = false; this.render(true); break;
      case 'resume': this.actions.resume(); break;
      case 'totitle': this.actions.toTitle(); break;
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
    // Never redraw under a name field that is being typed in.
    if (this.focusedField()) return;
    this.lastUpdate = performance.now() / 1000;
    const view = SCREENS[this.kind]({
      state: this.getState(), arg: this.arg, tab: this.tab, confirmReset: this.confirmReset, quality: this.actions.getQuality(), summary: this.summary,
      hasSave: this.actions.hasSave(), guideTips: this.actions.getGuideTips(), consent: this.actions.getConsent(), confirmNew: this.confirmNew, audio: this.actions.getAudio(),
      away: this.kind === 'away' ? this.actions.getAway() : null, age: (performance.now() - this.openedAt) / 1000,
    });
    const html = frame(view);
    this.wrap.classList.toggle('has-host', !!view.host);
    if (view.host && this.host.getAttribute('src') !== view.host) this.host.src = view.host;
    if (!force && html === this.last) return;
    this.last = html;
    this.overlay.classList.toggle('menu', !!view.menu);
    this.win.classList.toggle('menu', !!view.menu);
    this.win.classList.toggle('wide', this.kind === 'settings' || this.kind === 'howto' || this.kind === 'tips' || this.kind === 'privacy' || this.kind === 'terms');
    // Keep the reader's place when live data re-renders the list.
    const scroll = this.win.querySelector('.win-body')?.scrollTop ?? 0;
    this.win.innerHTML = html;
    const body = this.win.querySelector('.win-body');
    if (body) body.scrollTop = scroll;
  }
}
