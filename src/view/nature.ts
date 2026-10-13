import * as THREE from 'three';
import { addWind } from './fx';

/** Rolling ground height. The quay is flat; the land behind it rises into green hills. */
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function groundH(x: number, z: number): number {
  let h = -0.02;
  h += sm(15, 46, z) * 5.5 * (0.75 + 0.25 * Math.sin(x * 0.09 + 1));
  h += Math.sin(x * 0.17) * Math.cos(z * 0.13) * 0.45 * sm(14, 24, z);
  h += sm(26, 62, Math.abs(x)) * 4.5 * (0.6 + 0.4 * Math.sin(z * 0.1));
  return h;
}

function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function landPatch(map: THREE.Texture, x0: number, x1: number, z0: number, z1: number): THREE.Mesh {
  const step = 1.6;
  const nx = Math.max(1, Math.round((x1 - x0) / step)), nz = Math.max(1, Math.round((z1 - z0) / step));
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = groundH(x, z);
    p.setY(i, h);
    uv.setXY(i, x / 7, z / 7);
    const n = Math.sin(x * 0.31) * Math.sin(z * 0.27) * 0.5 + 0.5;
    c.setHSL(0.27 + 0.02 * n - h * 0.004, 0.55, 0.62 + 0.14 * n + Math.min(0.1, h * 0.02));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}

