import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { Species } from '../sim/config';
import type { Crate, GameState } from '../sim/state';
import { SPECIES_COLOUR } from '../palette';
import { box } from './figures';
import type { Player } from './player';

const ROT = new THREE.Color(0x7d8a4e);
const DEAD = new THREE.Color(0x54503f);
const tmp = new THREE.Color();

export function makeCrateMesh(species: Species): THREE.Group {
  const g = new THREE.Group();
  box(0.64, 0.4, 0.5, 0x9c7a50, 0, 0.2, 0, g);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: SPECIES_COLOUR[species], roughness: 0.6 }));
  top.position.y = 0.4;
  top.castShadow = true;
  g.add(top);
  box(0.66, 0.06, 0.52, 0x6b4a2f, 0, 0.03, 0, g);
  g.userData.top = top;
  g.userData.species = species;
  return g;
}

export function tintCrate(g: THREE.Object3D, species: Species, freshness: number): void {
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
}

export class CratesView {
  private entries = new Map<number, Entry>();
  constructor(private scene: THREE.Scene, private player: Player) {}

  /** Positions of ice-box crates sit on top of the box, in a 3x2 grid. */
  private icePos(i: number): THREE.Vector3 {
    const ib = LAYOUT.iceBox;
    return new THREE.Vector3(ib.x - 0.55 + (i % 3) * 0.55, 1.0, ib.z - 0.25 + Math.floor(i / 3) * 0.5);
  }

  sync(state: GameState, now: number): void {
    const seen = new Set<number>();
    let hand = 0, ice = 0;
    for (const c of state.crates) {
      seen.add(c.id);
      let e = this.entries.get(c.id);
      if (!e) {
        e = { mesh: makeCrateMesh(c.species), loc: c.loc, spin: ((c.id * 37) % 11) / 11 - 0.5 };
        this.entries.set(c.id, e);
        this.scene.add(e.mesh);
      }
      if (e.loc !== c.loc || (c.loc === 'hand') !== (e.mesh.parent === this.player.carryGroup)) {
        e.loc = c.loc;
        e.mesh.parent?.remove(e.mesh);
        (c.loc === 'hand' ? this.player.carryGroup : this.scene).add(e.mesh);
      }
      tintCrate(e.mesh, c.species, c.freshness);
      if (c.loc === 'dock') {
        e.mesh.position.set(c.x ?? 0, 0.05 + (c.layer ?? 0) * 0.42, c.z ?? 0);
        e.mesh.rotation.set(0, e.spin * 0.25, 0);
        e.mesh.scale.setScalar(1);
      } else if (c.loc === 'ice') {
        e.mesh.position.copy(this.icePos(ice++));
        e.mesh.rotation.set(0, e.spin * 0.2, 0);
        e.mesh.scale.setScalar(0.7);
      } else {
        const i = hand++;
        e.mesh.position.set(i % 2 ? 0.2 : -0.2, 0.95 + Math.floor(i / 2) * 0.36 + Math.sin(now * 3 + i) * 0.01, 0.5);
        e.mesh.rotation.set(0, 0, 0);
        e.mesh.scale.setScalar(0.55);
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

