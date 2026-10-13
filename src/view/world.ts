import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { SPECIES_COLOUR } from '../palette';
import type { SkyState } from './scene';
import { Fireflies, Smoke, haloSprite, windU } from './fx';
import { hullGeometry } from './hull';
import { barrel, bake, bollard, bx, chimney, crateBox, cy, doorAt, fishGeo, flat, gableRoof, lampMat, mats, net, put, ropeCoil, signMesh, tBox, windowAt, windowMat } from './kit';
import { buildNature, groundH, landPatch } from './nature';

/** Planted beds on the quay as [x0, x1, z0, z1]. */
const BEDS: [number, number, number, number][] = [[3.4, 9.4, 9.6, 13.4], [-9.4, -3.4, 9.6, 13.4]];

export interface Rect {
  x0: number; x1: number; z0: number; z1: number;
}

interface Lamp { light: THREE.PointLight | null; halo: THREE.Sprite; phase: number }

export class World {
  readonly group = new THREE.Group();
  readonly obstacles: Rect[] = [];
  private stat = new THREE.Group();
  private M = mats();
  private lamps: Lamp[] = [];
  private signs: { m: THREE.Object3D; phase: number }[] = [];
  private smokes: Smoke[] = [];
  private fireflies!: Fireflies;
  private flag!: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.group.add(this.stat);
    this.buildGround();
    this.buildPier();
    this.buildMarket();
    this.buildShipyard();
    this.buildInn();
    this.buildBoardAndIce();
    this.buildQuayDetail();
    this.buildLanterns();
    bake(this.stat);
    const n = buildNature(this.group, (x, z) => {
      if (z < -8) return false;
      if (Math.abs(x) < 22.2 && z < 14.2) return false;
      return true;
    }, BEDS);
    this.fireflies = new Fireflies(this.group, [...n.fireflies, [-1.85, 0, -4], [1.85, 0, -10.5], [-13, 0, 8.5], [13, 0, 9]], 5);
  }

  private solid(r: Rect): void {
    this.obstacles.push(r);
  }

  // ---------------------------------------------------------------- ground

  private buildGround(): void {
    const L = LAYOUT, M = this.M, s = this.stat;
    tBox(L.quayMaxX - L.quayMinX, 1.4, L.quayMaxZ, M.cobble, 2.4, 0, -0.7, L.quayMaxZ / 2, s).castShadow = false;
    tBox(L.quayMaxX - L.quayMinX + 0.2, 0.16, 0.6, M.lip, 2, 0, 0.0, 0.3, s).castShadow = false;
    // flagstone avenue from the pier to the green, and a worn forecourt in front of each building
    tBox(5.2, 0.03, 14, M.lip, 2, 0, 0.012, 7, s).castShadow = false;
    for (const [bx0, bz0, bw, bd] of [[-8, 4.6, 6, 3.2], [-15, 3.6, 8, 5], [10.5, 3.6, 8.4, 5.4]] as const) tBox(bw, 0.02, bd, M.lip, 2, bx0, 0.01, bz0 + 1.5, s).castShadow = false;
    // planted beds on the quay: a stone surround, a lawn, and a tree trunk to walk around
    for (const [x0, x1, z0, z1] of BEDS) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      tBox(x1 - x0 + 0.5, 0.05, z1 - z0 + 0.5, M.lip, 2, cx, 0.02, cz, s).castShadow = false;
      tBox(x1 - x0, 0.05, z1 - z0, M.grass, 3, cx, 0.045, cz, s).castShadow = false;
      this.solid({ x0: cx - 0.3, x1: cx + 0.3, z0: cz - 0.3, z1: cz + 0.3 });
    }
    // retaining wall between quay and the green verge
    tBox(L.quayMaxX - L.quayMinX, 0.5, 0.35, M.wall, 1.6, 0, 0.1, L.quayMaxZ + 0.15, s);
    tBox(L.quayMaxX - L.quayMinX + 0.3, 0.1, 0.55, M.lip, 2, 0, 0.38, L.quayMaxZ + 0.15, s);
    const gtex = M.grass.map as THREE.Texture;
    this.group.add(landPatch(gtex, -100, -22, -8, 110), landPatch(gtex, 22, 100, -8, 110), landPatch(gtex, -22, 22, 14, 110));
    // stone skirts where the land meets the water
    tBox(78, 1.5, 0.4, M.wall, 1.8, 61, -0.78, -8.2, s);
    tBox(78, 1.5, 0.4, M.wall, 1.8, -61, -0.78, -8.2, s);
    tBox(0.4, 1.5, 8.2, M.wall, 1.8, 22.2, -0.78, -4, s);
    tBox(0.4, 1.5, 8.2, M.wall, 1.8, -22.2, -0.78, -4, s);
    // quay end steps down to the rocks
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) tBox(1.6, 0.18, 6 - i, M.lip, 2, sx * (21.2 - i * 0.2), -0.1 - i * 0.18, 3.5, s).castShadow = false;
  }

  private buildPier(): void {
    const L = LAYOUT, M = this.M, s = this.stat;
    const len = -L.pierEndZ, w = L.pierHalfWidth * 2;
    tBox(w, 0.35, len, M.pier, 2, 0, -0.12, -len / 2, s);
    for (const sx of [-1, 1]) bx(0.2, 0.34, len, M.dark, sx * (L.pierHalfWidth - 0.1), -0.4, -len / 2, s);
    for (let z = -1; z > L.pierEndZ; z -= 3) bx(w + 0.2, 0.14, 0.22, M.dark, 0, -0.34, z, s);
    // piles with caps and rope rails
    const zs: number[] = [];
    for (let z = -1; z >= L.pierEndZ + 0.5; z -= 3) zs.push(z);
    for (const sx of [-1, 1]) {
      for (const z of zs) {
        const x = sx * (L.pierHalfWidth - 0.05);
        cy(0.17, 0.2, 2.4, M.dark, x, -0.55, z, s, 8);
        cy(0.2, 0.17, 0.08, M.trim, x, 0.62, z, s, 8);
      }
      for (let i = 0; i < zs.length - 1; i++) {
        const x = sx * (L.pierHalfWidth - 0.05);
        const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.55, zs[i]), new THREE.Vector3(x, 0.4, (zs[i] + zs[i + 1]) / 2), new THREE.Vector3(x, 0.55, zs[i + 1])]);
        put(new THREE.TubeGeometry(c, 8, 0.025, 5, false), M.rope, 0, 0, 0, s);
      }
    }
    for (const b of L.berths) {
      bollard(s, b.edgeX * 1.05, 0.055, b.edgeZ + 1.2);
      bollard(s, b.edgeX * 1.05, 0.055, b.edgeZ - 1.2);
    }
    // fishing spot: painted pad, bucket, rod rack, stool, rope, nets
    bx(0.7, 0.012, 0.7, flat(0xe2b640, 0.8), 0, 0.066, L.fishingSpot.z, s).castShadow = false;
    const bz = L.pierEndZ + 0.9;
    cy(0.25, 0.2, 0.4, flat(0x4a6fa5, 0.6), 1.3, 0.25, bz, s);
    cy(0.22, 0.22, 0.02, flat(0x2f4f78), 1.3, 0.45, bz, s, 12);
    for (const dx of [-0.2, 0.2]) cy(0.05, 0.05, 1.3, M.trim, -1.4 + dx, 0.7, bz - 0.1, s, 6);
    for (let i = 0; i < 3; i++) {
      const rod = cy(0.012, 0.025, 2.0, M.trim, -1.4, 1.2, bz - 0.1 + (i - 1) * 0.05, s, 5);
      rod.rotation.z = 0.12 * (i - 1) + 0.1;
    }
    cy(0.22, 0.2, 0.34, M.dark, -1.2, 0.22, bz + 0.5, s, 8);
    ropeCoil(s, 1.0, 0.055, bz + 1.4, 1.1);
    barrel(s, -1.35, L.pierEndZ + 1.8, 0.055, 0.9);
    crateBox(s, 1.4, 0.055, L.pierEndZ + 2.2, 0.55, 0.3);
    net(this.group, 1.4, 0.9, 1.1, 0.35, bz + 0.45, 0.4);
    // end-of-pier lantern post
    cy(0.07, 0.09, 2.6, M.iron, -1.75, 1.3, L.pierEndZ + 0.3, s, 6);
    this.lampHead(-1.75, 2.7, L.pierEndZ + 0.3, false);
  }

  // ---------------------------------------------------------------- market

  private buildMarket(): void {
    const { x, z } = LAYOUT.market, M = this.M, s = this.stat;
    tBox(4.2, 1.0, 2.0, M.wood, 1.6, x, 0.5, z, s);
    tBox(4.5, 0.1, 2.3, M.crate, 1.4, x, 1.05, z, s);
    for (const dx of [-2.05, 2.05]) for (const dz of [-0.95, 0.95]) cy(0.07, 0.08, 2.9, M.dark, x + dx, 1.45, z + dz, s, 6);
    const stripe = [0xd24a3a, 0xf6efe0];
    for (let i = 0; i < 7; i++) {
      const sl = bx(0.64, 0.07, 2.9, flat(stripe[i % 2], 0.95), x - 1.92 + i * 0.64, 2.9, z + 0.1, s);
      sl.rotation.x = 0.18;
      const v = bx(0.64, 0.3, 0.04, flat(stripe[i % 2], 0.95), x - 1.92 + i * 0.64, 2.64, z + 1.5, s);
      v.rotation.x = 0.1;
      put(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 8, 1, false, 0, Math.PI), flat(stripe[i % 2], 0.95), x - 1.92 + i * 0.64, 2.5, z + 1.52, s).rotation.set(Math.PI / 2, Math.PI / 2, 0);
    }
    bx(4.4, 0.12, 0.12, M.trim, x, 2.76, z + 1.45, s);
    // fish on ice trays
    const species = ['herring', 'mackerel', 'flounder', 'seabass', 'snapper', 'lobster'] as const;
    for (let i = 0; i < 4; i++) {
      const tx = x - 1.45 + i * 0.97;
      bx(0.8, 0.12, 0.56, flat(0xdde9f0, 0.5), tx, 1.17, z + 0.3, s);
      bx(0.7, 0.06, 0.46, flat(0xb9d8e8, 0.3), tx, 1.23, z + 0.3, s);
      for (let k = 0; k < 3; k++) {
        const f = put(fishGeo(), flat(SPECIES_COLOUR[species[(i + k) % 6]], 0.45), tx - 0.16 + k * 0.17, 1.33, z + 0.3 + (k % 2 ? 0.1 : -0.1), s);
        f.scale.setScalar(0.42);
        f.rotation.set(0, Math.PI / 2 + (k - 1) * 0.2, k * 0.1);
      }
    }
    // hanging fish string and scale
    bx(3.6, 0.03, 0.03, M.rope, x, 2.45, z + 1.3, s);
    for (let i = 0; i < 6; i++) {
      const f = put(fishGeo(), flat(SPECIES_COLOUR[species[i % 4]], 0.45), x - 1.5 + i * 0.6, 2.2, z + 1.3, s);
      f.scale.setScalar(0.5);
      f.rotation.set(0, 0, Math.PI / 2);
    }
    const sign = signMesh('FISH MARKET', 2.6, 0.5, '#2f6f8f');
    sign.position.set(x, 1.9, z + 1.1);
    this.group.add(sign);
    this.signs.push({ m: sign, phase: 0 });
    this.lampHead(x + 1.7, 2.5, z + 0.6, false, true);
    // scale + baskets on the counter
    cy(0.2, 0.2, 0.04, flat(0xb89a5a, 0.4), x + 1.2, 1.14, z - 0.5, s, 10);
    for (const dx of [-0.6, 0, 0.6]) put(new THREE.CylinderGeometry(0.2, 0.15, 0.2, 8), flat(0xb08a4a, 0.95), x + dx, 1.2, z - 0.55, s);
    this.solid({ x0: x - 2.2, x1: x + 2.2, z0: z - 1.1, z1: z + 1.1 });
    barrel(s, x + 3.0, z + 0.6);
    barrel(s, x + 3.6, z + 0.1);
    crateBox(s, x + 3.3, 0, z - 0.4, 0.7, 0.3);
    crateBox(s, x + 3.3, 0.7, z - 0.4, 0.55, 0.9);
    this.solid({ x0: x + 2.5, x1: x + 4.1, z0: z - 0.7, z1: z + 1.1 });
  }

  // ---------------------------------------------------------------- shipyard

  private buildShipyard(): void {
    const { x, z } = LAYOUT.shipyard, M = this.M, s = this.stat;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    s.add(g);
    bx(6.2, 0.4, 4.2, M.wall, 0, 0.2, 0, g);
    tBox(6, 2.7, 4, M.wood, 1.6, 0, 1.75, 0, g);
    for (const sx of [-1, 1]) bx(0.2, 3, 4.2, M.trim, sx * 3, 1.5, 0, g);
    gableRoof(g, 6, 4, 3.1, 1.7, M.blueRoof, M.wood, 0.5);
    // big workshop double door
    bx(1.9, 2.5, 0.1, M.trim, -1.1, 1.5, 2.02, g);
    for (const sx of [-1, 1]) {
      tBox(0.85, 2.3, 0.08, M.dark, 1, -1.1 + sx * 0.44, 1.4, 2.07, g);
      bx(0.6, 0.07, 0.1, M.iron, -1.1 + sx * 0.44, 1.0, 2.13, g);
      bx(0.6, 0.07, 0.1, M.iron, -1.1 + sx * 0.44, 1.9, 2.13, g);
    }
    windowAt(g, 1.7, 1.9, 2.03, 1.0, 0.9, { shutter: 0x3f6a86 });
    windowAt(g, 3.03, 1.9, 0.5, 0.8, 0.8, { ry: Math.PI / 2 });
    const smoke = chimney(g, -2.1, 3.6, -1.0, 2.0);
    this.smokes.push(new Smoke(this.group, smoke.add(new THREE.Vector3(x, 0, z))));
    const sign = signMesh('SHIPYARD', 2.4, 0.55, '#3b5167');
    sign.position.set(x + 0.9, 3.0, z + 2.2);
    this.group.add(sign);
    this.signs.push({ m: sign, phase: 1.2 });
    // upturned hull on trestles
    const hullMat = flat(0x7b4b32, 0.85);
    const hull = put(hullGeometry(0.85, 0.72), hullMat, x + 4.6, 1.15, z + 0.8, s);
    hull.rotation.set(0, Math.PI / 2, Math.PI);
    hull.scale.set(0.85, 1, 0.8);
    (hull.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    bx(0.25, 0.75, 1.5, M.dark, x + 3.4, 0.38, z + 0.8, s);
    bx(0.25, 0.75, 1.5, M.dark, x + 5.8, 0.38, z + 0.8, s);
    bx(2.9, 0.12, 0.2, M.dark, x + 4.6, 0.35, z + 0.2, s);
    // timber stack, barrels, anchor
    for (let i = 0; i < 4; i++) bx(2.2, 0.12, 0.3, i % 2 ? M.crate : M.wood, x - 3.9, 0.07 + i * 0.13, z + 1.2 + (i % 2) * 0.05, s).rotation.y = 0.5;
    barrel(s, x + 3.4, z + 2.4, 0, 1, false);
    crateBox(s, x - 3.3, 0, z + 2.6, 0.7, 0.2);
    const anchor = new THREE.Group();
    anchor.position.set(x - 2.3, 0.55, z + 2.7);
    cy(0.04, 0.04, 1.0, M.iron, 0, 0, 0, anchor, 6);
    bx(0.6, 0.05, 0.05, M.iron, 0, 0.35, 0, anchor);
    const arc = put(new THREE.TorusGeometry(0.28, 0.04, 5, 10, Math.PI), M.iron, 0, -0.35, 0, anchor);
    arc.rotation.z = Math.PI;
    anchor.rotation.set(0.1, 0.4, 0.15);
    s.add(anchor);
    net(this.group, 1.6, 1.0, x + 1.9, 0.9, z + 3.0, 0.2);
    this.solid({ x0: x - 3, x1: x + 3, z0: z - 2, z1: z + 2 });
    this.solid({ x0: x + 3.1, x1: x + 6.1, z0: z + 0.1, z1: z + 1.5 });
  }

  // ---------------------------------------------------------------- inn

  private buildInn(): void {
    const { x, z } = LAYOUT.inn, M = this.M, s = this.stat;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    s.add(g);
    bx(7.2, 0.4, 5.2, M.wall, 0, 0.2, 0, g);
    tBox(7, 2.6, 5, M.cream, 2, 0, 1.7, 0, g);
    tBox(6.6, 2.2, 4.6, M.wood, 1.6, 0, 4.1, 0, g);
    bx(7.3, 0.2, 5.3, M.trim, 0, 3.05, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.22, 3.0, 0.22, M.trim, sx * 3.5, 1.5, sz * 2.5, g);
    for (const sx of [-1, 1]) bx(0.18, 2.2, 0.18, M.dark, sx * 3.3, 4.1, 2.3, g);
    bx(6.7, 0.14, 0.14, M.dark, 0, 5.15, 2.3, g);
    gableRoof(g, 6.6, 4.6, 5.2, 1.9, M.redRoof, M.wood, 0.6);
    doorAt(g, -1.8, 2.5, 1.3, 2.2);
    windowAt(g, 0.8, 1.7, 2.5, 0.95, 0.95, { shutter: 0x2f6f8f, flowers: true });
    windowAt(g, 2.5, 1.7, 2.5, 0.95, 0.95, { shutter: 0x2f6f8f, flowers: true });
    for (const wx of [-1.8, 0.2, 2.2]) windowAt(g, wx, 4.1, 2.3, 0.9, 0.9, { shutter: 0xb5483a });
    windowAt(g, 3.5, 1.8, 0.4, 0.9, 0.9, { ry: Math.PI / 2, shutter: 0x2f6f8f });
    windowAt(g, 3.3, 4.1, 0, 0.9, 0.9, { ry: Math.PI / 2 });
    const top = chimney(g, 2.5, 5.9, -0.8, 1.7);
    this.smokes.push(new Smoke(this.group, top.add(new THREE.Vector3(x, 0, z)), 32));
    // hanging anchor sign
    for (const sx of [-1.3, 1.7]) bx(0.05, 0.4, 0.05, M.iron, sx, 3.35, 2.7, g);
    const sign = signMesh('THE ANCHOR INN', 3.0, 0.55, '#7a2f2a');
    sign.position.set(x + 0.2, 3.35, z + 2.74);
    this.group.add(sign);
    this.signs.push({ m: sign, phase: 2.4 });
    // pennant on the ridge
    const pole = cy(0.03, 0.03, 1.6, M.iron, 3.1, 7.9, 0, g, 5);
    pole.castShadow = false;
    const fg = new THREE.PlaneGeometry(0.9, 0.5, 6, 2);
    fg.translate(0.45, 0, 0);
    this.flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xd24a3a, side: THREE.DoubleSide, roughness: 0.9 }));
    this.flag.position.set(x + 3.1, 8.4, z);
    this.flag.userData.keep = true;
    this.group.add(this.flag);
    // outside bits
    barrel(s, x + 4.1, z + 2.2);
    crateBox(s, x + 4.9, 0, z + 1.6, 0.8, 0.2);
    crateBox(s, x + 4.5, 0, z + 0.7, 0.6, 0.6);
    bx(1.6, 0.08, 0.4, M.dark, x + 0.6, 0.5, z + 2.95, s);
    bx(0.08, 0.5, 0.36, M.dark, x - 0.1, 0.25, z + 2.95, s);
    bx(0.08, 0.5, 0.36, M.dark, x + 1.3, 0.25, z + 2.95, s);
    for (const px of [-3.0, -0.7]) {
      put(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), flat(0xb5654a, 0.9), x + px, 0.15 + 0.4, z + 2.75, s);
      for (let i = 0; i < 4; i++) put(new THREE.SphereGeometry(0.1, 6, 5), flat([0xff7aa8, 0xffe14a, 0xffffff, 0xb48cf0][i], 0.8), x + px - 0.12 + i * 0.08, 0.7, z + 2.75 + (i % 2) * 0.05, s);
    }
    this.solid({ x0: x - 3.5, x1: x + 3.5, z0: z - 2.5, z1: z + 2.5 });
  }

  // ---------------------------------------------------------------- notice board / ice

  private buildBoardAndIce(): void {
    const nb = LAYOUT.noticeBoard, M = this.M, s = this.stat;
    for (const sx of [-1, 1]) cy(0.07, 0.08, 2.4, M.dark, nb.x + sx * 0.95, 1.2, nb.z, s, 6);
    tBox(2.1, 1.3, 0.1, M.wood, 1.2, nb.x, 1.55, nb.z, s);
    bx(2.3, 0.1, 0.16, M.trim, nb.x, 2.25, nb.z, s);
    for (const sx of [-1, 1]) {
      const r = tBox(1.3, 0.08, 0.5, M.blueRoof, 1, nb.x + sx * 0.52, 2.45, nb.z, s);
      r.rotation.z = -sx * 0.4;
    }
    const papers = [0xf6ecd2, 0xe9dcb0, 0xf6ecd2, 0xdfe8d0, 0xf2dcd0];
    papers.forEach((c, i) => {
      const p = bx(0.38, 0.5, 0.02, flat(c, 0.95), nb.x - 0.75 + i * 0.37, 1.55 + (i % 2) * 0.12, nb.z + 0.07, s);
      p.rotation.z = (i - 2) * 0.07;
      put(new THREE.SphereGeometry(0.03, 5, 4), flat(0xc03a2a, 0.5), nb.x - 0.75 + i * 0.37, 1.76 + (i % 2) * 0.12, nb.z + 0.1, s);
    });
    const sign = signMesh('NOTICES', 1.4, 0.3, '#2f4f3a');
    sign.position.set(nb.x, 0.62, nb.z + 0.09);
    s.add(sign);
    this.solid({ x0: nb.x - 1, x1: nb.x + 1, z0: nb.z - 0.2, z1: nb.z + 0.2 });

    const ib = LAYOUT.iceBox;
    tBox(1.7, 0.9, 1.3, M.white, 1.4, ib.x, 0.45, ib.z, s);
    bx(1.8, 0.1, 1.4, flat(0x8fb5c6, 0.4), ib.x, 0.92, ib.z, s);
    for (const dy of [0.2, 0.7]) bx(1.74, 0.05, 1.34, M.iron, ib.x, dy, ib.z, s);
    bx(0.4, 0.12, 0.1, flat(0xb0b6ba, 0.3), ib.x, 0.7, ib.z + 0.68, s);
    const sg = signMesh('ICE', 0.6, 0.25, '#4a7a96');
    sg.position.set(ib.x, 0.45, ib.z + 0.69);
    s.add(sg);
    this.solid({ x0: ib.x - 0.9, x1: ib.x + 0.9, z0: ib.z - 0.7, z1: ib.z + 0.7 });
  }

  private buildQuayDetail(): void {
    const s = this.stat;
    for (let x = -20; x <= 20; x += 5) if (Math.abs(x) > 3) bollard(s, x, 0.08, 0.75);
    barrel(s, 14.6, 5.2 + 0.6, 0, 1, true);
    ropeCoil(s, -6.3, 0, 1.4, 1.2);
    ropeCoil(s, 6.5, 0, 1.2, 1);
    crateBox(s, 8.8, 0, 1.3, 0.7, 0.4);
    crateBox(s, -17.5, 0, 9.2, 0.8, 0.1);
    crateBox(s, -16.5, 0, 9.4, 0.6, 0.7);
    barrel(s, 17.8, 7.5);
    barrel(s, 18.5, 7.1);
    net(this.group, 1.4, 0.8, -2.5, 0.5, 0.9, 0.1);
  }

  // ---------------------------------------------------------------- lanterns

  private lampHead(x: number, y: number, z: number, withLight: boolean, noPole = false): void {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.stat.add(g);
    bx(0.28, 0.05, 0.28, M.iron, 0, -0.13, 0, g);
    put(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 8), lampMat, 0, 0.03, 0, g).castShadow = false;
    put(new THREE.ConeGeometry(0.22, 0.2, 8), M.iron, 0, 0.28, 0, g);
    cy(0.03, 0.03, 0.06, M.iron, 0, 0.42, 0, g, 6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.025, 0.3, 0.025, M.iron, sx * 0.13, 0.03, sz * 0.13, g);
    if (noPole) bx(0.04, 0.5, 0.04, M.iron, 0, 0.55, 0, g);
    const halo = haloSprite(0xffc060, 2.8);
    halo.position.set(x, y + 0.03, z);
    this.group.add(halo);
    let light: THREE.PointLight | null = null;
    if (withLight) {
      light = new THREE.PointLight(0xffc070, 0, 16, 2);
      light.position.set(x, y + 0.1, z);
      this.group.add(light);
    }
    this.lamps.push({ light, halo, phase: Math.random() * 10 });
  }

  private buildLanterns(): void {
    const spots: [number, number, boolean][] = [[-1.85, -4, true], [1.85, -10.5, true], [-1.85, -16, true], [-13, 8.5, true], [-1, 9, true], [13, 9, true], [-1.85, -10.5, false], [1.85, -4, false], [1.85, -16, false]];
    for (const [x, z, light] of spots) {
      const base = z < 0 ? 0.055 : 0;
      cy(0.14, 0.17, 0.3, this.M.iron, x, base + 0.15, z, this.stat, 8);
      cy(0.05, 0.07, 2.2, this.M.iron, x, base + 1.3, z, this.stat, 6);
      bx(0.06, 0.06, 0.4, this.M.iron, x, base + 2.3, z, this.stat);
      this.lampHead(x, base + 2.55, z, light);
    }
  }

  // ---------------------------------------------------------------- per frame

  update(t: number, sky: SkyState, pxScale: number): void {
    windU.value = t;
    const n = sky.lantern;
    windowMat.emissiveIntensity = n * 1.8;
    lampMat.emissiveIntensity = n * 3.2;
    for (const l of this.lamps) {
      const fl = 1 + Math.sin(t * 9 + l.phase) * 0.04 + Math.sin(t * 23 + l.phase * 3) * 0.03;
      if (l.light) l.light.intensity = n * 42 * fl;
      (l.halo.material as THREE.SpriteMaterial).opacity = n * 0.55 * fl;
    }
    for (const s of this.signs) s.m.rotation.z = Math.sin(t * 1.1 + s.phase) * 0.03;
    for (const sm of this.smokes) sm.update(t, pxScale, sky.light);
    this.fireflies.update(t, pxScale, Math.min(1, sky.night * 1.3 + n * 0.3));
    const p = this.flag.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const fx = p.getX(i);
      p.setZ(i, Math.sin(t * 5 - fx * 6) * 0.07 * fx);
    }
    p.needsUpdate = true;
  }

  /** Is the point (with a small radius) standing on the quay or the pier? */
  walkable(x: number, z: number, r: number): boolean {
    const L = LAYOUT;
    const inside = (px: number, pz: number) => {
      const quay = px >= L.quayMinX && px <= L.quayMaxX && pz >= 0 && pz <= L.quayMaxZ;
      const pier = Math.abs(px) <= L.pierHalfWidth && pz <= 0.05 && pz >= L.pierEndZ;
      return quay || pier;
    };
    if (!inside(x, z)) return false;
    if (!(inside(x + r, z) && inside(x - r, z) && inside(x, z + r) && inside(x, z - r))) return false;
    for (const o of this.obstacles) {
      const cx = Math.max(o.x0, Math.min(x, o.x1)), cz = Math.max(o.z0, Math.min(z, o.z1));
      if ((cx - x) ** 2 + (cz - z) ** 2 < r * r) return false;
    }
    return true;
  }

  /** Move from (px,pz) toward (nx,nz), sliding along obstacles and water edges. */
  resolve(px: number, pz: number, nx: number, nz: number, r: number): { x: number; z: number } {
    if (this.walkable(nx, nz, r)) return { x: nx, z: nz };
    if (this.walkable(nx, pz, r)) return { x: nx, z: pz };
    if (this.walkable(px, nz, r)) return { x: px, z: nz };
    return { x: px, z: pz };
  }

  addObstacle(r: Rect): void {
    this.obstacles.push(r);
  }
}
export { groundH };
