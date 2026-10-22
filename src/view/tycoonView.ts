import * as THREE from 'three';
import { BUILDING_IDS, LAYOUT, toWorld } from '../sim/config';
import type { BuildingId, WeatherId } from '../sim/config';
import type { GameState } from '../sim/state';
import { Smoke } from './fx';
import { bake, bx, chimney, cy, doorAt, fishGeo, flat, gableRoof, lampMat, put, tBox, windowAt } from './kit';
import type { SceneRig } from './scene';
import { BuildingMarks, addDoorFurniture } from './buildingMarks';
import type { World } from './world';

/**
 * Everything the tycoon stage adds to the picture: the four buildings on their plots (an empty lot until bought,
 * growing with each level), the bouncing arrow that points at the current goal, and the weather.
 */

// ---- where crates sit at the new buildings (used by cratesView) -------------------------------

const SMOKE = LAYOUT.plots.smokehouse;
const RACK_X = -2.0, RACK_Z = 2.2, RACK_STEP = 0.55, RACK_SHELF = [0.72, 1.2];
/** Spot on the smokehouse racks for the i-th smoking crate. */
export function smokeRackPos(i: number, out: THREE.Vector3): THREE.Vector3 {
  const p = toWorld(SMOKE, RACK_X + (i % 3) * RACK_STEP, RACK_Z);
  return out.set(p.x, RACK_SHELF[Math.floor(i / 3) % 2], p.z);
}
// ---- buildings ------------------------------------------------------------------------------------

interface Plan { w: number; d: number; build(g: THREE.Group, level: number, v: TycoonView): void }

/** A marked-out empty lot with a "for sale" board. */
function emptyLot(g: THREE.Group, p: Plan): void {
  bx(p.w, 0.04, p.d, flat(0xb9a47c, 1), 0, 0.02, 0, g).castShadow = false;
  const post = flat(0x6a4a30, 0.9), rope = flat(0xd9c9a4, 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.07, 0.08, 0.7, post, (sx * p.w) / 2, 0.35, (sz * p.d) / 2, g, 6);
  for (const sx of [-1, 1]) bx(0.035, 0.035, p.d, rope, (sx * p.w) / 2, 0.55, 0, g);
  bx(p.w, 0.035, 0.035, rope, 0, 0.55, -p.d / 2, g);
  cy(0.05, 0.05, 1.5, post, 0, 0.75, p.d / 2, g, 6);
}

