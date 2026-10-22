import { Vector3 } from 'three';
import { GameAudio } from './audio';
import { Input } from './input';
import { consentStatus, setConsent, track } from './analytics';
import { HOUR_SECONDS, START_HOUR } from './sim/config';
import type { ZoneId } from './sim/config';
import { clearSave, loadGame, saveGame } from './sim/save';
import { Rng } from './sim/rng';
import { applyAway, buyBoat, buyBoatUpgrade, fireCaptain, fireDockhand, hireCaptain, hireDockhand, rankOf, setBoatTarget } from './sim/sim';
import { renameBoat, setHarbourName } from './sim/sim';
import { acceptContract, buyBuilding, buyProject, collectSmoked, repairBoat, sellToRestaurant, setSmokeList, setStayInStorms, smokeCrate } from './sim/sim';
import { buyUpgrade, cancelCast, dispatchBoat, dockCrates, handCrates, initialState, phaseOf, sellAll, sellCrate } from './sim/sim';
import type { Ev, GameState } from './sim/sim';
import { startGame, step } from './sim/sim';
import { guideAdvice } from './sim/guideAdvice';
import { guideDone, noteAway, noteBoardOpened, noteWalk, noteWelcomed } from './sim/sim';
import { playIntro } from './ui/intro';
import { Coach } from './ui/coach';
import { Hud } from './ui/hud';
import { GuideCards } from './ui/guideCards';
import { loadGuideTips, saveGuideTips } from './ui/guideSetting';
import { GUIDE } from './ui/guideText';
import { guidePoint } from './guideTargets';
import { GuideTrail } from './view/guideTrail';
import { EventRouter } from './events';
import { STATIONS, findTarget, interact, promptFor } from './interaction';
import type { Target } from './interaction';
import { awayPlan } from './ui/awayFlow';
import { escapeAction, isHalted } from './ui/menuFlow';
import type { Mode } from './ui/menuFlow';
import { Panels } from './ui/panels';
import './ui/styles/index.css';
import type { AwayInfo } from './ui/screens/types';
import { say } from './ui/text';
import { BoatsView } from './view/boatsView';
import { BerthMarks } from './view/berthMarks';
import { StaffView } from './view/staffView';
import { CameraRig } from './view/cameraRig';
import { CratesView } from './view/cratesView';
import { TycoonView } from './view/tycoonView';
import { Life } from './view/life';
import { TownLife } from './view/townLife';
import { FishingView, Player, TargetMarker } from './view/player';
import { Quality } from './view/quality';
import { SceneRig } from './view/scene';
import { World } from './view/world';
import { updateOcclusion } from './view/occlusion';
import { Water, Wake } from './view/water';

const SAVE_EVERY = 10;
/** Set (for this tab only) when New game reloads the page, so the title screen is not shown a second time. */
const SKIP_TITLE_KEY = 'harbour-skip-title';
/** Set once the one-time "hire a captain" tip has been shown (kept apart from the game save). */
const AWAY_TIP_KEY = 'harbour-away-tip-seen';

function tipSeen(): boolean {
  try { return localStorage.getItem(AWAY_TIP_KEY) !== null; } catch { return true; }
}
function markTipSeen(): void {
  try { localStorage.setItem(AWAY_TIP_KEY, '1'); } catch { /* the tip may show again */ }
}

/** True when the title screen should be skipped: a fresh start after New game, or `?play` in the address (handy for scripted checks). */
function skipTitle(): boolean {
  let skip = new URLSearchParams(location.search).has('play');
  try {
    if (sessionStorage.getItem(SKIP_TITLE_KEY)) skip = true;
    sessionStorage.removeItem(SKIP_TITLE_KEY);
  } catch { /* storage blocked: show the title */ }
  return skip;
}

