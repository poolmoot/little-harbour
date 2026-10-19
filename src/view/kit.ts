import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures';
import { seeThrough } from './occlusion';
import { addInk, inkGeometry, inkMesh, thinnestSide } from './ink';

/** Shared materials, geometry helpers and prop factories for the harbour. Everything is built from code. */

/**
 * Cel shading for the world, to match the characters: sunlight falls in three flat steps
 * (facing the light, turned partly away, turned fully away) instead of a smooth fade.
 * The steps have slightly soft edges so big flat surfaces do not pop as the sun moves.
 */
const TOON_PART_LIT = 0.62;                 // share of the light a surface turned partly away gets
const TOON_LIT_FROM = 0.34, TOON_LIT_TO = 0.5; // facing (0..1) over which a surface goes from part lit to fully lit
const TOON_DARK_TO = 0.06;                  // facing below which a surface falls into shade
const TOON_LIGHTS = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  'vec3 irradiance = dotNL * directLight.color;',
  'vec3 irradiance = toonBand( dotNL ) * directLight.color;',
);
const TOON_BAND = `
float toonBand( float facing ) {
  float lit = mix( ${TOON_PART_LIT.toFixed(2)}, 1.0, smoothstep( ${TOON_LIT_FROM.toFixed(2)}, ${TOON_LIT_TO.toFixed(2)}, facing ) );
  return lit * smoothstep( 0.0, ${TOON_DARK_TO.toFixed(2)}, facing );
}`;
function toonCompile(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> }): void {
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', TOON_BAND + TOON_LIGHTS);
  seeThrough(shader);
}
/** Give a lit material the world's cel shading. Its other settings (colour, map, glow, roughness) keep working. */
export function toon<T extends THREE.MeshStandardMaterial>(m: T): T {
  m.onBeforeCompile = toonCompile;
  return m;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();
/** Plain coloured materials made by flat(): bake() merges all of these into one vertex-coloured material per roughness, so they cost one draw call between them. */
const flatMats = new WeakSet<THREE.Material>();
const vertexFlat = new Map<number, THREE.MeshStandardMaterial>();
export function flat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
  const k = `f${color}-${rough}`;
  let m = cache.get(k);
  if (!m) { m = toon(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })); cache.set(k, m); flatMats.add(m); }
  return m;
}
function vertexFlatFor(rough: number): THREE.MeshStandardMaterial {
  let m = vertexFlat.get(rough);
  if (!m) { m = toon(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: rough, metalness: 0 })); vertexFlat.set(rough, m); }
  return m;
}
/** Can this material be replaced by the shared vertex-coloured one (a plain, opaque, front-faced flat() colour that nobody has changed)? */
const isPlainFlat = (m: THREE.Material): m is THREE.MeshStandardMaterial => {
  const f = m as THREE.MeshStandardMaterial;
  return flatMats.has(m) && f.side === THREE.FrontSide && !f.transparent && f.opacity === 1 && !f.map && f.emissive.getHex() === 0;
};
export function tex(key: string, map: THREE.Texture, rough = 0.92, color = 0xffffff): THREE.MeshStandardMaterial {
  let m = cache.get(key);
  if (!m) { m = toon(new THREE.MeshStandardMaterial({ map, roughness: rough, color })); cache.set(key, m); }
  return m;
}

/** Window glass: one shared material, driven by the day-night cycle. */
export const windowMat = toon(new THREE.MeshStandardMaterial({ color: 0x9fd0e0, emissive: 0xffc866, emissiveIntensity: 0, roughness: 0.25 }));
export const lampMat = toon(new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc060, emissiveIntensity: 0, roughness: 0.4 }));

export function mats() {
  return {
    cobble: tex('cobble', TX.cobble(), 0.95, 0xffeed8),
    lip: tex('lip', TX.quayLip(), 0.9),
    wall: tex('stonewall', TX.stoneWall(), 0.95),
    pier: tex('pier', TX.pierPlanks(), 0.85),
    wood: tex('wallwood', TX.wallPlanks(), 0.9),
    dark: tex('darkwood', TX.darkPlanks(), 0.9),
    crate: tex('crate', TX.crateWood(), 0.85),
    cream: tex('cream', TX.plaster('cream', [246, 226, 184]), 0.95),
    white: tex('white', TX.plaster('white', [244, 240, 228]), 0.95),
    redRoof: tex('redroof', TX.roofTiles('red', [210, 80, 58]), 0.85),
    blueRoof: tex('blueroof', TX.roofTiles('blue', [66, 122, 176]), 0.85),
    greenRoof: tex('greenroof', TX.roofTiles('green', [84, 154, 98]), 0.85),
    grass: tex('grass', TX.grass(), 1),
    trim: flat(0x6a4630),
    iron: flat(0x34384a, 0.6),
    rope: flat(0xd8bc80),
    stone: flat(0x9aa2b4),
  };
}

