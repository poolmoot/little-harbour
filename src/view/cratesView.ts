import * as THREE from 'three';
import { smokeRackPos } from './tycoonView';
import type { Species } from '../sim/config';
import type { Crate, GameState } from '../sim/state';
import { SPECIES_COLOUR } from '../palette';
import { bake, bx, tBox, tex, toon } from './kit';
import { crateWood } from './textures';
import type { Player } from './player';

const ROT = new THREE.Color(0x7d8a4e);
const DEAD = new THREE.Color(0x54503f);
const tmp = new THREE.Color();
const TWEEN = 0.3;

let crateBody: THREE.Group | null = null;
let bandBody: THREE.Group | null = null;
let metalBody: THREE.Group | null = null;
let goldBody: THREE.Group | null = null;
const crateTopGeo = new THREE.BoxGeometry(0.54, 0.08, 0.4);

/** Every crate is drawn a little bigger than its box, and a dock spot with several crates as one long or big crate. */
const CRATE_SCALE = 1.15;
/** The four dock-crate looks as a spot fills up: wood, wood with steel bands, steel, gold. */
const enum Look { Wood, Banded, Metal, Gold }
const lookFor = (n: number): Look => (n <= 1 ? Look.Wood : n === 2 ? Look.Banded : n <= 4 ? Look.Metal : Look.Gold);
const BIN_SHAPE = [
  new THREE.Vector3(1, 1, 1), // 1 crate: wood
  new THREE.Vector3(1.55, 1, 1.05), // 2 crates: a long wooden crate with steel bands
  new THREE.Vector3(1.45, 1.35, 1.2), // 3-4 crates: a big steel crate
  new THREE.Vector3(1.55, 1.6, 1.25), // 5-8 crates: the biggest, a gold crate
];