export class Game {
  private state: GameState;
  private rng = new Rng();
  private input = new Input();
  private audio = new GameAudio();
  private rig: SceneRig;
  private world: World;
  private water: Water;
  private wake: Wake;
  private player: Player;
  private cameraRig: CameraRig;
  private boatsView: BoatsView;
  private berthMarks: BerthMarks;
  private cratesView: CratesView;
  private tycoonView: TycoonView;
  private staffView: StaffView;
  private stallShown = -1;
  private vaneShown = false;
  private life: Life;
  private townLife: TownLife;
  private fishView: FishingView;
  private marker: TargetMarker;
  private hud: Hud;
  private panels: Panels;
  private coach: Coach;
  private projected = new Vector3();
  private projectedOut = { x: 0, y: 0, front: true };
  /** World point to screen pixels, for the tutorial's pointers. */
  private project = (p: { x: number; y: number; z: number }) => {
    const v = this.projected.set(p.x, p.y, p.z).project(this.rig.camera), o = this.projectedOut;
    o.x = (v.x * 0.5 + 0.5) * innerWidth;
    o.y = (-v.y * 0.5 + 0.5) * innerHeight;
    o.front = v.z < 1;
    return o;
  };
  private target: Target | null = null;
  private last = performance.now();
  private now = 0;
  private saveTimer = 0;
  private events!: EventRouter;
  private resetting = false;
  /** Title screen, playing, or paused. Anything but 'play' freezes the sim, the clock and the music. */
  private mode: Mode = 'title';
  private hasSave = false;
  private greeted = false;
  /** What the harbour earned while the player was away; set when they choose Continue. */
  private away: AwayInfo | null = null;
  private started = false;
  private holdHour: number | null = null;
  private frameMs = 16;
  private quality: Quality;
  private guideTips = loadGuideTips(localStorage);
  private guideCards!: GuideCards;
  private guideTrail!: GuideTrail;
  private lastWalk = { x: 0, z: 0 };

