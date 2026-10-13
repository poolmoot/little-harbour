import { Vector3 } from 'three';
import { GameAudio } from './audio';
import { Input } from './input';
import { BOAT_RANGE, CRATE_RANGE, FISH, HOUR_SECONDS, INTERACT_RANGE, LAYOUT, START_HOUR, UPGRADES, ZONES } from './sim/config';
import type { ZoneId } from './sim/config';
import { clearSave, loadGame, saveGame } from './sim/save';
import { Rng } from './sim/rng';
import { buyUpgrade, carryCapacity, castLine, cancelCast, dispatchBoat, dockCrates, handCrates, hook, initialState, pickUp, phaseOf, sellAll, sellCrate, storeInIce, takeFromIce, unloadBoat } from './sim/sim';
import type { Ev, GameState } from './sim/sim';
import { startGame, step } from './sim/sim';
import { Hud } from './ui/hud';
import type { Prompt } from './ui/hud';
import { Panels } from './ui/panels';
import { injectStyles } from './ui/styles';
import { BoatsView } from './view/boatsView';
import { CameraRig } from './view/cameraRig';
import { CratesView } from './view/cratesView';
import { Life } from './view/life';
import { FishingView, Player, TargetMarker } from './view/player';
import { SceneRig } from './view/scene';
import { World } from './view/world';
import { Water, Wake } from './view/water';

type TargetKind = 'crate' | 'boat' | 'market' | 'shipyard' | 'board' | 'icebox' | 'fishing';
interface Target {
  kind: TargetKind;
  id: number;
  x: number;
  z: number;
  dist: number;
}

