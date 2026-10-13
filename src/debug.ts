// Development-only helpers: window.__debug. Loaded only in dev builds (see game.ts), never shipped.
import { HOUR_SECONDS, START_HOUR } from './sim/config';
import type { Track, Trait, ZoneId } from './sim/config';
import { bestZone, buyBoat, hireDockhand, step } from './sim/sim';
import type { Ev, GameState } from './sim/sim';
import type { Rng } from './sim/rng';
import type { Hud } from './ui/hud';
import type { Panels } from './ui/panels';
import type { CameraRig } from './view/cameraRig';
import type { Player } from './view/player';
import type { SceneRig } from './view/scene';

/** What the debug helpers may touch. */
export interface DebugHost {
  state: GameState;
  rng: Rng;
  hud: Hud;
  panels: Panels;
  player: Player;
  cameraRig: CameraRig;
  rig: SceneRig;
  dispatch(boatId: number, zone: ZoneId): void;
  handle(evs: Ev[]): void;
  frameMs(): number;
  setHoldHour(h: number | null): void;
}

export function installDebug(g: DebugHost): void {
  const dbg = {
    /** Freeze the clock at an hour (0-24); setHour(null) resumes time. */
    setHour: (h: number | null) => {
      g.setHoldHour(h);
      if (h !== null) g.state.dayTime = (((h - START_HOUR) % 24) + 24) % 24 * HOUR_SECONDS;
    },
    teleport: (x: number, z: number) => {
      g.player.pos.set(x, 0, z);
      g.cameraRig.focus.set(x, 0, z);
    },
    money: (n: number) => { g.state.money += n; },
    /** Harbour upgrade (icebox, handcart, stall1, stall2) or a boat track: upgrade('hull', 2, boatIndex) sets that track level. */
    upgrade: (id: keyof GameState['upgrades'] | Track, level = 1, boat = 0) => {
      if (id in g.state.upgrades) { g.state.upgrades[id as keyof GameState['upgrades']] = true; return; }
      const b = g.state.boats[boat];
      if (b) b[id as Track] = level;
    },
    send: (boat = 0, zone?: ZoneId) => g.dispatch(g.state.boats[boat]?.id ?? 0, zone ?? g.state.boats[boat]?.target ?? 'shallows'),
    /** Step the simulation forward (a hidden tab pauses animation frames). */
    skip: (seconds: number) => {
      const n = Math.ceil(seconds / 0.25);
      for (let i = 0; i < n; i++) g.handle(step(g.state, 0.25, g.rng));
      g.panels.refresh();
    },
    /** Jump to a rank (0-4) by setting lifetime earnings. */
    rank: (r: number) => { g.state.lifetime = Math.max(g.state.lifetime, [0, 500, 3000, 15000, 60000][r] ?? 0); },
    /** Add boats (as rowboats) until there are n. */
    fleet: (n: number) => { g.state.lifetime = Math.max(g.state.lifetime, 15000); g.state.money += 20000; while (g.state.boats.length < n) buyBoat(g.state); },
    hireDockhands: (n = 1) => { g.state.lifetime = Math.max(g.state.lifetime, 500); for (let i = 0; i < n; i++) hireDockhand(g.state, g.rng); },
    captain: (boat = 0, trait: Trait = 'swift') => {
      const b = g.state.boats[boat];
      if (!b) return;
      b.captain = { id: g.state.nextId++, name: 'Debug', trait, wage: 40 };
      b.target = bestZone(b);
    },
    panel: (kind: 'boat' | 'hire' | 'shipyard' | 'summary', boat = 0) => g.panels.open(kind, g.state.boats[boat]?.id ?? 0),
    /** Override the camera: cam(pitchDeg, distance); cam() clears. */
    cam: (pitch?: number, dist = 20) => { g.cameraRig.override = pitch === undefined ? null : { pitch, dist }; },
    popup: (text = '+$12') => g.hud.floatText(text, window.innerWidth / 2, window.innerHeight / 2),
    toast: (t: string) => g.hud.toast(t, 'good'),
    stats: () => ({ ms: +g.frameMs().toFixed(2), calls: g.rig.renderer.info.render.calls, tris: g.rig.renderer.info.render.triangles, geometries: g.rig.renderer.info.memory.geometries }),
    state: () => g.state,
  };
  (window as unknown as { __debug: typeof dbg }).__debug = dbg;
}


