import * as THREE from 'three';
import { LAYOUT } from '../sim/config';
import { box, mat } from './figures';
import type { SkyState } from './scene';

export interface Rect {
  x0: number; x1: number; z0: number; z1: number;
}

export function makeSign(text: string, w: number, h: number, bg = '#6b4a2f', fg = '#f6ecd2'): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.max(32, Math.round((256 * h) / w));
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = fg;
    g.lineWidth = 4;
    g.strokeRect(5, 5, c.width - 10, c.height - 10);
    g.fillStyle = fg;
    g.font = `bold ${Math.round(c.height * 0.5)}px "Trebuchet MS", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.castShadow = false;
  return m;
}

function gableRoof(len: number, depth: number, height: number, color: number): THREE.Mesh {
  const r = depth / (2 * 0.866);
  const geo = new THREE.CylinderGeometry(r, r, len, 3);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color));
  m.rotation.z = Math.PI / 2;
  const sx = height / (1.5 * r);
  m.scale.x = sx;
  m.userData.halfBase = 0.5 * r * sx; // distance from centre to base plane
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export class World {
  readonly group = new THREE.Group();
  readonly obstacles: Rect[] = [];
  private sea: THREE.Mesh;
  private seaBase: Float32Array;
  private seaMat: THREE.MeshStandardMaterial;
  private lights: THREE.PointLight[] = [];
  private bulbs: THREE.MeshStandardMaterial[] = [];
  private windows: THREE.MeshStandardMaterial[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.buildGround();
    this.buildPier();
    this.buildMarket();
    this.buildShipyard();
    this.buildInn();
    this.buildBoardAndIce();
    this.buildDecor();
    this.buildLanterns();

    const geo = new THREE.PlaneGeometry(420, 420, 105, 105);
    geo.rotateX(-Math.PI / 2);
    this.seaBase = new Float32Array(geo.attributes.position.array);
    this.seaMat = new THREE.MeshStandardMaterial({ color: 0x2a93b5, roughness: 0.55, flatShading: true });
    this.sea = new THREE.Mesh(geo, this.seaMat);
    this.sea.position.y = -0.7;
    this.sea.receiveShadow = false;
    this.group.add(this.sea);
  }

  private solid(r: Rect): void {
    this.obstacles.push(r);
  }

  private buildGround(): void {
    const L = LAYOUT;
    const quay = box(L.quayMaxX - L.quayMinX, 1.4, L.quayMaxZ, 0xcdc2a6, 0, -0.7, L.quayMaxZ / 2, this.group);
    quay.castShadow = false;
    // Slightly darker lip along the water's edge.
    box(L.quayMaxX - L.quayMinX, 0.12, 0.5, 0xa89f88, 0, 0.02, 0.25, this.group).castShadow = false;
    const grass = (x0: number, x1: number, z0: number, z1: number, c = 0x8fb573) => {
      const m = box(x1 - x0, 1.4, z1 - z0, c, (x0 + x1) / 2, -0.72, (z0 + z1) / 2, this.group);
      m.castShadow = false;
    };
    grass(-90, 90, L.quayMaxZ, 90);
    grass(L.quayMaxX, 90, -8, L.quayMaxZ, 0x9dbd7c);
    grass(-90, L.quayMinX, -8, L.quayMaxZ, 0x9dbd7c);
    // Rocky shore blocks at the quay ends
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const r = box(2.2 + i * 0.3, 1.2, 2 + (i % 2), 0x8a8f94, sx * (23.5 + i * 2.2), -0.4, -2.5 - i * 1.2);
        r.rotation.y = i * 0.7;
        this.group.add(r);
      }
    }
  }

  private buildPier(): void {
    const L = LAYOUT;
    const len = -L.pierEndZ;
    const w = L.pierHalfWidth * 2;
    box(w, 0.35, len, 0xa9825a, 0, -0.12, -len / 2, this.group);
    for (let i = 0; i < len; i += 1) {
      const m = box(w - 0.1, 0.02, 0.06, 0x7b5a3a, 0, 0.06, -i - 0.5, this.group);
      m.castShadow = false;
    }
    for (let z = -1; z >= L.pierEndZ + 0.5; z -= 3) {
      for (const sx of [-1, 1]) cyl(0.17, 0.2, 2.2, 0x5a4330, sx * (L.pierHalfWidth - 0.05), -0.65, z, this.group);
    }
    // Bollards at each berth
    for (const b of L.berths) cyl(0.14, 0.18, 0.4, 0x3c3c3c, b.edgeX * 1.05, 0.2, b.edgeZ + 1.2, this.group);
    // Fishing spot: bucket and rod rack at the pier end
    cyl(0.25, 0.2, 0.4, 0x4a6fa5, 1.3, 0.2, L.pierEndZ + 0.8, this.group);
    box(0.08, 1.2, 0.08, 0x6b4a2f, -1.4, 0.6, L.pierEndZ + 0.6, this.group);
    box(0.5, 0.04, 0.5, 0xf2c14e, 0, 0.06, L.fishingSpot.z, this.group).castShadow = false;
  }

  private buildMarket(): void {
    const { x, z } = LAYOUT.market;
    box(4.2, 1.0, 2.0, 0x9c6b43, x, 0.5, z, this.group);
    box(4.4, 0.1, 2.2, 0xc99a68, x, 1.02, z, this.group);
    for (const dx of [-2, 2]) for (const dz of [-0.9, 0.9]) cyl(0.07, 0.07, 2.8, 0x6b4a2f, x + dx, 1.4, z + dz, this.group, 6);
    for (let i = 0; i < 7; i++) {
      const s = box(0.64, 0.08, 2.8, i % 2 ? 0xf3ede0 : 0xcf4a3a, x - 1.92 + i * 0.64, 2.86, z + 0.1, this.group);
      s.rotation.x = 0.18;
    }
    const sign = makeSign('FISH MARKET', 2.6, 0.5, '#2f6f8f');
    sign.position.set(x, 2.35, z + 1.15);
    this.group.add(sign);
    // Fish trays on the counter
    for (let i = 0; i < 4; i++) box(0.7, 0.12, 0.5, [0xb8c7d6, 0x4f8fb0, 0xd2b48c, 0xe05a4f][i], x - 1.4 + i * 0.95, 1.13, z + 0.3, this.group);
    this.solid({ x0: x - 2.2, x1: x + 2.2, z0: z - 1.1, z1: z + 1.1 });
    // barrels
    cyl(0.4, 0.4, 0.8, 0x7a5a3a, x + 3.0, 0.4, z + 0.6, this.group);
    cyl(0.4, 0.4, 0.8, 0x7a5a3a, x + 3.6, 0.4, z + 0.1, this.group);
    this.solid({ x0: x + 2.5, x1: x + 4.1, z0: z - 0.4, z1: z + 1.1 });
  }

  private buildShipyard(): void {
    const { x, z } = LAYOUT.shipyard;
    box(6, 3, 4, 0x8c6a4a, x, 1.5, z, this.group);
    box(1.4, 2.2, 0.1, 0x4a3426, x - 1, 1.1, z + 2.03, this.group);
    box(1.6, 1.2, 0.1, 0x3a2a20, x + 1.6, 1.8, z + 2.03, this.group);
    const roof = gableRoof(6.8, 5, 1.7, 0x4f6d86);
    roof.position.set(x, 3 + roof.userData.halfBase, z);
    this.group.add(roof);
    const sign = makeSign('SHIPYARD', 2.4, 0.55, '#3b5167');
    sign.position.set(x, 3.35, z + 2.1);
    this.group.add(sign);
    // an upturned hull on trestles beside it
    const hull = box(3, 0.7, 1.2, 0x7b4b32, x + 4.6, 0.85, z + 0.8, this.group);
    hull.scale.set(1, 1, 1);
    box(0.2, 0.5, 1.4, 0x5a4330, x + 3.5, 0.25, z + 0.8, this.group);
    box(0.2, 0.5, 1.4, 0x5a4330, x + 5.7, 0.25, z + 0.8, this.group);
    this.solid({ x0: x - 3, x1: x + 3, z0: z - 2, z1: z + 2 });
    this.solid({ x0: x + 3.1, x1: x + 6.1, z0: z + 0.1, z1: z + 1.5 });
  }

  private buildInn(): void {
    const { x, z } = LAYOUT.inn;
    box(7, 3, 5, 0xe8dcc2, x, 1.5, z, this.group);
    box(6.2, 2.2, 4.4, 0x9a6a46, x, 4.1, z, this.group);
    const roof = gableRoof(7.6, 5.4, 1.9, 0xa8473a);
    roof.position.set(x, 5.2 + roof.userData.halfBase, z);
    this.group.add(roof);
    box(0.6, 1.6, 0.6, 0x8a8f94, x + 2.4, 6.2, z - 0.5, this.group);
    box(1.3, 2.2, 0.1, 0x4a3426, x - 1.8, 1.1, z + 2.53, this.group);
    for (const [wx, wy] of [[0.8, 1.7], [2.5, 1.7], [-1.8, 4.1], [0.2, 4.1], [2.2, 4.1]] as const) {
      const wm = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, emissive: 0xffd88a, emissiveIntensity: 0, roughness: 0.4 });
      this.windows.push(wm);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), wm);
      w.position.set(x + wx, wy, z + (wy > 3 ? 2.23 : 2.53));
      this.group.add(w);
    }
    const sign = makeSign('THE ANCHOR INN', 3.0, 0.55, '#7a2f2a');
    sign.position.set(x, 3.25, z + 2.56);
    this.group.add(sign);
    this.solid({ x0: x - 3.5, x1: x + 3.5, z0: z - 2.5, z1: z + 2.5 });
  }

  private buildBoardAndIce(): void {
    const nb = LAYOUT.noticeBoard;
    box(0.14, 2.2, 0.14, 0x5a4330, nb.x - 0.9, 1.1, nb.z, this.group);
    box(0.14, 2.2, 0.14, 0x5a4330, nb.x + 0.9, 1.1, nb.z, this.group);
    box(2.1, 1.3, 0.1, 0x8c6a4a, nb.x, 1.55, nb.z, this.group);
    const papers = [0xf6ecd2, 0xe9dcb0, 0xf6ecd2, 0xdfe8d0];
    papers.forEach((c, i) => {
      const p = box(0.42, 0.55, 0.02, c, nb.x - 0.7 + i * 0.47, 1.6 + (i % 2) * 0.1, nb.z + 0.07, this.group);
      p.rotation.z = (i - 1.5) * 0.06;
    });
    const sign = makeSign('NOTICES', 1.4, 0.3, '#2f4f3a');
    sign.position.set(nb.x, 2.4, nb.z + 0.1);
    this.group.add(sign);
    this.solid({ x0: nb.x - 1, x1: nb.x + 1, z0: nb.z - 0.2, z1: nb.z + 0.2 });

    const ib = LAYOUT.iceBox;
    box(1.7, 0.9, 1.3, 0xcfe6ef, ib.x, 0.45, ib.z, this.group);
    box(1.8, 0.1, 1.4, 0x8fb5c6, ib.x, 0.92, ib.z, this.group);
    box(0.4, 0.12, 0.1, 0x555b60, ib.x, 0.7, ib.z + 0.66, this.group);
    const s = makeSign('ICE', 0.6, 0.25, '#4a7a96');
    s.position.set(ib.x, 0.5, ib.z + 0.66);
    this.group.add(s);
    this.solid({ x0: ib.x - 0.9, x1: ib.x + 0.9, z0: ib.z - 0.7, z1: ib.z + 0.7 });
  }

  private tree(x: number, z: number, s = 1): void {
    const g = new THREE.Group();
    cyl(0.18 * s, 0.26 * s, 1.6 * s, 0x6b4a2f, 0, 0.8 * s, 0, g, 6);
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.3 * s, 2.4 * s, 7), mat(0x4f8a52));
    c1.position.y = 2.4 * s;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.0 * s, 2.0 * s, 7), mat(0x5c9a5e));
    c2.position.y = 3.6 * s;
    c1.castShadow = c2.castShadow = true;
    g.add(c1, c2);
    g.position.set(x, 0, z);
    this.group.add(g);
  }

  private buildDecor(): void {
    const trees: [number, number, number][] = [[-18, 17, 1.2], [-12, 20, 1], [-5, 18, 1.3], [3, 21, 1], [9, 17, 1.2], [16, 19, 1.1], [22, 16, 1.3], [-24, 12, 1], [26, 10, 1.1], [-8, 25, 1.4], [14, 24, 1.3], [-20, 24, 1.2]];
    for (const [x, z, s] of trees) this.tree(x, z, s);
    for (const [x, z] of [[-20, 15], [-1, 16], [12, 15.5], [19, 17], [-14, 16.5]] as const) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(0x6aa468));
      b.position.set(x, 0.3, z);
      b.scale.y = 0.7;
      b.castShadow = true;
      this.group.add(b);
    }
    // bollards along the quay edge
    for (let x = -20; x <= 20; x += 5) if (Math.abs(x) > 3) cyl(0.14, 0.18, 0.4, 0x3c3c3c, x, 0.2, 0.7, this.group);
    // barrels & crates by the inn
    cyl(0.4, 0.4, 0.8, 0x7a5a3a, 14.6, 0.4, 5.2, this.group);
    box(0.8, 0.8, 0.8, 0x9c7a50, 15.4, 0.4, 4.6, this.group);
    // small rocks
    for (const [x, z, s] of [[-26, 3, 1.2], [27, 5, 1], [-9, 14.8, 0.8]] as const) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(0x8a8f94));
      r.position.set(x, s * 0.4, z);
      r.castShadow = true;
      this.group.add(r);
    }
  }

  private buildLanterns(): void {
    const spots: [number, number, boolean][] = [[-1.85, -4, true], [1.85, -10.5, true], [-1.85, -16, true], [-13, 8.5, true], [-1, 9, true], [13, 9, true], [-1.85, -10.5, false], [1.85, -4, false], [1.85, -16, false]];
    for (const [x, z, light] of spots) {
      cyl(0.06, 0.08, 2.4, 0x2f3438, x, 1.2, z, this.group, 6);
      const bm = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc860, emissiveIntensity: 0 });
      this.bulbs.push(bm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bm);
      bulb.position.set(x, 2.5, z);
      this.group.add(bulb);
      if (light) {
        const pl = new THREE.PointLight(0xffc870, 0, 15, 2);
        pl.position.set(x, 2.5, z);
        this.group.add(pl);
        this.lights.push(pl);
      }
    }
  }

  update(t: number, sky: SkyState): void {
    const pos = this.sea.geometry.attributes.position as THREE.BufferAttribute;
    const base = this.seaBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      pos.setY(i, Math.sin(x * 0.33 + t * 1.2) * 0.07 + Math.cos(z * 0.27 + t * 0.9) * 0.07 + Math.sin((x + z) * 0.15 + t * 0.6) * 0.05);
    }
    pos.needsUpdate = true;
    this.seaMat.color.copy(sky.sea).multiplyScalar(0.92 + Math.sin(t * 0.35) * 0.08);
    const n = sky.lantern;
    for (const b of this.bulbs) b.emissiveIntensity = n * 2.2;
    for (const l of this.lights) l.intensity = n * 38;
    for (const w of this.windows) w.emissiveIntensity = n * 1.3;
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
