import { LAYOUT } from './sim/config';
import type { WeatherId } from './sim/config';
import type { Ev, GameState } from './sim/sim';
import type { DayStats } from './sim/state';
import type { GameAudio } from './audio/index';
import type { Hud } from './ui/hud';
import type { PanelKind } from './ui/panels';
import { MENU } from './ui/menuText';
import { CAPTAIN_TEXT, SAY2, TOWN_TEXT } from './ui/screenText';
import { AWAY, FISH_BOOK, FISH_NAME, KING, NAME_TOAST, RANK_NAME, ZONE_NAME, denyText, say, sayTycoon } from './ui/text';
import { crateSize, crateStars } from './sim/fishbook';
import { catchCheer } from './audio/town';
import { weatherRain } from './view/townRules';

/** How loud each weather layer is for a kind of weather (0 to 1). */
export function weatherSound(w: WeatherId): { rain: number; wind: number; fog: number } {
  switch (w) {
    case 'storm': return { rain: weatherRain(w), wind: 1, fog: 0 };
    case 'wind': return { rain: 0, wind: 0.35, fog: 0 };
    case 'fog': return { rain: 0, wind: 0, fog: 1 };
    default: return { rain: 0, wind: 0, fog: 0 };
  }
}

export interface EventDeps {
  audio: GameAudio;
  hud: Hud;
  showSummary(day: number, stats: DayStats): void;
  /** Open a window (the ending screen). */
  openPanel(kind: PanelKind): void;
  getState(): GameState;
  /** Floating text at a world position. */
  popAt(x: number, y: number, z: number, text: string): void;
  /** Save now and restart the autosave timer. */
  saveNow(): void;
  /** Told about every batch of events, for the town's life in the drawing code. */
  watch?(evs: Ev[]): void;
  /** An unlock card is ready to show. */
  guideUnlock?(id: string): void;
}

/** Turns sim events into sounds, toasts, pop-ups and saves. */
export class EventRouter {
  now = 0;
  recentFilled = -99;
  recentMissed = -99;
  private staffSold = 0;
  private lastStaffPop = 0;
  private lastToast: Record<string, number> = {};

  constructor(private d: EventDeps) {
    d.audio.onMuteChange = (muted) => d.hud.toast(muted ? MENU.soundOff : MENU.soundOn);
  }

  /** Set the rain, storm-wind and fog sound layers for this weather (on load and when the day changes). */
  syncWeather(w: WeatherId): void {
    const v = weatherSound(w);
    this.d.audio.setRain(v.rain);
    this.d.audio.setStormWind(v.wind);
    this.d.audio.setFog(v.fog);
    this.syncTown();
  }

  /** Tell the audio how busy the town is (rank and market day), on load and when they change. */
  private syncTown(): void {
    const st = this.d.getState();
    this.d.audio.setTownState({ rank: st.rank, marketDay: st.special?.kind === 'market' });
  }

  /** True at most once every `secs` seconds for a key, so busy workers do not flood the screen with toasts. */
  private due(key: string, secs: number): boolean {
    if (this.now - (this.lastToast[key] ?? -99) < secs) return false;
    this.lastToast[key] = this.now;
    return true;
  }

  private boatName(id: number): string {
    return this.d.getState().boats.find((b) => b.id === id)?.name ?? 'The boat';
  }

