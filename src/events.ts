import { LAYOUT } from './sim/config';
import type { Ev, GameState } from './sim/sim';
import type { DayStats } from './sim/state';
import type { GameAudio } from './audio';
import type { Hud } from './ui/hud';
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

  constructor(private d: EventDeps) {}

  handle(evs: Ev[]): void {
    let soldCount = 0, soldTotal = 0, saveNow = false;
    const a = this.d.audio, h = this.d.hud;
    for (const e of evs) {
      switch (e.type) {
        case 'boatDispatched':
          if (e.auto) break;
          a.click();
          h.toast(say.sailed(e.zone, e.cost));
          break;
        case 'boatReturned':
          if (e.auto) break;
          a.bell();
          h.toast(say.returned(e.count), 'good');
          break;
        case 'boatUnloaded':
          if (e.auto) break;
          a.pop();
          h.toast(say.unloaded(e.count));
          break;
        case 'cratePicked': a.pop(); break;
        case 'crateStored':
        case 'crateTaken': a.pop(); break;
        case 'crateSold':
          if (e.staff) { this.staffSold += e.price; break; }
          soldCount++;
          soldTotal += e.price;
          saveNow = true;
          break;
        case 'crateSpoiled':
          a.spoil();
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
          a.coin();
          h.toast(say.orderDone(e.name, e.bonus), 'good');
          break;
        case 'orderMissed':
          this.recentMissed = this.now;
          a.deny();
          h.toast(say.orderLate(e.name), 'warn');
          break;
        case 'castStarted': a.cast(); break;
        case 'biteStarted': a.splash(); break;
        case 'fishLanded':
          a.pop();
          h.toast(say.caught(e.species), 'good');
          break;
        case 'fishLost':
          if (e.reason === 'cancelled') break;
          a.deny();
          h.toast(e.reason === 'early' ? say.lostEarly : e.reason === 'late' ? say.lostLate : say.lostFull, 'warn');
          break;
        case 'upgradeBought':
          a.coin();
          h.toast(say.bought(e.id), 'good');
          saveNow = true;
          break;
        case 'boatUpgraded':
          a.coin();
          h.toast(say.boatBetter(this.d.getState().boats.find((b) => b.id === e.boatId)?.name ?? 'The boat'), 'good');
          saveNow = true;
          break;
        case 'boatBought':
          a.coin();
          h.toast(say.boatBought, 'good');
          saveNow = true;
          break;
        case 'hired': a.pop(); h.toast(say.hired(e.name, e.role), 'good'); saveNow = true; break;
        case 'fired': h.toast(say.fired(e.name)); saveNow = true; break;
        case 'wagesPaid':
          if (e.unpaid > 0) h.toast(say.unpaid(e.unpaid), 'warn');
          break;
        case 'rankUp':
          a.chime();
          h.banner(RANK_NAME[e.rank], say.rankUp(e.rank));
          saveNow = true;
          break;
        case 'phaseChanged':
          if (e.phase === 'dawn') a.chime();
          if (e.phase === 'night') h.toast(say.nightFalls);
          break;
        case 'dayEnded':
          this.d.showSummary(e.day, e.stats);
          saveNow = true;
          break;
        case 'denied':
          a.deny();
          h.toast(denyText(e.reason, e.needRank), 'warn');
          break;
      }
    }
    if (soldCount > 0) {
      this.d.popAt(LAYOUT.market.x, 2.9, LAYOUT.market.z + 1.2, `+$${soldTotal}`);
      a.coin();
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