const STATIONS: Record<Exclude<TargetKind, 'crate' | 'boat'>, { x: number; z: number; range: number }> = {
  market: { x: LAYOUT.market.x, z: LAYOUT.market.z + 1.7, range: INTERACT_RANGE },
  shipyard: { x: LAYOUT.shipyard.x, z: LAYOUT.shipyard.z + 2.8, range: INTERACT_RANGE },
  board: { x: LAYOUT.noticeBoard.x, z: LAYOUT.noticeBoard.z + 0.5, range: INTERACT_RANGE },
  icebox: { x: LAYOUT.iceBox.x, z: LAYOUT.iceBox.z + 1.1, range: INTERACT_RANGE },
  fishing: { x: LAYOUT.fishingSpot.x, z: LAYOUT.fishingSpot.z, range: 3.2 },
};
const SAVE_EVERY = 10;
const NOUN = (n: number) => `${n} crate${n === 1 ? '' : 's'}`;

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
  private life: Life;
  private fishView: FishingView;
  private marker: TargetMarker;
  private hud: Hud;
  private panels: Panels;
  private target: Target | null = null;
  private last = performance.now();
  private now = 0;
  private saveTimer = 0;
  private recentFilled = -99;
  private recentMissed = -99;
  private resetting = false;
  private started = false;
  private holdHour: number | null = null;
  private frameMs = 16;

  constructor(app: HTMLElement, uiRoot: HTMLElement) {
    injectStyles();
    const loaded = loadGame(localStorage, this.rng);
    this.state = loaded ?? initialState();
    startGame(this.state, this.rng);

    this.rig = new SceneRig(app);
    this.world = new World(this.rig.scene);
    this.water = new Water(this.rig.scene);
    this.wake = new Wake(this.rig.scene);
    this.player = new Player(this.rig.scene, this.world);
    this.cameraRig = new CameraRig(this.rig.camera, this.player.pos);
    this.boatsView = new BoatsView(this.rig.scene, this.wake);
    this.cratesView = new CratesView(this.rig.scene, this.player);
    this.life = new Life(this.rig.scene, this.world, this.rig.camera, uiRoot);
    this.fishView = new FishingView(this.rig.scene, this.player);
    this.marker = new TargetMarker(this.rig.scene);
    this.hud = new Hud(uiRoot);
    this.panels = new Panels(
      uiRoot,
      {
        dispatch: (id, zone) => this.dispatch(id, zone),
        sellAll: () => this.run(sellAll(this.state)),
        sellCrate: (id) => this.run(sellCrate(this.state, id)),
        buy: (id) => this.run(buyUpgrade(this.state, id)),
        store: (id) => this.run(storeInIce(this.state, id)),
        take: (id) => this.run(takeFromIce(this.state, id)),
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

    if (!loaded) this.hud.toast('Welcome to the harbour! Walk with WASD, press E near things.', 'info');
    else this.hud.toast('Welcome back. Your boats are waiting in the harbour.', 'info');
    if (loaded && this.state.boats.some((b) => b.status === 'returned')) this.hud.toast('A boat has a catch ready to unload.', 'good');
    if (import.meta.env.DEV) this.installDebug();
  }

  /** Development-only helpers: window.__debug (see report). Never shipped in production builds. */
  private installDebug(): void {
    const dbg = {
      /** Freeze the clock at an hour (0-24); setHour(null) resumes time. */
      setHour: (h: number | null) => {
        this.holdHour = h;
        if (h !== null) this.state.dayTime = (((h - START_HOUR) % 24) + 24) % 24 * HOUR_SECONDS;
      },
      teleport: (x: number, z: number) => {
        this.player.pos.set(x, 0, z);
        this.cameraRig.focus.set(x, 0, z);
      },
      money: (n: number) => { this.state.money += n; },
      upgrade: (id: keyof GameState['upgrades']) => { this.state.upgrades[id] = true; },
      send: (boat = 0, zone: ZoneId = 'shallows') => this.dispatch(this.state.boats[boat]?.id ?? 0, zone),
      /** Override the camera: cam(pitchDeg, distance); cam() clears. */
      cam: (pitch?: number, dist = 20) => { this.cameraRig.override = pitch === undefined ? null : { pitch, dist }; },
      popup: (text = '+$12') => this.hud.floatText(text, window.innerWidth / 2, window.innerHeight / 2),
      toast: (t: string) => this.hud.toast(t, 'good'),
      stats: () => ({ ms: +this.frameMs.toFixed(2), calls: this.rig.renderer.info.render.calls, tris: this.rig.renderer.info.render.triangles, geometries: this.rig.renderer.info.memory.geometries }),
      state: () => this.state,
    };
    (window as unknown as { __debug: typeof dbg }).__debug = dbg;
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
        if (this.panels.current === 'summary' || code === 'KeyE') this.panels.close();
        return;
      }
      this.interact();
    }
  }

  private interact(): void {
    const t = this.target;
    if (!t) return;
    const s = this.state;
    switch (t.kind) {
      case 'crate':
        this.run(pickUp(s, t.id));
        break;
      case 'boat': {
        const b = s.boats.find((x) => x.id === t.id);
        if (!b) break;
        if (b.status === 'docked') this.panels.open('dispatch', b.id);
        else if (b.status === 'returned') this.run(unloadBoat(s, b.id));
        else this.hud.toast('That boat is still out at sea.', 'info');
        break;
      }
      case 'market': this.panels.open('market'); break;
      case 'shipyard': this.panels.open('shipyard'); break;
      case 'board': this.panels.open('board'); break;
      case 'icebox': this.panels.open('ice'); break;
      case 'fishing': {
        if (s.fishing.phase === 'idle') this.run(castLine(s, this.rng));
        else this.run(hook(s, this.rng));
        break;
      }
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
    this.handle(evs);
    this.panels.refresh();
  }

  private handle(evs: Ev[]): void {
    let soldCount = 0, soldTotal = 0, saveNow = false;
    const a = this.audio, h = this.hud;
    for (const e of evs) {
      switch (e.type) {
        case 'boatDispatched':
          a.click();
          h.toast(`The boat heads out to the ${ZONES[e.zone].name}.`);
          break;
        case 'boatReturned':
          a.bell();
          h.toast(`A boat is back with ${NOUN(e.count)}! Unload it at the pier.`, 'good');
          break;
        case 'boatUnloaded':
          a.pop();
          h.toast(`Unloaded ${NOUN(e.count)} onto the dock. They start spoiling now!`);
          break;
        case 'cratePicked': a.pop(); break;
        case 'crateStored':
        case 'crateTaken': a.pop(); break;
        case 'crateSold':
          soldCount++;
          soldTotal += e.price;
          saveNow = true;
          break;
        case 'crateSpoiled':
          a.spoil();
          h.toast(`A crate of ${FISH[e.species].name} has spoiled.`, 'warn');
          break;
        case 'crateDiscarded':
          h.toast(`Threw out a spoiled crate of ${FISH[e.species].name}.`, 'warn');
          break;
        case 'orderPosted':
          h.toast('A new order is up on the notice board.');
          break;
        case 'orderFilled':
          this.recentFilled = this.now;
          this.popAt(LAYOUT.noticeBoard.x, 2.6, LAYOUT.noticeBoard.z, `Bonus +$${e.bonus}`);
          a.coin();
          h.toast(`${e.name}'s order is complete! Bonus +$${e.bonus}`, 'good');
          break;
        case 'orderMissed':
          this.recentMissed = this.now;
          a.deny();
          h.toast(`${e.name}'s order expired.`, 'warn');
          break;
        case 'castStarted': a.cast(); break;
        case 'biteStarted': a.splash(); break;
        case 'fishLanded':
          a.pop();
          h.toast(`You landed a ${FISH[e.species].name}!`, 'good');
          break;
        case 'fishLost':
          if (e.reason === 'cancelled') break;
          a.deny();
          h.toast(e.reason === 'early' ? 'Too early, the fish got away.' : e.reason === 'late' ? 'Too slow, it got away.' : 'Your hands were full.', 'warn');
          break;
        case 'upgradeBought':
          a.coin();
          h.toast(`Bought: ${UPGRADES[e.id].name}.`, 'good');
          saveNow = true;
          break;
        case 'phaseChanged':
          if (e.phase === 'dawn') a.chime();
          if (e.phase === 'night') h.toast('Night falls. Boats cannot sail until dawn.');
          break;
        case 'dayEnded':
          this.panels.showSummary(e.day, e.stats);
          saveNow = true;
          break;
        case 'denied':
          a.deny();
          h.toast(e.reason, 'warn');
          break;
      }
    }
    if (soldCount > 0) {
      this.popAt(LAYOUT.market.x, 2.9, LAYOUT.market.z + 1.2, `+$${soldTotal}`);
      a.coin();
      h.toast(`Sold ${NOUN(soldCount)} for $${soldTotal}.`, 'good');
    }
    if (saveNow) {
      this.save();
      this.saveTimer = 0;
    }
  }

  // ---- targeting ---------------------------------------------------------

  private findTarget(): Target | null {
    const p = this.player.pos;
    const s = this.state;
    let best: Target | null = null;
    for (const c of dockCrates(s)) {
      const d = Math.hypot((c.x ?? 0) - p.x, (c.z ?? 0) - p.z);
      if (d <= CRATE_RANGE && (!best || d < best.dist)) best = { kind: 'crate', id: c.id, x: c.x ?? 0, z: c.z ?? 0, dist: d };
    }
    if (best) return best;
    const consider = (kind: TargetKind, id: number, x: number, z: number, range: number) => {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d <= range && (!best || d < best.dist)) best = { kind, id, x, z, dist: d };
    };
    for (const b of s.boats) {
      const berth = LAYOUT.berths[b.berth];
      consider('boat', b.id, berth.edgeX, berth.edgeZ, BOAT_RANGE);
    }
    for (const k of Object.keys(STATIONS) as (keyof typeof STATIONS)[]) {
      const st = STATIONS[k];
      consider(k, 0, st.x, st.z, st.range);
    }
    return best;
  }

  private promptFor(t: Target | null): Prompt | null {
    if (!t) return null;
    const s = this.state;
    switch (t.kind) {
      case 'crate': {
        const c = s.crates.find((x) => x.id === t.id);
        if (!c) return null;
        if (c.freshness <= 0) return { text: `Throw out spoiled ${FISH[c.species].name}`, key: true };
        if (handCrates(s).length >= carryCapacity(s)) return { text: 'Hands full', key: false, dim: true };
        return { text: `Pick up ${FISH[c.species].name} crate (${Math.round(c.freshness)}% fresh)`, key: true };
      }
      case 'boat': {
        const b = s.boats.find((x) => x.id === t.id);
        if (!b) return null;
        const n = s.boats.indexOf(b) + 1;
        if (b.status === 'docked') return { text: `Send out Boat ${n}`, key: true };
        if (b.status === 'returned') return { text: `Unload Boat ${n} (${NOUN(b.catch.length)})`, key: true, hot: true };
        return { text: `Boat ${n} is at sea (${Math.max(0, Math.ceil(b.tripTime - b.progress))}s)`, key: false, dim: true };
      }
      case 'market': return { text: 'Sell fish at the market', key: true };
      case 'shipyard': return { text: 'Visit the shipyard', key: true };
      case 'board': return { text: 'Read the notice board', key: true };
      case 'icebox': return { text: s.upgrades.icebox ? 'Use the ice box' : 'Ice box (buy at the shipyard)', key: true };
      case 'fishing':
        if (s.fishing.phase === 'idle') return { text: 'Cast your line', key: true };
        if (s.fishing.phase === 'bite') return { text: 'HOOK IT NOW!', key: true, hot: true };
        return { text: 'Wait for a bite…  (early reel loses it)', key: true, dim: true };
    }
  }

  // ---- frame -------------------------------------------------------------

  private frame(dt: number): void {
    this.now += dt;
    const s = this.state;
    const frozen = this.panels.isOpen();

    this.player.figure.pose.carry = handCrates(s).length > 0 ? 1 : 0;
    const stepped = this.player.update(dt, this.input.moveVector(), frozen, s.fishing.phase !== 'idle');
    if (stepped) this.audio.step();
    if (s.fishing.phase !== 'idle' && Math.hypot(this.player.pos.x - STATIONS.fishing.x, this.player.pos.z - STATIONS.fishing.z) > 3.8) {
      this.handle(cancelCast(s));
    }

    this.handle(step(s, dt, this.rng));
    if (this.holdHour !== null) s.dayTime = (((this.holdHour - START_HOUR) % 24) + 24) % 24 * HOUR_SECONDS;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
    this.cameraRig.pitchGoal = 55 - 15 * Math.min(1, Math.max(0, -this.player.pos.z / 10));

    this.target = frozen ? null : this.findTarget();

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
    this.cratesView.sync(s, this.now, dt);
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
        recentFilled: this.now - this.recentFilled < 20,
        recentMissed: this.now - this.recentMissed < 20,
        money: s.money,
        boatsOut: s.boats.filter((b) => b.status === 'out').length,
        openOrders: s.orders.length,
      },
      dockCrates(s),
      frozen,
    );
    this.rig.render();

    // ui
    this.hud.update(s, this.promptFor(this.target));
    this.panels.update();
  }
}