  handle(evs: Ev[]): void {
    let soldCount = 0, soldTotal = 0, saveNow = false;
    const a = this.d.audio, h = this.d.hud;
    this.d.watch?.(evs);
    for (const e of evs) {
      switch (e.type) {
        case 'boatDispatched':
          if (e.auto) break;
          a.fx.boatLeave();
          h.toast(say.sailed(e.zone, e.cost));
          break;
        case 'boatReturned':
          // A big catch gets a cheer, whether the player or a captain sent the boat.
          if (catchCheer(e.count) > 0) a.fx.cheer(1);
          if (e.auto) break;
          a.fx.boatReturn();
          h.toast(say.returned(e.count), 'good');
          break;
        case 'boatUnloaded':
          if (e.auto) break;
          a.fx.unload();
          h.toast(say.unloaded(e.count));
          break;
        case 'cratePicked': a.fx.cratePickUp(); break;
        case 'crateTaken': a.fx.cratePickUp(); break;
        case 'crateSold':
          a.noteSale(1);
          if (e.staff) { this.staffSold += e.price; break; }
          soldCount++;
          soldTotal += e.price;
          saveNow = true;
          break;
        case 'crateSpoiled':
          a.fx.spoil();
          h.toast(say.spoiled(e.species), 'warn');
          break;
        case 'crateDiscarded':
          h.toast(say.discarded(e.species), 'warn');
          break;
        case 'orderPosted':
          h.toast(say.orderPosted);
          break;
        case 'orderFilled':
          this.recentFilled = this.now;
          this.d.popAt(LAYOUT.noticeBoard.x, 2.6, LAYOUT.noticeBoard.z, say.bonusPop(e.bonus));
          a.fx.orderFilled();
          h.toast(say.orderDone(e.name, e.bonus), 'good');
          break;
        case 'orderMissed':
          this.recentMissed = this.now;
          a.fx.orderMissed();
          h.toast(say.orderLate(e.name), 'warn');
          break;
        case 'castStarted': a.fx.cast(); break;
        case 'biteStarted': a.fx.bite(); break;
        case 'fishLanded': {
          a.fx.land();
          // The newest crate of that kind in hand is the one just landed. A golden one gets its own toast below.
          const c = this.d.getState().crates.filter((k) => k.species === e.species && k.loc === 'hand').sort((x, y) => y.id - x.id)[0];
          if (c?.golden) break;
          h.toast(c ? FISH_BOOK.landed(e.species, crateSize(c), crateStars(c)) : say.caught(e.species), 'good');
          break;
        }
        case 'goldenCaught':
          a.fx.cheer(2);
          a.fx.goalComplete();
          a.fx.coins(400);
          if (this.due('golden', 3)) h.banner(FISH_BOOK.goldenBanner(FISH_NAME[e.species]), FISH_BOOK.goldenBannerSub);
          h.toast(FISH_BOOK.goldenToast(FISH_NAME[e.species]), 'good');
          break;
        case 'bookReward':
          a.fx.goalComplete();
          h.toast((e.kind === 'caught' ? FISH_BOOK.rewardCaught : FISH_BOOK.rewardStars)(ZONE_NAME[e.zone], e.amount), 'good');
          saveNow = true;
          break;
        case 'awayEarnings':
          a.fx.coins(e.earned);
          h.toast(AWAY.earned(e.earned), 'good');
          saveNow = true;
          break;
        case 'harbourRenamed':
          a.fx.upgrade();
          h.toast(NAME_TOAST.harbour(e.name), 'good');
          saveNow = true;
          break;
        case 'boatRenamed':
          a.fx.upgrade();
          h.toast(NAME_TOAST.boat(e.name), 'good');
          saveNow = true;
          break;
        case 'fishLost':
          if (e.reason === 'cancelled') break;
          a.fx.lose();
          h.toast(e.reason === 'early' ? say.lostEarly : e.reason === 'late' ? say.lostLate : say.lostFull, 'warn');
          break;
        case 'upgradeBought':
          a.fx.upgrade();
          h.toast(say.bought(e.id), 'good');
          saveNow = true;
          break;
        case 'boatUpgraded':
          a.fx.upgrade();
          h.toast(say.boatBetter(this.d.getState().boats.find((b) => b.id === e.boatId)?.name ?? 'The boat'), 'good');
          saveNow = true;
          break;
        case 'boatBought':
          a.fx.upgrade();
          h.toast(say.boatBought, 'good');
          saveNow = true;
          break;
        case 'hired': a.fx.hire(); h.toast(say.hired(e.name, e.role), 'good'); saveNow = true; break;
        case 'fired': a.fx.fire(); h.toast(say.fired(e.name)); saveNow = true; break;
        case 'wagesPaid':
          if (e.unpaid > 0) h.toast(say.unpaid(e.unpaid), 'warn');
          break;
        case 'rankUp':
          this.syncTown();
          a.fx.rankUp();
          h.banner(RANK_NAME[e.rank], say.rankUp(e.rank));
          saveNow = true;
          break;
        case 'phaseChanged':
          if (e.phase === 'dawn') a.dawn();
          if (e.phase === 'night') h.toast(say.nightFalls);
          break;
        case 'workersSleep':
          h.toast(say.workersSleep);
          break;
        case 'workersWake':
          h.toast(say.workersWake);
          break;
        case 'dayEnded':
          a.dayReport();
          this.d.showSummary(e.day, e.stats);
          saveNow = true;
          break;
        case 'guideStep':
          if (e.index > 0) a.fx.upgrade();
          break;
        case 'guideUnlock':
          this.d.guideUnlock?.(e.id);
          break;
        case 'goalDone':
          a.fx.goalComplete();
          h.goalDone(e.reward);
          h.toast(sayTycoon.goalDone(e.reward), 'good');
          saveNow = true;
          break;
        case 'projectDone':
          a.fx.buildingBuilt();
          h.toast(TOWN_TEXT.doneToast(TOWN_TEXT.project[e.id].name), 'good');
          saveNow = true;
          break;
        case 'captainLevelUp':
          a.fx.goalComplete();
          h.toast(CAPTAIN_TEXT.levelUp(e.name, e.level), 'good');
          saveNow = true;
          break;
        case 'buildingBuilt':
          if (e.level === 1) a.fx.buildingBuilt(); else a.fx.buildingUpgraded();
          h.toast(sayTycoon.built(e.id, e.level), 'good');
          saveNow = true;
          break;
        case 'crateSmoking':
          a.fx.crateIce();
          if (this.due('smoking', 4)) h.toast(sayTycoon.smoking);
          break;
        case 'crateSmoked':
          a.fx.cratePickUp();
          if (this.due('smoked', 4)) h.toast(sayTycoon.smoked, 'good');
          break;
        case 'restaurantServed': {
          const door = LAYOUT.plots.restaurant;
          if (e.staff) {
            if (this.due('served', 3)) { a.fx.coins(e.price); this.d.popAt(door.x, 3, door.z, `+$${e.price}`); }
          } else {
            a.fx.coins(e.price);
            this.d.popAt(door.x, 3, door.z, `+$${e.price}`);
            h.toast(sayTycoon.served(e.species, e.price), 'good');
          }
          saveNow = true;
          break;
        }
        case 'weatherChanged':
          this.syncWeather(e.weather);
          h.toast(sayTycoon.newDay(e.weather, e.special, e.tomorrowWeather, e.tomorrowSpecial));
          if (e.special?.kind === 'market') { a.fx.marketDay(); h.toast(SAY2.marketDay, 'good'); }
          else if (e.special?.kind === 'bigcatch') h.toast(SAY2.bigCatch, 'good');
          if (e.tomorrowWeather === 'storm') { a.fx.stormWarning(); h.toast(SAY2.stormComing, 'warn'); }
          break;
        case 'boatDamaged':
          a.fx.boatDamaged();
          h.toast(sayTycoon.damaged(this.boatName(e.boatId)), 'warn');
          saveNow = true;
          break;
        case 'boatRepairStarted':
          a.fx.upgrade();
          h.toast(sayTycoon.repairing(this.boatName(e.boatId)));
          saveNow = true;
          break;
        case 'boatRepaired':
          a.fx.boatReturn();
          h.toast(sayTycoon.repaired(this.boatName(e.boatId)), 'good');
          saveNow = true;
          break;
        case 'contractOffered': h.toast(sayTycoon.offered); break;
        case 'contractAccepted':
          a.fx.contractAccepted();
          h.toast(sayTycoon.accepted);
          saveNow = true;
          break;
        case 'contractDone':
          a.fx.contractDone();
          h.toast(sayTycoon.contractDone(e.reward), 'good');
          saveNow = true;
          break;
        case 'contractFailed':
          a.fx.contractMissed();
          h.toast(sayTycoon.contractFailed, 'warn');
          saveNow = true;
          break;
        case 'kingFishFound':
          a.fx.cheer(3);
          a.fx.kingFishCaught();
          h.banner(SAY2.kingBanner, SAY2.kingBannerSub);
          h.toast(KING.found, 'good');
          saveNow = true;
          break;
        case 'endingReached':
          a.fx.cheer(3);
          a.fx.ending();
          this.d.openPanel('ending');
          saveNow = true;
          break;
        case 'denied':
          a.fx.deny();
          h.toast(denyText(e.reason, e.needRank), 'warn');
          break;
      }
    }
    if (soldCount > 0) {
      this.d.popAt(LAYOUT.market.x, 2.9, LAYOUT.market.z + 1.2, `+$${soldTotal}`);
      a.fx.coins(soldTotal);
      h.toast(say.sold(soldCount, soldTotal), 'good');
    }
    if (this.staffSold > 0 && this.now - this.lastStaffPop > 1.2) {
      this.d.popAt(LAYOUT.market.x, 2.9, LAYOUT.market.z + 1.2, `+$${this.staffSold}`);
      this.staffSold = 0;
      this.lastStaffPop = this.now;
    }
    if (saveNow) {
      this.d.saveNow();
    }
  }

}
