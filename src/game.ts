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
import { Panels } from './ui/panels';
import './ui/styles/index.css';
import { say } from './ui/text';
import { BoatsView } from './view/boatsView';
import { StaffView } from './view/staffView';
import { CameraRig } from './view/cameraRig';
import { CratesView } from './view/cratesView';
import { Life } from './view/life';
import { FishingView, Player, TargetMarker } from './view/player';
import { Quality } from './view/quality';
import { SceneRig } from './view/scene';
import { World } from './view/world';
import { Water, Wake } from './view/water';

const SAVE_EVERY = 10;

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
  private started = false;
  private holdHour: number | null = null;
  private frameMs = 16;
  private quality: Quality;

  constructor(app: HTMLElement, uiRoot: HTMLElement) {
    const loaded = loadGame(localStorage, this.rng);
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
      if (!this.resetting) this.save();
    });

    this.hud.toast(loaded ? say.welcomeBack : say.welcome, 'info');
    if (loaded && this.state.boats.some((b) => b.status === 'returned')) this.hud.toast(say.catchWaiting, 'good');
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
      this.panels.close();
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
    const frozen = this.panels.isOpen();

    this.player.figure.pose.carry = handCrates(s).length > 0 ? 1 : 0;
    const stepped = this.player.update(dt, this.input.moveVector(), frozen, s.fishing.phase !== 'idle');
    if (stepped) this.audio.step();
    if (s.fishing.phase !== 'idle' && Math.hypot(this.player.pos.x - STATIONS.fishing.x, this.player.pos.z - STATIONS.fishing.z) > 3.8) {
      this.events.handle(cancelCast(s));
    }

    this.events.handle(step(s, dt, this.rng));
    this.audio.update(dt, this.player.pos.x, this.player.pos.z, s.dayTime, frozen);
    if (this.holdHour !== null) s.dayTime = (((this.holdHour - START_HOUR) % 24) + 24) % 24 * HOUR_SECONDS;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
    this.quality.sample(dt);
    this.cameraRig.pitchGoal = 55 - 15 * Math.min(1, Math.max(0, -this.player.pos.z / 10));

    this.target = frozen ? null : findTarget(s, this.player.pos);

    this.saveTimer += dt;
    if (this.saveTimer >= SAVE_EVERY) {
      this.saveTimer = 0;
      this.save();
    }

    // view
    this.cameraRig.update(dt, this.player.pos);
    this.rig.update(s.dayTime, this.cameraRig.focus, this.now);
    const pxScale = this.rig.renderer.domElement.height * 0.5 / Math.tan((this.rig.camera.fov * Math.PI) / 360);
    this.world.update(this.now, this.rig.skyState, pxScale);
    this.water.update(this.now, this.rig.skyState, this.rig.fog.near, this.rig.fog.far, this.boatsView.foam, this.fishView.ripples);
    this.wake.update(dt, this.now, this.rig.skyState.foam);
    this.boatsView.sync(s, this.now, dt);
    this.staffView.sync(s, dt);
    this.cratesView.sync(s, this.now, dt);
    const stall = s.upgrades.stall2 ? 2 : s.upgrades.stall1 ? 1 : 0;
    if (stall !== this.stallShown) { this.stallShown = stall; this.world.setStall(stall); }
    const vane = rankOf(s) >= 4;
    if (vane !== this.vaneShown) { this.vaneShown = vane; this.world.setWeathervane(vane); }
    this.fishView.update(dt, this.now, s.fishing);
    this.marker.update(this.now, this.target ? { x: this.target.x, z: this.target.z } : null);
    const hand = handCrates(s);
    this.life.update(
      dt,
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