  constructor(app: HTMLElement, uiRoot: HTMLElement) {
    const loaded = loadGame(localStorage, this.rng);
    this.hasSave = loaded !== null;
    this.state = loaded ?? initialState();
    startGame(this.state, this.rng);

    this.rig = new SceneRig(app);
    this.quality = new Quality(this.rig, localStorage);
    this.world = new World(this.rig.scene);
    this.water = new Water(this.rig.scene);
    this.wake = new Wake(this.rig.scene);
    this.player = new Player(this.rig.scene, this.world);
    this.cameraRig = new CameraRig(this.rig.camera, this.player.pos);
    this.boatsView = new BoatsView(this.rig.scene, this.wake);
    this.berthMarks = new BerthMarks(this.rig.scene);
    this.cratesView = new CratesView(this.rig.scene, this.player);
    this.tycoonView = new TycoonView(this.rig, this.world);
    this.staffView = new StaffView(this.rig.scene, this.cratesView.haul);
    const fx = this.audio.fx;
    const hooks = { gullsTakeOff: (l: number) => fx.gullsTakeOff(l), catPurr: (d: number) => fx.catPurr(d), wave: (l: number, p: number) => fx.wave(l, p), splash: () => fx.splash(), tableChatter: (l: number) => fx.tableChatter(l) };
    this.life = new Life(this.rig.scene, this.world, this.rig.camera, uiRoot, hooks);
    this.townLife = new TownLife(this.rig.scene, this.world, this.life, this.player, hooks, () => this.quality.level);
    this.fishView = new FishingView(this.rig.scene, this.player);
    this.marker = new TargetMarker(this.rig.scene);
    this.hud = new Hud(uiRoot, (kind) => { this.audio.click(); this.panels.toggle(kind); });
    this.coach = new Coach(uiRoot);
    this.guideCards = new GuideCards(this.hud.left);
    this.guideTrail = new GuideTrail(this.rig.scene, (x, z) => this.world.walkable(x, z, 0.4));
    this.lastWalk = { x: this.player.pos.x, z: this.player.pos.z };
    this.events = new EventRouter({
      guideUnlock: (id) => this.guideCards.push(id),
      audio: this.audio,
      hud: this.hud,
      showSummary: (day, stats) => this.panels.showSummary(day, stats),
      openPanel: (kind) => this.panels.open(kind),
      getState: () => this.state,
      popAt: (x, y, z, text) => this.popAt(x, y, z, text),
      saveNow: () => { this.save(); this.saveTimer = 0; },
      watch: (evs) => this.townLife.notice(evs, this.state),
    });
    this.panels = new Panels(
      uiRoot,
      {
        dispatch: (id, zone) => this.dispatch(id, zone),
        sellAll: () => this.run(sellAll(this.state)),
        sellCrate: (id) => this.run(sellCrate(this.state, id)),
        buy: (id) => this.run(buyUpgrade(this.state, id)),
        setTarget: (id, z) => this.run(setBoatTarget(this.state, id, z)),
        upgradeBoat: (id, t) => this.run(buyBoatUpgrade(this.state, id, t)),
        buyBoat: () => this.run(buyBoat(this.state)),
        hireCaptain: (c, b) => this.run(hireCaptain(this.state, c, b)),
        fireCaptain: (b) => this.run(fireCaptain(this.state, b)),
        hireDockhand: () => this.run(hireDockhand(this.state, this.rng)),
        fireDockhand: (id) => this.run(fireDockhand(this.state, id)),
        build: (id) => this.run(buyBuilding(this.state, id)),
        buildProject: (id) => this.run(buyProject(this.state, id)),
        smokeIn: (id) => this.run(smokeCrate(this.state, id)),
        smokeOut: (id) => this.run(collectSmoked(this.state, id)),
        sellToRestaurant: (id) => this.run(sellToRestaurant(this.state, id)),
        setSmoke: (sp, on) => this.run(setSmokeList(this.state, sp, on)),
        setStayHome: (id, stay) => this.run(setStayInStorms(this.state, id, stay)),
        repair: (id) => this.run(repairBoat(this.state, id)),
        renameBoat: (id, name) => this.run(renameBoat(this.state, id, name)),
        setHarbourName: (name) => this.run(setHarbourName(this.state, name)),
        acceptContract: (id) => this.run(acceptContract(this.state, id)),
        getQuality: () => this.quality.mode,
        setQuality: (m) => { this.quality.setMode(m); this.panels.refresh(); },
        resetGame: () => this.reset(),
        getAudio: () => this.audio.getSettings(),
        setVolume: (k, v) => this.audio.setVolume(k, v),
        setMuted: (m) => this.audio.setMuted(m),
        hasSave: () => this.hasSave,
        getAway: () => this.away,
        continueGame: () => this.beginPlay(),
        newGame: () => this.newGame(),
        resume: () => this.resume(),
        toTitle: () => this.toTitle(),
        onClose: () => this.audio.click(),
        onOpen: (kind) => { if (kind === 'board') noteBoardOpened(this.state); },
        getConsent: () => consentStatus(),
        setConsent: (on) => setConsent(on),
        getGuideTips: () => this.guideTips,
        setGuideTips: (on) => this.setGuideTips(on),
        replayGuide: (key) => this.replayGuide(key),
      },
      () => this.state,
    );

    // Audio may only start after the first user input.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.input.onPress = (code) => this.onKey(code);
    window.addEventListener('beforeunload', () => {
      // On the title screen nothing has been chosen yet, so leave any saved game alone.
      if (!this.resetting && this.mode !== 'title') this.save();
    });
    // Keep the settings screen in step when M is pressed while it is open.
    this.audio.settings.subscribe(() => this.panels.refresh());

    this.events.syncWeather(this.state.weather);
    if (skipTitle()) this.beginPlay();
    else { playIntro(uiRoot); this.panels.open('title'); }
    if (import.meta.env.DEV) {
      const self = this;
      void import('./debug').then((m) => m.installDebug({
        get state() { return self.state; },
        rng: this.rng, hud: this.hud, panels: this.panels, player: this.player, cameraRig: this.cameraRig, rig: this.rig,
        dispatch: (id, zone) => this.dispatch(id, zone),
        handle: (evs) => this.events.handle(evs),
        frameMs: () => this.frameMs,
        setHoldHour: (h) => { this.holdHour = h; },
      }));
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---- input -------------------------------------------------------------

  private onKey(code: string): void {
    if (code === 'Escape') {
      this.onEscape();
      return;
    }
    if (isHalted(this.mode)) return;
    if (code === 'Enter') {
      if (this.panels.pressMain()) this.audio.click();
    } else if (code === 'KeyL') {
      this.panels.toggle('logbook');
    } else if (code === 'KeyE') {
      if (this.panels.isOpen()) {
        this.panels.close();
        return;
      }
      const r = interact(this.target, this.state, this.rng);
      if (!r) return;
      if ('evs' in r) this.run(r.evs);
      else this.panels.open(r.open, r.arg ?? 0);
    }
  }

  /** Esc: pause when nothing is open, resume from the pause menu, step back out of settings, or close a window. */
  private onEscape(): void {
    switch (escapeAction(this.mode, this.panels.current)) {
      case 'pause':
        this.mode = 'paused';
        this.input.clear();
        this.panels.open('pause');
        break;
      case 'resume': this.resume(); break;
      case 'close': this.panels.close(); break;
      case 'back': this.panels.back(); break;
      case 'none': break;
    }
  }

  // ---- title screen and pause menu ----------------------------------------

  /** Start (or carry on) playing: from the title screen, or at once when the title is skipped. */
  private beginPlay(): void {
    this.mode = 'play';
    this.input.clear();
    this.panels.close();
    if (this.greeted) return;
    this.greeted = true;
    track(this.hasSave ? 'game_continued' : 'game_started', this.hasSave ? { day: this.state.day } : undefined);
    const shown = this.hasSave && this.creditAway();
    const welcome = !shown && this.guideTips && !this.state.guide.welcomed && !guideDone(this.state);
    if (welcome) { noteWelcomed(this.state); this.panels.open('welcome'); }
    else if (!shown) this.hud.toast(this.hasSave ? say.welcomeBack : say.welcome, 'info');
    if (this.hasSave && this.state.boats.some((b) => b.status === 'returned')) this.hud.toast(say.catchWaiting, 'good');
  }

  /**
   * Credit what the harbour earned while the player was away, once, at the moment they choose Continue (not at load), so the
   * title screen still shows the saved money and the counter ticks up in front of them. The save is stamped again at once, so
   * the same time away can never be paid twice. Returns true when a window was opened.
   */
  private creditAway(): boolean {
    const secs = this.state.savedAt > 0 ? (Date.now() - this.state.savedAt) / 1000 : 0;
    const { result, events } = applyAway(this.state, secs, this.rng);
    this.events.handle(events);
    if (result && result.earned > 0) this.events.handle(noteAway(this.state));
    this.save();
    const plan = awayPlan(result, this.state, tipSeen());
    this.away = result;
    if (plan === 'none') return false;
    if (plan === 'tip') markTipSeen();
    this.panels.open('away', plan === 'tip' ? 1 : 0);
    return true;
  }

  private setGuideTips(on: boolean): void {
    this.guideTips = on;
    saveGuideTips(localStorage, on);
    if (!on) this.hud.toast(GUIDE.skipToast);
  }

  /** Show a card (and its trail) again from the help list. The welcome opens its window. */
  private replayGuide(key: string): void {
    if (this.mode === 'title') this.beginPlay();
    else if (this.mode === 'paused') this.resume();
    else this.panels.close();
    if (key === 'welcome') { this.panels.open('welcome'); return; }
    this.guideTips = true;
    saveGuideTips(localStorage, true);
    this.guideCards.replay(key, performance.now());
  }

  private resume(): void {
    this.mode = 'play';
    this.input.clear();
    this.panels.close();
  }

  private toTitle(): void {
    this.save();
    this.mode = 'title';
    this.input.clear();
    this.panels.open('title');
  }

  /** With a saved game this goes through the normal reset (clear the save and reload); without one the fresh game just starts. */
  private newGame(): void {
    if (!this.hasSave) {
      this.beginPlay();
      return;
    }
    try { sessionStorage.setItem(SKIP_TITLE_KEY, '1'); } catch { /* the title will show once more */ }
    this.reset();
  }

  // ---- actions & events --------------------------------------------------

  private dispatch(boatId: number, zone: ZoneId): void {
    const evs = dispatchBoat(this.state, boatId, zone);
    this.run(evs);
    if (evs.some((e) => e.type === 'boatDispatched')) this.panels.close();
  }

  private reset(): void {
    this.resetting = true;
    clearSave(localStorage);
    location.reload();
  }

  private save(): void {
    saveGame(this.state, localStorage, Date.now());
    this.hasSave = true;
  }

  /** Floating text at a world position (projected to the screen). */
  /** If something solid has just appeared around the player (a building bought while standing on its plot), step them out to the nearest free edge. */
  private unstickPlayer(): void {
    this.world.stepOut(this.player.pos);
  }

  private popAt(x: number, y: number, z: number, text: string): void {
    const v = new Vector3(x, y, z).project(this.rig.camera);
    this.hud.floatText(text, (v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight);
  }

  private run(evs: Ev[]): void {
    this.events.handle(evs);
    this.panels.refresh();
  }

  // ---- targeting ---------------------------------------------------------

  // ---- frame -------------------------------------------------------------

  private frame(dt: number): void {
    this.now += dt;
    this.events.now = this.now;
    const s = this.state;
    const halted = isHalted(this.mode);
    const frozen = halted || this.panels.isOpen();
    // While halted, movement in the scene stops but water and light keep their gentle motion.
    const sdt = halted ? 0 : dt;

    this.player.figure.pose.carry = handCrates(s).length > 0 ? 1 : 0;
    const stepped = this.player.update(dt, this.input.moveVector(), frozen, s.fishing.phase !== 'idle');
    if (stepped) this.audio.step();
    if (s.fishing.phase !== 'idle' && Math.hypot(this.player.pos.x - STATIONS.fishing.x, this.player.pos.z - STATIONS.fishing.z) > 3.8) {
      this.events.handle(cancelCast(s));
    }

    if (!halted) this.events.handle(step(s, dt, this.rng));
    // The music scheduler lives inside audio.update, so a paused game simply does not call it.
    // The title screen still runs it (the clock is still, so the tune stays the same).
    if (this.mode !== 'paused') this.audio.update(dt, this.player.pos.x, this.player.pos.z, s.dayTime, frozen);
    if (this.holdHour !== null) s.dayTime = (((this.holdHour - START_HOUR) % 24) + 24) % 24 * HOUR_SECONDS;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
    this.quality.sample(dt);
    this.cameraRig.pitchGoal = 55 - 15 * Math.min(1, Math.max(0, -this.player.pos.z / 10));

    this.target = frozen ? null : findTarget(s, this.player.pos);

    // guide: count steps walked, show the cards, and lead the way with the trail
    if (!frozen) {
      noteWalk(s, Math.hypot(this.player.pos.x - this.lastWalk.x, this.player.pos.z - this.lastWalk.z));
    }
    this.lastWalk.x = this.player.pos.x;
    this.lastWalk.z = this.player.pos.z;
    const guideOn = this.guideTips && this.mode === 'play';
    const advice = guideOn ? guideAdvice(s) : null;
    this.guideCards.update(s, guideOn, performance.now(), advice);
    this.hud.hideGoal(this.guideCards.stepShown);
    const gt = guideOn ? this.guideCards.trailTarget(s) : null;
    const gp = gt ? guidePoint(gt, s, this.player.pos) : null;
    this.guideTrail.update(this.now, dt, this.player.pos, gp, guideOn);
    this.coach.update(s, this.panels.current, guideOn, gp ? { x: gp.x, y: 1.6, z: gp.z } : null, this.project, advice);

    if (!halted) this.saveTimer += dt;
    if (this.saveTimer >= SAVE_EVERY) {
      this.saveTimer = 0;
      this.save();
    }

    // view
    this.cameraRig.showcase = this.mode === 'title';
    this.cameraRig.update(dt, this.player.pos);
    this.tycoonView.sync(s, this.now, sdt, this.player.pos);
    this.unstickPlayer();
    this.rig.update(s.dayTime, this.cameraRig.focus, this.now);
    updateOcclusion(this.rig.camera, this.player.pos);
    const pxScale = this.rig.renderer.domElement.height * 0.5 / Math.tan((this.rig.camera.fov * Math.PI) / 360);
    this.world.update(this.now, this.rig.skyState, pxScale);
    this.water.update(this.now, this.rig.skyState, this.rig.fog.near, this.rig.fog.far, this.boatsView.foam, this.fishView.ripples);
    this.wake.update(sdt, this.now, this.rig.skyState.foam);
    this.boatsView.sync(s, this.now, sdt);
    this.berthMarks.sync(s, this.now);
    this.staffView.sync(s, sdt);
    this.cratesView.sync(s, this.now, sdt);
    const stall = s.upgrades.stall2 ? 2 : s.upgrades.stall1 ? 1 : 0;
    if (stall !== this.stallShown) { this.stallShown = stall; this.world.setStall(stall); }
    const vane = rankOf(s) >= 4;
    if (vane !== this.vaneShown) { this.vaneShown = vane; this.world.setWeathervane(vane); }
    this.fishView.update(sdt, this.now, s.fishing);
    this.marker.update(this.now, this.target ? { x: this.target.x, z: this.target.z } : null);
    const hand = handCrates(s);
    this.life.update(
      sdt,
      this.now,
      this.player.pos,
      {
        phase: phaseOf(s.dayTime),
        handSpecies: hand.map((c) => c.species),
        recentFilled: this.now - this.events.recentFilled < 20,
        recentMissed: this.now - this.events.recentMissed < 20,
        money: s.money,
        boatsOut: s.boats.filter((b) => b.status === 'out').length,
        openOrders: s.orders.length,
      },
      dockCrates(s),
      frozen,
    );
    this.townLife.update(sdt, this.now, s, this.rig.skyState);
    this.rig.render();

    // ui
    this.hud.update(s, promptFor(s, this.target));
    this.panels.update();
  }
}

