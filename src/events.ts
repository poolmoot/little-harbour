import { LAYOUT } from './sim/config';
import type { Ev, GameState } from './sim/sim';
import type { DayStats } from './sim/state';
import type { GameAudio } from './audio/index';
import type { Hud } from './ui/hud';
import { MENU } from './ui/menuText';
import { RANK_NAME, denyText, say } from './ui/text';

export interface EventDeps {
  audio: GameAudio;
  hud: Hud;
  showSummary(day: number, stats: DayStats): void;
  getState(): GameState;
  /** Floating text at a world position. */
  popAt(x: number, y: number, z: number, text: string): void;
  /** Save now and restart the autosave timer. */
  saveNow(): void;
}

/** Turns sim events into sounds, toasts, pop-ups and saves. */
export class EventRouter {
  now = 0;
  recentFilled = -99;
  recentMissed = -99;
  private staffSold = 0;
  private lastStaffPop = 0;

  constructor(private d: EventDeps) {
    d.audio.onMuteChange = (muted) => d.hud.toast(muted ? MENU.soundOff : MENU.soundOn);
  }

  handle(evs: Ev[]): void {
    let soldCount = 0, soldTotal = 0, saveNow = false;
    const a = this.d.audio, h = this.d.hud;
    for (const e of evs) {
      switch (e.type) {
        case 'boatDispatched':
          if (e.auto) break;
          a.fx.boatLeave();
          h.toast(say.sailed(e.zone, e.cost));
          break;
        case 'boatReturned':
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
        case 'crateStored': a.fx.crateIce(); break;
        case 'crateTaken': a.fx.cratePickUp(); break;
        case 'crateSold':
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
        case 'fishLanded':
          a.fx.land();
          h.toast(say.caught(e.species), 'good');
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
          a.fx.rankUp();
          h.banner(RANK_NAME[e.rank], say.rankUp(e.rank));
          saveNow = true;
          break;
        case 'phaseChanged':
          if (e.phase === 'dawn') a.dawn();
          if (e.phase === 'night') h.toast(say.nightFalls);
          break;
        case 'dayEnded':
          a.dayReport();
          this.d.showSummary(e.day, e.stats);
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
