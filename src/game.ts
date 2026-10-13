import { Vector3 } from 'three';
import { GameAudio } from './audio';
import { Input } from './input';
import { HOUR_SECONDS, START_HOUR } from './sim/config';
import type { ZoneId } from './sim/config';
import { clearSave, loadGame, saveGame } from './sim/save';
import { Rng } from './sim/rng';
import { buyBoat, buyBoatUpgrade, fireCaptain, fireDockhand, hireCaptain, hireDockhand, rankOf, setBoatTarget, setHaulPolicy } from './sim/sim';
import { buyUpgrade, cancelCast, dispatchBoat, dockCrates, handCrates, initialState, phaseOf, sellAll, sellCrate, storeInIce, takeFromIce } from './sim/sim';
import type { Ev, GameState } from './sim/sim';
import { startGame, step } from './sim/sim';
import { Hud } from './ui/hud';
import { EventRouter } from './events';
import { STATIONS, findTarget, interact, promptFor } from './interaction';
import type { Target } from './interaction';
import { escapeAction, isHalted } from './ui/menuFlow';
import type { Mode } from './ui/menuFlow';
import { Panels } from './ui/panels';
import './ui/styles/index.css';
import { say } from './ui/text';
import { BoatsView } from './view/boatsView';
import { StaffView } from './view/staffView';
import { CameraRig } from './view/cameraRig';
import { CratesView } from './view/cratesView';
import { TycoonView } from './view/tycoonView';
import { Life } from './view/life';
import { FishingView, Player, TargetMarker } from './view/player';
import { Quality } from './view/quality';
import { SceneRig } from './view/scene';
import { World } from './view/world';
import { Water, Wake } from './view/water';

const SAVE_EVERY = 10;
/** Set (for this tab only) when New game reloads the page, so the title screen is not shown a second time. */
const SKIP_TITLE_KEY = 'harbour-skip-title';

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
  private cratesView: CratesView;
  private tycoonView: TycoonView;
  private staffView: StaffView;
  private stallShown = -1;
  private vaneShown = false;
  private life: Life;
  private fishView: FishingView;
  private marker: TargetMarker;
  private hud: Hud;
  private panels: Panels;
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
  private started = false;
  private holdHour: number | null = null;
  private frameMs = 16;
  private quality: Quality;

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
    this.cratesView = new CratesView(this.rig.scene, this.player);
    this.tycoonView = new TycoonView(this.rig, this.world);
    this.staffView = new StaffView(this.rig.scene, this.cratesView.haul);
    this.life = new Life(this.rig.scene, this.world, this.rig.camera, uiRoot);
    this.fishView = new FishingView(this.rig.scene, this.player);
    this.marker = new TargetMarker(this.rig.scene);
    this.hud = new Hud(uiRoot, (kind) => { this.audio.click(); this.panels.toggle(kind); });
    this.events = new EventRouter({
      audio: this.audio,
      hud: this.hud,
      showSummary: (day, stats) => this.panels.showSummary(day, stats),
      getState: () => this.state,
      popAt: (x, y, z, text) => this.popAt(x, y, z, text),
      saveNow: () => { this.save(); this.saveTimer = 0; },
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
        setPolicy: (p) => this.run(setHaulPolicy(this.state, p)),
        store: (id) => this.run(storeInIce(this.state, id)),
        take: (id) => this.run(takeFromIce(this.state, id)),
        getQuality: () => this.quality.mode,
        setQuality: (m) => { this.quality.setMode(m); this.panels.refresh(); },
        resetGame: () => this.reset(),
        getAudio: () => this.audio.getSettings(),
        setVolume: (k, v) => this.audio.setVolume(k, v),
        setMuted: (m) => this.audio.setMuted(m),
        hasSave: () => this.hasSave,
        continueGame: () => this.beginPlay(),
        newGame: () => this.newGame(),
        resume: () => this.resume(),
        toTitle: () => this.toTitle(),
        onClose: () => this.audio.click(),
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

    if (skipTitle()) this.beginPlay();
    else this.panels.open('title');
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
    if (code === 'KeyL') {
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
    this.hud.toast(this.hasSave ? say.welcomeBack : say.welcome, 'info');
    if (this.hasSave && this.state.boats.some((b) => b.status === 'returned')) this.hud.toast(say.catchWaiting, 'good');
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
    saveGame(this.state, localStorage);
    this.hasSave = true;
  }

  /** Floating text at a world position (projected to the screen). */
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

    if (!halted) this.saveTimer += dt;
    if (this.saveTimer >= SAVE_EVERY) {
      this.saveTimer = 0;
      this.save();
    }

    // view
    this.cameraRig.update(dt, this.player.pos);
    this.tycoonView.sync(s, this.now, sdt);
    this.rig.update(s.dayTime, this.cameraRig.focus, this.now);
    const pxScale = this.rig.renderer.domElement.height * 0.5 / Math.tan((this.rig.camera.fov * Math.PI) / 360);
    this.world.update(this.now, this.rig.skyState, pxScale);
    this.water.update(this.now, this.rig.skyState, this.rig.fog.near, this.rig.fog.far, this.boatsView.foam, this.fishView.ripples);
    this.wake.update(sdt, this.now, this.rig.skyState.foam);
    this.boatsView.sync(s, this.now, sdt);
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
    this.rig.render();

    // ui
    this.hud.update(s, promptFor(s, this.target));
    this.panels.update();
  }
}