const PLANS: Record<BuildingId, Plan> = {
  smokehouse: {
    w: 3.8, d: 3.6,
    build(g, level, v) {
      const M = v.world.M;
      bx(4.0, 0.3, 3.8, M.wall, 0, 0.15, 0, g);
      tBox(3.8, 2.3, 3.6, M.dark, 1.6, 0, 1.45, 0, g);
      gableRoof(g, 3.8, 3.6, 2.6, 1.7, M.redRoof, M.dark, 0.4);
      doorAt(g, 1.2, 1.8, 1.0, 1.9);
      const top = chimney(g, -1.0, 3.2, -0.6, 1.9 + level * 0.3);
      v.addSmoke(v.worldOf(g, top), 30 + level * 8);
      if (level >= 3) v.addSmoke(v.worldOf(g, chimney(g, 1.1, 3.2, -0.6, 1.6)), 30);
      // drying racks by the front wall: smoking crates sit on these shelves
      const wood = flat(0x6a4a30, 0.9);
      for (const px of [RACK_X - 0.3, RACK_X + 2 * RACK_STEP + 0.3]) bx(0.08, 1.7, 0.5, wood, px, 0.85, RACK_Z, g);
      for (const y of RACK_SHELF) bx(2 * RACK_STEP + 0.7, 0.06, 0.5, wood, RACK_X + RACK_STEP, y - 0.18, RACK_Z, g);
      // a line of fish hung up to smoke along the side wall
      const fish = fishGeo(), n = 2 + level * 2;
      bx(0.05, 0.05, 3.0, wood, 2.05, 2.0, 0, g);
      for (let i = 0; i < n; i++) {
        const f = put(fish, flat(0xc98a4e, 0.7), 2.05, 1.65, -1.2 + (i * 2.4) / Math.max(1, n - 1), g);
        f.rotation.z = Math.PI / 2;
        f.scale.setScalar(0.5);
      }
      addDoorFurniture(g, 1.2, 1.8, -0.95, M.iron);
    },
  },
  restaurant: {
    w: 5.0, d: 3.6,
    build(g, level, v) {
      const M = v.world.M;
      bx(5.2, 0.3, 3.8, M.wall, 0, 0.15, 0, g);
      tBox(5.0, 2.7, 3.6, M.cream, 2, 0, 1.65, 0, g);
      gableRoof(g, 5.0, 3.6, 3.0, 1.5, M.blueRoof, M.cream, 0.45);
      doorAt(g, -1.5, 1.8, 1.2, 2.1);
      windowAt(g, 0.5, 1.7, 1.8, 1.2, 1.1, { flowers: true });
      windowAt(g, 1.9, 1.7, 1.8, 1.0, 1.1, { flowers: true });
      // striped awning over the front
      for (let i = 0; i < 8; i++) {
        const strip = bx(0.62, 0.06, 1.3, flat(i % 2 ? 0xf4f1e8 : 0xd6453a, 0.8), -2.17 + i * 0.62, 2.55, 2.35, g);
        strip.rotation.x = 0.3;
      }
      for (const sx of [-2.4, 2.4]) cy(0.04, 0.04, 2.3, M.iron, sx, 1.15, 2.95, g, 5);
      // the terrace tables, chairs and diners are live: see townTerrace.ts
      if (level >= 2) for (let i = 0; i < 6; i++) put(new THREE.SphereGeometry(0.07, 6, 5), lampMat, -2.2 + i * 0.88, 2.2 - Math.sin((i / 5) * Math.PI) * 0.18, 3.0, g).userData.keep = true;
      addDoorFurniture(g, -1.5, 1.8, 0.95, M.iron);
    },
  },
  lighthouse: {
    w: 2.6, d: 2.6,
    build(g, _level, v) {
      addDoorFurniture(g, 0, 1.3, 0.7, v.world.M.iron);
      const white = flat(0xf4f1e8, 0.7), red = flat(0xd6453a, 0.7), H = 7.2, bands = 4;
      cy(1.45, 1.55, 0.5, v.world.M.wall, 0, 0.25, 0, g, 14);
      for (let i = 0; i < bands; i++) {
        const r0 = 1.25 - (i * 0.5) / bands, r1 = 1.25 - ((i + 1) * 0.5) / bands;
        cy(r1, r0, H / bands, i % 2 ? red : white, 0, 0.5 + (i + 0.5) * (H / bands), 0, g, 16);
      }
      cy(1.15, 1.15, 0.14, flat(0x2d3236, 0.5), 0, H + 0.57, 0, g, 16);                    // gallery
      for (let i = 0; i < 10; i++) cy(0.025, 0.025, 0.45, flat(0x2d3236, 0.5), Math.cos((i / 10) * 6.283) * 1.08, H + 0.85, Math.sin((i / 10) * 6.283) * 1.08, g, 4);
      cy(0.6, 0.6, 0.9, lampMat, 0, H + 1.1, 0, g, 12).userData.keep = true;               // lamp room
      put(new THREE.ConeGeometry(0.85, 0.7, 12), red, 0, H + 1.9, 0, g);
      bx(0.7, 1.5, 0.12, flat(0x6a4a30, 0.8), 0, 1.25, 1.24, g);                           // door
      bx(0.4, 0.5, 0.1, flat(0x9fd0e0, 0.3), 0, 4.2, 0.98, g);
      v.beam.position.set(0, H + 1.1, 0);
      g.add(v.beam);
    },
  },
};

// ---- weather ---------------------------------------------------------------------------------------

