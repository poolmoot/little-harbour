import * as THREE from 'three';

/** Curved rowboat hull. Bow at -z, keel at y=0, gunwale near y=H. */
const Z0 = -2.2, LEN = 4.0;
const widthAt = (u: number, hw: number) => hw * (u < 0.4 ? Math.pow(Math.sin((u / 0.4) * Math.PI / 2), 0.7) : 1 - 0.26 * Math.pow((u - 0.4) / 0.6, 2));
const topAt = (u: number, H: number) => H + 0.26 * Math.pow(Math.abs(u - 0.5) * 2, 2.4) + (u < 0.12 ? 0.1 : 0);
const keelAt = (u: number) => 0.28 * Math.pow(Math.max(0, (0.38 - u) / 0.38), 2) + 0.1 * Math.pow(Math.max(0, (u - 0.86) / 0.14), 2);

export function hullGeometry(hw = 0.8, H = 0.72, nu = 22, na = 10): THREE.BufferGeometry {
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const w = widthAt(u, hw), top = topAt(u, H), keel = keelAt(u);
    for (let j = 0; j <= na; j++) {
      const a = (j / na - 0.5) * Math.PI;
      pos.push(w * Math.sin(a), keel + (top - keel) * (1 - Math.cos(a)), Z0 + u * LEN);
      uvs.push(u * 3, j / na * 2);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < na; j++) {
    const a = i * (na + 1) + j, b = a + 1, c = a + na + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  // transom
  const base = pos.length / 3;
  const u = 1, top = topAt(u, H);
  for (let j = 0; j <= na; j++) {
    const a = (j / na - 0.5) * Math.PI;
    pos.push(widthAt(u, hw) * Math.sin(a), keelAt(u) + (top - keelAt(u)) * (1 - Math.cos(a)), Z0 + LEN);
    uvs.push(j / na, 0);
  }
  pos.push(0, top, Z0 + LEN); uvs.push(0.5, 1);
  for (let j = 0; j < na; j++) idx.push(base + j, base + na + 1, base + j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Gunwale rim as a tube following the top edge on one side (side = -1 or 1). */
export function gunwale(hw = 0.8, H = 0.72, side = 1, r = 0.04): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    pts.push(new THREE.Vector3(side * widthAt(u, hw), topAt(u, H), Z0 + u * LEN));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, r, 6, false);
}

/** Flat cap across the hull opening, gunwale to gunwale. Drawn depth-only so the sea is never painted inside the boat. */
export function hullLid(hw = 0.8, H = 0.72, nu = 22): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const w = widthAt(u, hw), y = topAt(u, H), z = Z0 + u * LEN;
    pos.push(-w, y, z, w, y, z);
  }
  for (let i = 0; i < nu; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
