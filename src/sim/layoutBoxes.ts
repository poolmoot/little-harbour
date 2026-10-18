import { BUILDING_IDS, LAYOUT, PLOT_HALF, toWorld } from './config';

/** Ground footprints of everything standing on the quay, turned boxes as in the view, used by the layout tests. */
export interface Box { name: string; cx: number; cz: number; hx: number; hz: number; a: number }
export const L = LAYOUT;
const box = (name: string, o: { x: number; z: number; rot?: number }, lx: number, lz: number, hx: number, hz: number): Box => {
  const c = toWorld(o, lx, lz);
  return { name, cx: c.x, cz: c.z, hx, hz, a: o.rot ?? 0 };
};
export const BOXES: Box[] = [
  box('market', { x: L.market.x, z: L.market.z }, 0, 0, 4.4, 1.15),
  box('shipyard', L.shipyard, 0, 0, 3, 2), box('shipyard hull', L.shipyard, -0.6, -3.1, 1.7, 0.8),
  box('inn', { x: L.inn.x, z: L.inn.z }, 0, 0, 3.5, 2.5),
  box('tower', { x: L.bellTower.x, z: L.bellTower.z }, 0, 0, 1.3, 1.3),
  box('board', { x: L.noticeBoard.x, z: L.noticeBoard.z }, 0, 0, 1, 0.3),
  box('icebox', { x: L.iceBox.x, z: L.iceBox.z }, 0, 0, 0.9, 0.7),
  ...BUILDING_IDS.map((id) => box(id, L.plots[id], 0, 0, PLOT_HALF[id][0], PLOT_HALF[id][1])),
];
const axes = (b: Box) => [[Math.cos(b.a), -Math.sin(b.a)], [Math.sin(b.a), Math.cos(b.a)]];
export function overlap(p: Box, q: Box, gap = 0): boolean {
  for (const b of [p, q]) for (const [ax, az] of axes(b)) {
    const proj = (o: Box) => {
      const c = o.cx * ax + o.cz * az;
      const r = o.hx * Math.abs(axes(o)[0][0] * ax + axes(o)[0][1] * az) + o.hz * Math.abs(axes(o)[1][0] * ax + axes(o)[1][1] * az);
      return [c - r, c + r];
    };
    const [a0, a1] = proj(p), [b0, b1] = proj(q);
    if (a1 + gap <= b0 || b1 + gap <= a0) return false;
  }
  return true;
}
export const inside = (b: Box, x: number, z: number, pad = 0) => {
  const dx = x - b.cx, dz = z - b.cz, c = Math.cos(b.a), s = Math.sin(b.a);
  return Math.abs(dx * c - dz * s) < b.hx + pad && Math.abs(dx * s + dz * c) < b.hz + pad;
};