/** How each kind of day looks: how dark, how misty, how hard it rains (all 0 to 1), and how windy the rain falls. */
const WEATHER_LOOK: Record<WeatherId, { dim: number; mist: number; rain: number; slant: number }> = {
  calm: { dim: 0, mist: 0, rain: 0, slant: 0 },
  wind: { dim: 0.08, mist: 0, rain: 0, slant: 0.5 },
  fog: { dim: 0.25, mist: 1, rain: 0, slant: 0 },
  storm: { dim: 0.75, mist: 0.35, rain: 1, slant: 0.6 },
};
const RAIN_DROPS = 1400, RAIN_BOX = 46, RAIN_HEIGHT = 16;
const RAIN_V = `
attribute float tip; uniform float uTime, uSlant; uniform vec3 uCenter;
void main() {
  // Each drop falls on a loop inside a box that follows the camera's focus.
  vec3 p;
  p.x = mod(position.x * ${RAIN_BOX.toFixed(1)} - uCenter.x, ${RAIN_BOX.toFixed(1)}) - ${(RAIN_BOX / 2).toFixed(1)} + uCenter.x;
  p.z = mod(position.z * ${RAIN_BOX.toFixed(1)} - uCenter.z, ${RAIN_BOX.toFixed(1)}) - ${(RAIN_BOX / 2).toFixed(1)} + uCenter.z;
  p.y = mod(position.y * ${RAIN_HEIGHT.toFixed(1)} - uTime * (20.0 + position.x * 8.0), ${RAIN_HEIGHT.toFixed(1)});
  p.y += tip * 0.7;
  p.x += (p.y + tip * 0.7) * uSlant * 0.35;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_F = `uniform float uAmt; void main() { gl_FragColor = vec4(0.82, 0.9, 1.0, 0.42 * uAmt); }`;

function buildRain(): THREE.LineSegments {
  const pos = new Float32Array(RAIN_DROPS * 6), tip = new Float32Array(RAIN_DROPS * 2);
  for (let i = 0; i < RAIN_DROPS; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    pos.set([x, y, z, x, y, z], i * 6);
    tip[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: RAIN_V, fragmentShader: RAIN_F, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSlant: { value: 0 }, uAmt: { value: 0 }, uCenter: { value: new THREE.Vector3() } },
  });
  const rain = new THREE.LineSegments(g, m);
  rain.frustumCulled = false;
  rain.renderOrder = 3;
  rain.visible = false;
  return rain;
}

// ---- the view ---------------------------------------------------------------------------------------

export class TycoonView {
  /** The lighthouse's turning beam (placed by its building plan). */
  readonly beam = new THREE.Group();
  private plots = new Map<BuildingId, { group: THREE.Group; level: number }>();
  private rain = buildRain();
  private marks: BuildingMarks;
  private look = { dim: 0, mist: 0, rain: 0, slant: 0 };
  private flash = 0;
  private nextFlash = 6;

  constructor(private rig: SceneRig, readonly world: World) {
    for (const id of BUILDING_IDS) {
      const group = new THREE.Group();
      group.position.set(LAYOUT.plots[id].x, 0, LAYOUT.plots[id].z);
      group.rotation.y = LAYOUT.plots[id].rot;
      rig.scene.add(group);
      this.plots.set(id, { group, level: -1 });
      // The lot is solid even while empty (it is fenced); the world registers it from the layout data.
    }
    this.marks = new BuildingMarks(world.group);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.3, 22, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }),
    );
    cone.rotation.z = Math.PI / 2;
    cone.position.x = -11;
    cone.userData.keep = true;
    this.beam.add(cone);
    this.beam.userData.keep = true;
    rig.scene.add(this.rain);
  }

  /** World position of a point given in a plot group's own frame (the plots are turned). */
  worldOf(g: THREE.Group, local: THREE.Vector3): THREE.Vector3 {
    g.updateMatrixWorld(true);
    return g.localToWorld(local);
  }

  addSmoke(at: THREE.Vector3, count: number): void {
    this.world.smokes.push(new Smoke(this.world.group, at, count));
  }

  private rebuild(id: BuildingId, level: number): void {
    const plot = this.plots.get(id)!, plan = PLANS[id];
    plot.level = level;
    plot.group.clear();
    if (level === 0) emptyLot(plot.group, plan);
    else {
      plan.build(plot.group, level, this);
    }
    bake(plot.group);
  }

  sync(state: GameState, now: number, dt: number, player: { x: number; z: number } = LAYOUT.playerStart): void {
    for (const id of BUILDING_IDS) {
      if (this.plots.get(id)!.level !== state.buildings[id]) this.rebuild(id, state.buildings[id]);
    }
    const sky = this.rig.skyState;
    this.beam.visible = sky.lantern > 0.3 || this.look.dim > 0.4;
    this.beam.rotation.y = now * 0.7;

    this.marks.sync(state, now, dt, player, sky.lantern);
    this.weather(state.weather, now, dt);
  }

  /** Ease towards today's weather, then darken the sky, thicken the fog and drive the rain and lightning. */
  private weather(id: WeatherId, now: number, dt: number): void {
    const want = WEATHER_LOOK[id], k = Math.min(1, dt * 0.6), l = this.look;
    l.dim += (want.dim - l.dim) * k;
    l.mist += (want.mist - l.mist) * k;
    l.rain += (want.rain - l.rain) * k;
    l.slant += (want.slant - l.slant) * k;
    // Lightning: now and then during a storm the whole harbour flashes white for a moment.
    this.flash = Math.max(0, this.flash - dt * 5);
    if (l.rain > 0.6 && now > this.nextFlash) {
      this.flash = 1;
      this.nextFlash = now + 5 + Math.random() * 9;
    }
    this.rig.setWeather(l.dim, l.mist, this.flash);
    this.rain.visible = l.rain > 0.02;
    if (this.rain.visible) {
      const u = (this.rain.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = now;
      u.uAmt.value = l.rain;
      u.uSlant.value = l.slant;
      (u.uCenter.value as THREE.Vector3).copy(this.rig.sun.target.position);
    }
  }
}