export function tBox(w: number, h: number, d: number, m: THREE.Material, tile: number, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
  }
  return put(g, m, x, y, z, parent);
}
export function put(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent?.add(mesh);
  return mesh;
}
export function bx(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  return put(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
}
export function cy(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D, seg = 10): THREE.Mesh {
  return put(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent);
}

/**
 * Merge all meshes under `root` that share a material into one draw call. Instanced meshes are left alone.
 * Every shadow-casting part also goes into one shared ink outline (see ink.ts); flat ground slabs and
 * glowing glass cast no shadow and so stay unlined. Set `userData.noInk` to leave a part out.
 */
export function bake(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { m: THREE.Material; cast: boolean; recv: boolean; gs: THREE.BufferGeometry[] }>();
  const dead: THREE.Mesh[] = [];
  const shells: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || mesh.userData.keep || Array.isArray(mesh.material)) return;
    let g = mesh.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    let material = mesh.material;
    if (isPlainFlat(material)) {
      // every flat colour in this group shares one vertex-coloured material (one draw call instead of one per colour)
      const n = g.attributes.position.count, col = new Float32Array(n * 3), c = material.color;
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      material = vertexFlatFor(Math.round(material.roughness * 4) / 4);   // roughness in quarters: a handful of buckets, not one per value
    }
    const key = `${material.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) { b = { m: material, cast: mesh.castShadow, recv: mesh.receiveShadow, gs: [] }; buckets.set(key, b); }
    b.gs.push(g);
    dead.push(mesh);
    const shell = mesh.castShadow && !mesh.userData.noInk ? inkGeometry(g, thinnestSide(mesh)) : null;
    if (shell) shells.push(shell);
  });
  for (const m of dead) { m.parent?.remove(m); m.geometry.dispose(); }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.gs, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.m);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    root.add(mesh);
  }
  const ink = inkMesh(shells);
  if (ink) root.add(ink);
}

// ---- reusable shapes ------------------------------------------------------

let barrelGeo: THREE.LatheGeometry | null = null;
export function barrel(parent: THREE.Object3D, x: number, z: number, y = 0, s = 1, lid = true): void {
  const M = mats();
  barrelGeo ??= new THREE.LatheGeometry([[0.0, 0], [0.27, 0], [0.33, 0.12], [0.37, 0.4], [0.33, 0.68], [0.27, 0.8], [0.0, 0.8]].map(([r, h]) => new THREE.Vector2(r, h)), 14);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  g.rotation.y = x * 7 + z * 3;
  put(barrelGeo, tex('barrel', TX.boards('barrel', [164, 104, 58], 10, false), 0.9), 0, 0, 0, g);
  for (const [h, r] of [[0.14, 0.34], [0.4, 0.385], [0.66, 0.34]] as const) cy(r, r, 0.045, M.iron, 0, h, 0, g, 14);
  if (lid) cy(0.27, 0.27, 0.025, M.dark, 0, 0.8, 0, g, 12);
  parent.add(g);
}

export function crateBox(parent: THREE.Object3D, x: number, y: number, z: number, s = 0.8, ry = 0): void {
  const M = mats();
  const g = new THREE.Group();
  g.position.set(x, y + s / 2, z);
  g.rotation.y = ry;
  tBox(s, s, s, M.crate, 0.9, 0, 0, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.07 * s, s * 1.01, 0.07 * s, M.dark, (sx * s) / 2, 0, (sz * s) / 2, g);
  bx(s * 1.01, 0.07 * s, s * 1.01, M.dark, 0, s / 2, 0, g);
  parent.add(g);
}

export function ropeCoil(parent: THREE.Object3D, x: number, y: number, z: number, s = 1): void {
  const M = mats();
  for (let i = 0; i < 3; i++) {
    const t = put(new THREE.TorusGeometry(0.22 * s - i * 0.015, 0.045 * s, 6, 14), M.rope, x, y + 0.05 + i * 0.07 * s, z, parent);
    t.rotation.x = Math.PI / 2;
  }
}

export function bollard(parent: THREE.Object3D, x: number, y: number, z: number): void {
  const M = mats();
  cy(0.13, 0.17, 0.42, M.iron, x, y + 0.21, z, parent, 10);
  cy(0.19, 0.14, 0.1, M.iron, x, y + 0.45, z, parent, 10);
  const t = put(new THREE.TorusGeometry(0.15, 0.03, 5, 12), M.rope, x, y + 0.3, z, parent);
  t.rotation.x = Math.PI / 2;
}

/** Fish-shaped geometry (nose to +x). */
let fishG: THREE.BufferGeometry | null = null;
export function fishGeo(): THREE.BufferGeometry {
  if (fishG) return fishG;
  const body = new THREE.SphereGeometry(0.5, 10, 7);
  body.scale(1, 0.34, 0.26);
  const tail = new THREE.ConeGeometry(0.22, 0.4, 4);
  tail.rotateZ(Math.PI / 2);
  tail.scale(1, 1, 0.3);
  tail.translate(-0.62, 0, 0);
  const fin = new THREE.ConeGeometry(0.1, 0.25, 3);
  fin.translate(0.05, 0.22, 0);
  fishG = mergeGeometries([body, tail, fin].map((g) => (g.index ? g.toNonIndexed() : g)));
  return fishG as THREE.BufferGeometry;
}

export function net(parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h, 8, 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.3) * 0.12 + (p.getY(i) < 0 ? 0.05 : 0));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon(new THREE.MeshStandardMaterial({ map: TX.net(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, color: 0xb8a878 })));
  const map = (m.material as THREE.MeshStandardMaterial).map as THREE.Texture;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(w / 0.7, h / 0.7);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.userData.keep = true;
  parent.add(m);
  return m;
}

/** A signboard: a thin box with the sign painted on it (one material, so one draw call; the edges are too thin to matter). It casts no shadow. */
export function signMesh(text: string, w: number, h: number, bg?: string, fg?: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), toon(new THREE.MeshStandardMaterial({ map: TX.sign(text, w, h, bg, fg), roughness: 0.9 })));
  m.castShadow = false;
  m.userData.keep = true;
  addInk(m);
  return m;
}

/** Window with frame, mullions, sill and optional shutters / flower box. Faces +z. */
export function windowAt(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, opt: { shutter?: number; flowers?: boolean; ry?: number } = {}): void {
  const M = mats();
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = opt.ry ?? 0;
  bx(w + 0.18, h + 0.18, 0.08, M.trim, 0, 0, 0, g);
  bx(w, h, 0.06, windowMat, 0, 0, 0.04, g);
  bx(0.05, h, 0.05, M.trim, 0, 0, 0.07, g);
  bx(w, 0.05, 0.05, M.trim, 0, 0, 0.07, g);
  bx(w + 0.36, 0.08, 0.26, M.lip, 0, -h / 2 - 0.1, 0.1, g);
  if (opt.shutter !== undefined) {
    const sm = flat(opt.shutter, 0.8);
    for (const sx of [-1, 1]) bx(w * 0.46, h + 0.1, 0.05, sm, sx * (w / 2 + w * 0.26), 0, 0.03, g);
  }
  if (opt.flowers) {
    bx(w + 0.2, 0.18, 0.2, M.dark, 0, -h / 2 - 0.26, 0.2, g);
    const cols = [0xf2c14e, 0xe8587a, 0xf6f0e0, 0xc27ad8];
    for (let i = 0; i < 6; i++) {
      put(new THREE.SphereGeometry(0.075, 6, 5), flat(cols[i % 4], 0.8), -w / 2 + 0.1 + (i * (w - 0.2)) / 5, -h / 2 - 0.1, 0.22, g);
      put(new THREE.SphereGeometry(0.1, 6, 5), flat(0x4f9a4a, 1), -w / 2 + 0.1 + (i * (w - 0.2)) / 5, -h / 2 - 0.15, 0.2, g);
    }
  }
  parent.add(g);
}

/** Gable roof with ridge along x. Returns the roof apex y (local). */
export function gableRoof(parent: THREE.Object3D, w: number, d: number, y: number, rise: number, roofMat: THREE.Material, wallMat: THREE.Material, over = 0.45): void {
  const M = mats();
  const hd = d / 2 + over;
  const L = Math.hypot(hd, rise);
  const a = Math.atan2(rise, hd);
  for (const s of [-1, 1]) {
    const slab = tBox(w + 0.7, 0.14, L, roofMat, 1.6, 0, y + rise / 2 + 0.07, (s * hd) / 2, parent);
    slab.rotation.x = s * a;
    // fascia board
    bx(w + 0.7, 0.12, 0.07, M.trim, 0, y + 0.02, s * hd, parent);
  }
  bx(w + 0.76, 0.12, 0.2, M.trim, 0, y + rise + 0.12, 0, parent);
  // gable end triangles
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rise); sh.closePath();
  const eg = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
  eg.rotateY(Math.PI / 2);
  eg.translate(-w / 2, 0, 0);
  const uv = eg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.4, uv.getY(i) * 0.4);
  put(eg, wallMat, 0, y, 0, parent);
}

export function chimney(parent: THREE.Object3D, x: number, y: number, z: number, h = 1.4): THREE.Vector3 {
  const M = mats();
  tBox(0.62, h, 0.62, M.wall, 1.2, x, y + h / 2, z, parent);
  bx(0.78, 0.12, 0.78, M.lip, x, y + h + 0.05, z, parent);
  return new THREE.Vector3(x, y + h + 0.15, z);
}

export function doorAt(parent: THREE.Object3D, x: number, z: number, w = 1.2, h = 2.1, ry = 0): void {
  const M = mats();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  bx(w + 0.3, h + 0.2, 0.1, M.trim, 0, h / 2 + 0.1, 0, g);
  tBox(w, h, 0.08, M.dark, 1.2, 0, h / 2, 0.05, g);
  bx(w, 0.07, 0.1, M.iron, 0, h * 0.25, 0.1, g);
  bx(w, 0.07, 0.1, M.iron, 0, h * 0.75, 0.1, g);
  put(new THREE.SphereGeometry(0.06, 6, 5), flat(0xd8b050, 0.4), w * 0.32, h * 0.5, 0.12, g);
  bx(w + 0.5, 0.14, 0.7, M.lip, 0, 0.07, 0.35, g);
  bx(w * 0.7, 0.28, 0.06, windowMat, 0, h + 0.38, 0.03, g);
  parent.add(g);
}
