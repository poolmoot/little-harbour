import { BUILDING_IDS, LAYOUT, PLOT_HALF, toWorld } from './config';

/**
 * Ground footprints of everything solid on the quay, and the lanes that must stay clear. Pure data (no Three.js):
 * the layout tests walk it, and the view builds its walking collision from the very same lists, so what the
 * tests check is what the player bumps into. Positions are world units, x east, z towards the camera.
 */
export interface Box { name: string; cx: number; cz: number; hx: number; hz: number; a: number }
export interface Round { name: string; cx: number; cz: number; r: number }
export const L = LAYOUT;
const box = (name: string, cx: number, cz: number, hx: number, hz: number): Box => ({ name, cx, cz, hx, hz, a: 0 });
const round = (name: string, cx: number, cz: number, r: number): Round => ({ name, cx, cz, r });
const at = (o: { x: number; z: number }, lx: number, lz: number) => toWorld(o, lx, lz);

/** Market stall reach (half width) by stall level; the biggest is used for the tests. */
export const STALL_REACH = [2.2, 3.2, 4.0];
export const TABLE_FRACTIONS = [0.68, 0.92, 0.42];

/** Tables on the restaurant terrace (a table with its two chairs), in world space. */
export const TABLES: Box[] = TABLE_FRACTIONS.map((f, i) => {
  const t = L.terrace, p = at(L.plots.restaurant, t.x0 + (t.x1 - t.x0) * f, (t.z0 + t.z1) / 2);
  return box(`table ${i}`, p.x, p.z, 0.5, 0.9);
});

/** Street lamps along the camera side of the street, and the lamps on the pier. */
export const STREET_LAMPS: [number, number][] = [-49, -35, -21, -7, 7, 21, 35, 49].map((x) => [x, 15.8]);
export const PIER_LAMPS: [number, number, boolean][] = [[-1.85, -4, true], [1.85, -10.5, true], [-1.85, -16, true], [1.85, -4, false], [-1.85, -10.5, false], [1.85, -16, false]];
/** A few benches and flower tubs on the camera side of the street (they face the street). */
export const BENCHES: [number, number][] = [[-12, 17.4], [12, 17.4]];
export const PLANTERS: [number, number][] = [[-40, 17.8], [-22, 17.8], [22, 17.8], [40, 17.8]];
/** Lawns with a tree each on the camera side of the street: [x0, x1, z0, z1]. The trunk stands in the middle. */
export const LAWNS: [number, number, number, number][] = [-44, -28, 28, 44].map((c) => [c - 3, c + 3, 16.4, 18.6] as [number, number, number, number]);

/** Where the three townspeople with something to say stand (each one is solid, so none stands in a lane). */
export const NPC_POSTS = {
  fishmonger: { x: L.market.x, z: L.market.z - 1.9 },
  shipwright: { x: L.shipyard.x + 3.3, z: L.doorLineZ + 1.5 },
  innkeeper: { x: L.inn.x + 2.0, z: L.doorLineZ + 1.4 },
};

/** Everything with a corner: buildings, plots, benches, tubs, tables. */
export const BOXES: Box[] = [
  box('icebox', L.iceBox.x, L.iceBox.z, 0.9, 0.7),
  box('market', L.market.x, L.market.z, STALL_REACH[2], 1.2),
  box('shipyard', L.shipyard.x, L.shipyard.z, 3.1, 2.1),
  box('shipyard hull', L.shipyard.x - 6.9, 4.0, 1.5, 0.8),
  box('inn', L.inn.x, L.inn.z, 3.5, 2.6),
  box('tower', L.bellTower.x, L.bellTower.z, 1.65, 1.65),
  box('board', L.noticeBoard.x, L.noticeBoard.z, 1, 0.2),
  ...BUILDING_IDS.filter((id) => id !== 'lighthouse').map((id) => box(id, L.plots[id].x, L.plots[id].z, PLOT_HALF[id][0], PLOT_HALF[id][1])),
  ...Object.entries(NPC_POSTS).filter(([k]) => k !== 'fishmonger').map(([k, p]) => box(`npc ${k}`, p.x, p.z, 0.4, 0.4)),
  ...BENCHES.map(([x, z], i) => box(`bench ${i}`, x, z, 0.85, 0.3)),
  ...PLANTERS.map(([x, z], i) => box(`planter ${i}`, x, z, 0.8, 0.35)),
  ...TABLES,
];

/** Round things: lighthouse, lamp posts, tree trunks. */
export const ROUNDS: Round[] = [
  round('lighthouse', L.plots.lighthouse.x, L.plots.lighthouse.z, 1.7),
  ...STREET_LAMPS.map(([x, z], i) => round(`street lamp ${i}`, x, z, 0.2)),
  ...PIER_LAMPS.map(([x, z], i) => round(`pier lamp ${i}`, x, z, 0.2)),
  ...LAWNS.map(([x0, x1, z0, z1], i) => round(`tree ${i}`, (x0 + x1) / 2, (z0 + z1) / 2, 0.35)),
];

/** The market queue: people stand here, so nothing else may. Treated as solid by the tests. */
export const QUEUE_BOX: Box = box('queue', (L.queueZone.x0 + L.queueZone.x1) / 2, (L.queueZone.z0 + L.queueZone.z1) / 2, (L.queueZone.x1 - L.queueZone.x0) / 2, (L.queueZone.z1 - L.queueZone.z0) / 2);

/** Every door and interaction point on foot, with its name. */
export const DOORS: [string, number, number][] = [
  ...BUILDING_IDS.map((id) => [id, L.plots[id].doorX, L.plots[id].doorZ] as [string, number, number]),
  ...Object.entries(L.stations).map(([k, v]) => [k, v.x, v.z] as [string, number, number]),
];
/** A clear lane: x0, x1, z0, z1. */
export interface Lane { name: string; x0: number; x1: number; z0: number; z1: number }
export const STREET_LANE: Lane = { name: 'main street', x0: L.quayMinX + 0.5, x1: L.quayMaxX - 0.5, z0: L.street.z0, z1: L.street.z1 };
/** The straight way from the street to a point: `approachWidth` wide, ending at the point. */
export function approachLane(name: string, x: number, z: number, width = L.approachWidth): Lane {
  const h = width / 2;
  return { name: `approach to ${name}`, x0: x - h, x1: x + h, z0: Math.min(z, L.street.z0), z1: Math.max(z, L.street.z0) };
}
export const APPROACHES: Lane[] = [
  ...DOORS.map(([n, x, z]) => approachLane(n, x, z)),
  approachLane('the pier head and fishing spot', L.fishingSpot.x, L.fishingSpot.z, 2.8),
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
export const insideRound = (r: Round, x: number, z: number, pad = 0) => Math.hypot(x - r.cx, z - r.cz) < r.r + pad;
