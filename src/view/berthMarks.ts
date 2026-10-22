import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import type { GameState } from '../sim/state';
import { bx, cy, flat, signMesh } from './kit';

/**
 * A small "for sale" sign on a post at the edge of the pier beside every empty boat spot (LAYOUT.berths). The sign shows while no boat
 * is tied up there and gently sways; walking up to it and pressing E opens the boat spot window (see interaction.ts). Reads state only.
 */
export class BerthMarks {
  private groups: { root: THREE.Group; board: THREE.Object3D }[] = [];

  constructor(parent: THREE.Object3D) {
    const wood = flat(0x6a4a30, 0.9);
    LAYOUT.berths.forEach((b) => {
      const root = new THREE.Group();
      const side = Math.sign(b.edgeX) || 1;
      root.position.set(side * (Math.abs(b.edgeX) - 0.25), 0, b.edgeZ);
      cy(0.06, 0.07, 1.5, wood, 0, 0.75, 0, root, 6).castShadow = false;
      const board = new THREE.Group();
      board.position.set(0, 1.35, 0.04);
      const sign = signMesh('BOAT FOR SALE', 1.25, 0.5, '#e9b84a', '#3a2410');
      board.add(sign);
      bx(1.35, 0.06, 0.05, wood, 0, 0.3, -0.01, board).castShadow = false;
      root.add(board);
      root.visible = false;
      parent.add(root);
      this.groups.push({ root, board });
    });
  }

  sync(state: GameState, now: number): void {
    this.groups.forEach((g, i) => {
      const empty = !state.boats.some((b) => b.berth === i);
      g.root.visible = empty;
      if (empty) g.board.rotation.z = Math.sin(now * 1.4 + i * 1.7) * 0.04;
    });
  }
}
