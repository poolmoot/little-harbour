/** Walking collision: a circle (the walker) against turned boxes, discs and the shape of the ground. Pure maths, no Three.js. */

export interface Obb { cx: number; cz: number; hx: number; hz: number; a: number }
export interface Disc { cx: number; cz: number; r: number }
export type Solid = Obb | Disc;
export interface Pt { x: number; z: number }
/** Walkable ground: a rectangle (x0, x1, z0, z1) or a round patch. */
export type Area = [number, number, number, number] | { cx: number; cz: number; r: number; zMax?: number };

const isDisc = (s: Solid): s is Disc => (s as Disc).r !== undefined;

/** Push the walker (centre p, radius r) out of a solid, along the shortest way. Returns true if it moved. Sliding along walls and round corners falls out of this naturally. */
export function pushOut(s: Solid, p: Pt, r: number): boolean {
  if (isDisc(s)) {
    const dx = p.x - s.cx, dz = p.z - s.cz, d = Math.hypot(dx, dz), need = s.r + r;
    if (d >= need) return false;
    if (d < 1e-6) { p.x = s.cx + need; return true; }
    p.x = s.cx + (dx / d) * need;
    p.z = s.cz + (dz / d) * need;
    return true;
  }
  const c = Math.cos(s.a), n = Math.sin(s.a);
  // into the box's own frame (x across, z along its door side)
  const dx = p.x - s.cx, dz = p.z - s.cz;
  const lx = dx * c - dz * n, lz = dx * n + dz * c;
  const qx = Math.max(-s.hx, Math.min(s.hx, lx)), qz = Math.max(-s.hz, Math.min(s.hz, lz));
  let ox = lx - qx, oz = lz - qz;
  const d = Math.hypot(ox, oz);
  let nx: number, nz: number;
  if (d >= r) return false;
  if (d > 1e-6) { nx = qx + (ox / d) * r; nz = qz + (oz / d) * r; }
  else {
    // centre is inside the box: leave by the nearest face
    const gx = s.hx - Math.abs(lx), gz = s.hz - Math.abs(lz);
    if (gx < gz) { nx = Math.sign(lx || 1) * (s.hx + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (s.hz + r); }
  }
  ox = nx; oz = nz;
  p.x = s.cx + ox * c + oz * n;
  p.z = s.cz - ox * n + oz * c;
  return true;
}

export function overlaps(s: Solid, x: number, z: number, r: number): boolean {
  const p = { x, z };
  return pushOut(s, p, r);
}

/** The nearest spot to p that lies inside one of the areas, shrunk by r so the whole circle stays on the ground. */
export function clampToAreas(areas: Area[], p: Pt, r: number): void {
  let bx = p.x, bz = p.z, best = Infinity;
  for (const a of areas) {
    let x: number, z: number;
    if (Array.isArray(a)) {
      x = Math.max(a[0] + r, Math.min(a[1] - r, p.x)); z = Math.max(a[2] + r, Math.min(a[3] - r, p.z));
    } else {
      const dx = p.x - a.cx, dz = p.z - a.cz, d = Math.hypot(dx, dz), lim = a.r - r;
      if (d <= lim || d < 1e-9) { x = p.x; z = p.z; } else { x = a.cx + (dx / d) * lim; z = a.cz + (dz / d) * lim; }
      if (a.zMax !== undefined && z > a.zMax - r) { z = a.zMax - r; const dz2 = z - a.cz, rem = Math.sqrt(Math.max(0, lim * lim - dz2 * dz2)); x = Math.max(a.cx - rem, Math.min(a.cx + rem, x)); }
    }
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < best) { best = d; bx = x; bz = z; }
  }
  p.x = bx; p.z = bz;
}

export function inAreas(areas: Area[], x: number, z: number, r: number): boolean {
  return areas.some((a) => (Array.isArray(a)
    ? x >= a[0] + r - 1e-9 && x <= a[1] - r + 1e-9 && z >= a[2] + r - 1e-9 && z <= a[3] - r + 1e-9
    : Math.hypot(x - a.cx, z - a.cz) <= a.r - r + 1e-9 && (a.zMax === undefined || z <= a.zMax - r + 1e-9)));
}

/** Move a walker to (nx, nz), pushed out of solids and kept on the ground. Falls back to the old spot if it cannot find a free one. */
export function resolveMove(areas: Area[], solids: Solid[], prev: Pt, nx: number, nz: number, r: number): Pt {
  const p = { x: nx, z: nz };
  for (let i = 0; i < 4; i++) {
    let moved = false;
    for (const s of solids) if (pushOut(s, p, r)) moved = true;
    const bx = p.x, bz = p.z;
    clampToAreas(areas, p, r);
    if (!moved && bx === p.x && bz === p.z) break;
  }
  for (const s of solids) if (overlaps(s, p.x, p.z, r - 0.01)) return { x: prev.x, z: prev.z };
  return p;
}