/** Steel bands round a wooden crate (drawn over the wood for the double crate). */
function makeBands(): THREE.Group {
  const g = new THREE.Group();
  const band = toon(new THREE.MeshStandardMaterial({ color: 0x5d6870, metalness: 0.7, roughness: 0.4 }));
  for (const y of [0.1, 0.3]) bx(0.67, 0.045, 0.53, band, 0, y, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.06, 0.42, 0.06, band, sx * 0.31, 0.21, sz * 0.24, g);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** A solid crate: sides, corner posts and two bands. Used for the steel crate and, in gold, the biggest crate. */
function makeMetalBody(side: number, trim: number, metalness: number, roughness: number, glow = 0): THREE.Group {
  const g = new THREE.Group();
  const steel = toon(new THREE.MeshStandardMaterial({ color: side, metalness, roughness, emissive: glow ? side : 0x000000, emissiveIntensity: glow }));
  const band = toon(new THREE.MeshStandardMaterial({ color: trim, metalness: 0.7, roughness: 0.4 }));
  bx(0.64, 0.4, 0.5, steel, 0, 0.2, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.05, 0.42, 0.05, band, sx * 0.31, 0.21, sz * 0.24, g);
  for (const y of [0.1, 0.3]) bx(0.66, 0.04, 0.52, band, 0, y, 0, g);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** Crate boxes share one set of geometry, wood materials and outline; only the coloured top has its own material. */
function makeCrateMesh(species: Species): THREE.Group {
  if (!crateBody) {
    crateBody = new THREE.Group();
    const wood = tex('crate', crateWood(), 0.85);
    tBox(0.64, 0.4, 0.5, wood, 0.7, 0, 0.2, 0, crateBody);
    const dark = tex('dkcrate', crateWood(), 0.9, 0x8a6a48);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.05, 0.4, 0.05, dark, sx * 0.3, 0.2, sz * 0.23, crateBody);
    bx(0.66, 0.05, 0.52, dark, 0, 0.03, 0, crateBody);
    bake(crateBody); // two wood meshes and one ink outline, shared by every crate
  }
  if (!bandBody) bandBody = makeBands();
  if (!metalBody) metalBody = makeMetalBody(0x9aa7b1, 0x4f5a63, 0.65, 0.35);
  if (!goldBody) goldBody = makeMetalBody(0xf2c230, 0xa8741a, 0.85, 0.25, 0.12);
  const g = crateBody.clone();
  const wood = [...g.children];
  const extra = [bandBody, metalBody, goldBody].map((b) => { const c = b.clone(); c.visible = false; g.add(c); return c; });
  // What to show for each look: wood, wood + bands, steel, gold.
  g.userData.parts = [wood, [...wood, extra[0]], [extra[1]], [extra[2]]];
  g.userData.all = [...wood, ...extra];
  g.userData.look = Look.Wood;
  const top = new THREE.Mesh(crateTopGeo, toon(new THREE.MeshStandardMaterial({ color: SPECIES_COLOUR[species], roughness: 0.55 })));
  top.position.y = 0.4;
  top.castShadow = true;
  g.add(top);
  g.userData.top = top;
  g.userData.species = species;
  return g;
}

function tintCrate(g: THREE.Object3D, species: Species, freshness: number): void {
  const top = g.userData.top as THREE.Mesh;
  const m = top.material as THREE.MeshStandardMaterial;
  const t = 1 - freshness / 100;
  tmp.set(SPECIES_COLOUR[species]);
  if (t < 0.6) m.color.copy(tmp).lerp(ROT, t / 0.6 * 0.6);
  else m.color.copy(tmp).lerp(ROT, 0.6).lerp(DEAD, (t - 0.6) / 0.4);
}

interface Entry {
  mesh: THREE.Group;
  loc: Crate['loc'];
  spin: number;
  tween: number;           // seconds left
  from: THREE.Vector3;     // start position in the current parent's space
  fromScale: number;
  arc: number;
}

/** A number key for a dock spot (positions are fixed slot values from LAYOUT). */
const binKey = (c: Crate): number => Math.round((c.x ?? 0) * 100) * 100000 + Math.round((c.z ?? 0) * 100);

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const backOut = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const tgtPos = new THREE.Vector3();
const wp = new THREE.Vector3();
const dropOff = new THREE.Vector3(0, 0.9, 0);

export class CratesView {
  private entries = new Map<number, Entry>();
  /** Where dockhands are carrying each hauled crate (filled by StaffView each frame). */
  readonly haul = new Map<number, THREE.Vector3>();
  private seen = new Set<number>();
  /** Dock spots this frame: crate count and the crate drawn for the spot (lowest id). Reused every frame. */
  private binCount = new Map<number, number>();
  private binLeader = new Map<number, number>();
  constructor(private scene: THREE.Scene, private player: Player) {}

  sync(state: GameState, now: number, dt: number): void {
    const seen = this.seen;
    seen.clear();
    let hand = 0, smoke = 0;
    const count = this.binCount, leader = this.binLeader;
    count.clear();
    leader.clear();
    for (const c of state.crates) {
      if (c.loc !== 'dock') continue;
      const k = binKey(c);
      count.set(k, (count.get(k) ?? 0) + 1);
      if (c.id < (leader.get(k) ?? Infinity)) leader.set(k, c.id);
    }
    for (const c of state.crates) {
      seen.add(c.id);
      let e = this.entries.get(c.id);
      let fresh = false;
      if (!e) {
        e = { mesh: makeCrateMesh(c.species), loc: c.loc, spin: ((c.id * 37) % 11) / 11 - 0.5, tween: 0, from: new THREE.Vector3(), fromScale: 1, arc: 0 };
        this.entries.set(c.id, e);
        (c.loc === 'hand' ? this.player.carryGroup : this.scene).add(e.mesh);
        fresh = true;
      }
      const wantParent: THREE.Object3D = c.loc === 'hand' ? this.player.carryGroup : this.scene;
      let moved = false;
      if (e.mesh.parent !== wantParent) {
        e.mesh.getWorldPosition(wp);
        e.fromScale = e.mesh.scale.x;
        e.mesh.parent?.remove(e.mesh);
        wantParent.add(e.mesh);
        e.from.copy(wantParent.worldToLocal(wp.clone()));
        moved = true;
      } else if (e.loc !== c.loc) {
        e.from.copy(e.mesh.position);
        e.fromScale = e.mesh.scale.x;
        moved = true;
      }
      e.loc = c.loc;
      tintCrate(e.mesh, c.species, c.freshness);

      let ts = 1, ry = 0, binN = 0;
      if (c.loc === 'dock') {
        const k = binKey(c);
        binN = leader.get(k) === c.id ? count.get(k)! : 0; // 0: drawn by the spot's leader, so hidden
        tgtPos.set(c.x ?? 0, 0.05, c.z ?? 0);
        ry = e.spin * 0.25;
        ts = CRATE_SCALE;
      } else if (c.loc === 'haul') {
        const h = this.haul.get(c.id);
        if (h) tgtPos.copy(h);
        else tgtPos.set(c.x ?? 0, 0.05, c.z ?? 0);
        ts = 0.55;
      } else if (c.loc === 'smoke') {
        smokeRackPos(smoke++, tgtPos);
        ts = 0.5;
      } else {
        const i = hand++;
        tgtPos.set(i % 2 ? 0.2 : -0.2, 0.95 + Math.floor(i / 2) * 0.36 + Math.sin(now * 3 + i) * 0.01, 0.5);
        ts = 0.55;
      }
      if (fresh) {
        // new crate (unloaded from a boat or caught): drop in with a pop
        e.from.copy(tgtPos).add(dropOff);
        e.fromScale = 0.3;
        moved = true;
      }
      if (moved) { e.tween = TWEEN; e.arc = 0.35 + e.from.distanceTo(tgtPos) * 0.12; }

      if (e.tween > 0) {
        e.tween = Math.max(0, e.tween - dt);
        const u = 1 - e.tween / TWEEN;
        const k = easeOut(u);
        e.mesh.position.lerpVectors(e.from, tgtPos, k);
        e.mesh.position.y += Math.sin(Math.PI * u) * e.arc;
        e.mesh.scale.setScalar(e.fromScale + (ts - e.fromScale) * backOut(u));
      } else {
        e.mesh.position.copy(tgtPos);
        e.mesh.scale.setScalar(ts);
      }
      e.mesh.rotation.set(0, ry, 0);
      // One crate per dock spot: the leader grows and changes look as the spot fills (wood, banded, steel, gold); the others are not drawn.
      const onDock = c.loc === 'dock';
      e.mesh.visible = !onDock || binN > 0;
      const look = onDock && binN > 0 ? lookFor(binN) : Look.Wood;
      if (onDock && binN > 0) e.mesh.scale.multiply(BIN_SHAPE[look]);
      if (e.mesh.userData.look !== look) {
        e.mesh.userData.look = look;
        const show = new Set(e.mesh.userData.parts[look] as THREE.Object3D[]);
        for (const o of e.mesh.userData.all as THREE.Object3D[]) o.visible = show.has(o);
      }
    }
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) {
        e.mesh.parent?.remove(e.mesh);
        this.entries.delete(id);
      }
    }
  }
}