/** Instanced wind-swayed grass clumps, flower patches, trees and rocks. */
export function buildNature(scene: THREE.Object3D, onGround: (x: number, z: number) => boolean, beds: [number, number, number, number][] = []): { fireflies: [number, number, number][] } {
  // Planted beds on the quay sit just above the paving instead of following the terrain.
  const inBed = (x: number, z: number) => beds.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3]);
  const gy = (x: number, z: number) => (inBed(x, z) ? 0.07 : groundH(x, z));
  const r = rand(42);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // --- grass clumps
  // Meadow tufts are five single-triangle blades. Bed tufts are fewer in number, so they can afford
  // broad three-triangle leaves (base, shoulder, tip) that read as soft cartoon grass close up.
  const tuft = (n: number, leaf: boolean): THREE.BufferGeometry => {
    const pos: number[] = [], vcol: number[] = [], nrm: number[] = [];
    const lo = 0.78, hi = 1.2;   // root and tip brightness: roots sit close to the lawn colour, never near black
    for (let b = 0; b < n; b++) {
      const a = (b / n) * Math.PI * 2 + r();
      const cx = Math.cos(a), cz = Math.sin(a);
      if (!leaf) {
        const lean = 0.25 + r() * 0.3, hgt = 0.45 + r() * 0.35;
        const ox = cx * 0.06, oz = cz * 0.06;
        pos.push(ox - cz * 0.045, 0, oz + cx * 0.045, ox + cz * 0.045, 0, oz - cx * 0.045, ox + cx * lean, hgt, oz + cz * lean);
        vcol.push(lo, lo, lo, lo, lo, lo, hi, hi, hi);
        continue;
      }
      const lean = 0.07 + r() * 0.1, hgt = 0.2 + r() * 0.13, w = 0.036 + r() * 0.012;
      const ox = cx * 0.05, oz = cz * 0.05;
      const sx = ox + cx * lean * 0.4, sz = oz + cz * lean * 0.4, sy = hgt * 0.66, sw = w * 0.82;   // shoulder
      const l0 = [ox - cz * w, 0, oz + cx * w], r0 = [ox + cz * w, 0, oz - cx * w];
      const l1 = [sx - cz * sw, sy, sz + cx * sw], r1 = [sx + cz * sw, sy, sz - cx * sw];
      const tip = [ox + cx * lean, hgt, oz + cz * lean];
      pos.push(...l0, ...r0, ...r1, ...l0, ...r1, ...l1, ...l1, ...r1, ...tip);
      const mid = lo + (hi - lo) * 0.7;
      vcol.push(lo, lo, lo, lo, lo, lo, mid, mid, mid, lo, lo, lo, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, hi, hi, hi);
    }
    for (let i = 0; i < pos.length / 3; i++) nrm.push(0, 1, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(vcol, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  };
  const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  addWind(gm, 'grass', 0.55, 1.0);
  // Blades are lit like the ground they grow from. A two-sided material turns the normal over on back
  // faces, which pointed half the blades at the ground and left them near black; keep it pointing up.
  const windCompile = gm.onBeforeCompile;
  gm.onBeforeCompile = (shader, renderer) => {
    windCompile.call(gm, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  };
  const spots: [number, number][] = [];
  const tryAdd = (x: number, z: number) => { if (onGround(x, z)) spots.push([x, z]); };
  for (let i = 0; i < 7000; i++) tryAdd((r() - 0.5) * 100, 14.4 + Math.pow(r(), 1.5) * 38);
  for (let i = 0; i < 2600; i++) tryAdd((r() < 0.5 ? -1 : 1) * (22.3 + r() * 24), -7.6 + r() * 21.5);
  const grass = new THREE.InstancedMesh(tuft(5, false), gm, spots.length);
  const pal = [0x3f8f3a, 0x5aa83e, 0x78bf45, 0x92cf55, 0x4a9a52];
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, gy(x, z) - 0.02, z);
    dummy.rotation.set(0, r() * 6.28, 0);
    dummy.scale.set(1, 0.7 + r() * 1.0, 1).multiplyScalar(0.9 + r() * 0.8);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, col.set(pal[Math.floor(r() * pal.length)]));
  });
  grass.receiveShadow = true;
  grass.frustumCulled = false;
  scene.add(grass);

  // The quay beds: a trimmed town lawn, not a meadow. Short, broad, bright tufts.
  const bedSpots: [number, number][] = [];
  for (const b of beds) {
    const n = Math.round((b[1] - b[0]) * (b[3] - b[2]) * 9);
    for (let i = 0; i < n; i++) bedSpots.push([b[0] + 0.12 + r() * (b[1] - b[0] - 0.24), b[2] + 0.12 + r() * (b[3] - b[2] - 0.24)]);
  }
  if (bedSpots.length) {
    const lawn = new THREE.InstancedMesh(tuft(6, true), gm, bedSpots.length);
    const bpal = [0x63b544, 0x78c44a, 0x8fd257, 0xa4dc62, 0x6dbd50];
    bedSpots.forEach(([x, z], i) => {
      dummy.position.set(x, gy(x, z) - 0.01, z);
      dummy.rotation.set(0, r() * 6.28, 0);
      dummy.scale.setScalar(0.8 + r() * 0.5);
      dummy.updateMatrix();
      lawn.setMatrixAt(i, dummy.matrix);
      lawn.setColorAt(i, col.set(bpal[Math.floor(r() * bpal.length)]));
    });
    lawn.receiveShadow = true;
    scene.add(lawn);
  }

  // --- flowers
  const centres: [number, number, number][] = [[-16, 16.5, 2.4], [-6, 17.5, 2], [4, 16.2, 2.6], [13, 17.5, 2.2], [20, 16, 2], [-24, 20, 2.5], [9, 22, 2.5], [-31, 6, 2.2], [31, 5, 2.4], [28, 11, 2], [-28, 11, 2]];
  const fl: [number, number, number][] = [];
  for (const [cx, cz, rad] of centres) for (let i = 0; i < 70; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * rad;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (onGround(x, z)) fl.push([x, z, r()]);
  }
  for (const b of beds) for (let i = 0; i < 40; i++) fl.push([b[0] + 0.3 + r() * (b[1] - b[0] - 0.6), b[2] + 0.3 + r() * (b[3] - b[2] - 0.6), r()]);
  const stemG = new THREE.CylinderGeometry(0.012, 0.016, 0.5, 4); stemG.translate(0, 0.25, 0);
  const headG = new THREE.SphereGeometry(0.1, 7, 5); headG.scale(1, 0.55, 1); headG.translate(0, 0.52, 0);
  const stemM = new THREE.MeshStandardMaterial({ color: 0x4e9a45, roughness: 1 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  // A gentle nod: more than this lays the stems flat and shears the heads into long streaks.
  addWind(stemM, 'flstem', 0.14, 2.0); addWind(headM, 'flhead', 0.14, 2.0);
  const stems = new THREE.InstancedMesh(stemG, stemM, fl.length);
  const heads = new THREE.InstancedMesh(headG, headM, fl.length);
  const fpal = [0xffe14a, 0xffffff, 0xff7aa8, 0xb48cf0, 0xff9a3c, 0xfff2b0];
  fl.forEach(([x, z, k], i) => {
    dummy.position.set(x, gy(x, z), z);
    dummy.rotation.set(0, r() * 6.28, 0);
    dummy.scale.setScalar(0.75 + r() * 0.7);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix); heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, col.set(fpal[Math.floor(k * fpal.length) % fpal.length]));
  });
  stems.frustumCulled = heads.frustumCulled = false;
  scene.add(stems, heads);

  // --- trees (instanced trunks + foliage blobs)
  const trees: [number, number, number][] = [[-18, 17, 1.2], [-12, 20, 1], [-5, 18.5, 1.3], [3, 21, 1], [9, 17.5, 1.2], [16, 19, 1.1], [22.6, 16, 1.3], [-25, 12, 1.2], [27, 10, 1.2], [-8, 26, 1.5], [14, 25, 1.4], [-21, 25, 1.3], [-33, 4, 1.4], [34, 2, 1.3], [0, 31, 1.6], [-30, 20, 1.5], [30, 22, 1.5], [24, 30, 1.7], [-12, 33, 1.7]];
  for (const b of beds) trees.push([(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, 0.8]);
  const blobG = new THREE.IcosahedronGeometry(1, 2);
  {
    const p = blobG.attributes.position as THREE.BufferAttribute;
    const cs = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.16 * Math.sin(x * 4.1 + z * 2.3) * Math.cos(y * 3.7 + x * 1.9);
      p.setXYZ(i, x * n, y * n * 0.88, z * n);
      const lt = 0.62 + 0.45 * (y * 0.5 + 0.5);
      cs[i * 3] = cs[i * 3 + 1] = cs[i * 3 + 2] = lt;
    }
    blobG.setAttribute('color', new THREE.BufferAttribute(cs, 3));
    blobG.computeVertexNormals();
  }
  const trunkG = new THREE.CylinderGeometry(0.16, 0.28, 1, 7); trunkG.translate(0, 0.5, 0);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 1 });
  const foliM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  addWind(foliM, 'foli', 0.035, 1.0);
  const nBlob = trees.length * 4;
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, trees.length);
  const foli = new THREE.InstancedMesh(blobG, foliM, nBlob);
  const fpal2 = [0x3f9a4c, 0x4aa84a, 0x5fb44e, 0x6cc058, 0x3c8f55];
  let bi = 0;
  trees.forEach(([x, z, s], i) => {
    const y = gy(x, z);
    dummy.position.set(x, y, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(s, 1.9 * s, s); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    const base = fpal2[i % fpal2.length];
    const offs: [number, number, number, number][] = [[0, 2.7, 0, 1.55], [0.95, 2.3, 0.3, 1.1], [-0.85, 2.4, -0.4, 1.15], [0.1, 3.6, 0.1, 1.0]];
    for (const [ox, oy, oz, rad] of offs) {
      dummy.position.set(x + ox * s, y + oy * s, z + oz * s);
      dummy.rotation.set(0, r() * 6, 0);
      dummy.scale.setScalar(rad * s);
      dummy.updateMatrix();
      foli.setMatrixAt(bi, dummy.matrix);
      foli.setColorAt(bi, col.set(base).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.06));
      bi++;
    }
  });
  trunks.castShadow = foli.castShadow = true;
  trunks.receiveShadow = foli.receiveShadow = true;
  trunks.frustumCulled = foli.frustumCulled = false;
  scene.add(trunks, foli);

  // --- rocks
  const rockG = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = rockG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.22 * Math.sin(x * 5 + y * 3) * Math.cos(z * 4 - y * 2);
      p.setXYZ(i, x * n, y * n * 0.7, z * n);
    }
    rockG.computeVertexNormals();
  }
  const rocks: [number, number, number][] = [[-26, 3, 1.3], [27, 4, 1.1], [-9, 14.8, 0.8], [24, -3, 1.4], [-24.5, -3.5, 1.2], [26, -6.5, 1.0], [-27, -6, 1.5], [-23, -1, 0.9], [25.5, 0.5, 0.8], [-15, 19, 0.7], [18, 21, 0.9], [6, 27, 1.2], [-34, 14, 1.8], [33, 16, 1.6]];
  const rockM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const rk = new THREE.InstancedMesh(rockG, rockM, rocks.length);
  const rpal = [0x8a9096, 0x7d8387, 0x9a9890, 0x6f767c];
  rocks.forEach(([x, z, s], i) => {
    dummy.position.set(x, Math.max(gy(x, z), -0.5) + s * 0.25, z);
    dummy.rotation.set(r(), r() * 6, r() * 0.4);
    dummy.scale.set(s * 1.2, s, s);
    dummy.updateMatrix();
    rk.setMatrixAt(i, dummy.matrix);
    rk.setColorAt(i, col.set(rpal[i % rpal.length]));
  });
  rk.castShadow = rk.receiveShadow = true;
  scene.add(rk);

  return { fireflies: [[-14, 15.5, 0], [-4, 16, 0], [8, 15.5, 0], [17, 16.5, 0], [-24, 14, 0], [25, 13, 0]] };
}
