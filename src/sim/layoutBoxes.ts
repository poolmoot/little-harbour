import { BUILDING_IDS, FOOT, LAYOUT, PLOT_HALF, ringOf, toWorld } from './config';

/**
 * Ground footprints of everything solid in the harbour, the walkable ground, and the lanes that must stay clear. Pure data (no Three.js):
 * the layout tests walk it, and the view builds its walking collision from the very same lists, so what the tests check is what the
 * player bumps into. Positions are world units, x east, z towards the camera. Buildings stand on one circle round the square (see LAYOUT).
 */
export interface Box { name: string; cx: number; cz: number; hx: number; hz: number; a: number }
export interface Round { name: string; cx: number; cz: number; r: number }
export const L = LAYOUT;
type Pose = { x: number; z: number; rot?: number };
const box = (name: string, cx: number, cz: number, hx: number, hz: number, a = 0): Box => ({ name, cx, cz, hx, hz, a });
const round = (name: string, cx: number, cz: number, r: number): Round => ({ name, cx, cz, r });
/** A box given in a building's own frame (x across, z towards its door), turned with it. */
const local = (name: string, o: Pose, lx: number, lz: number, hx: number, hz: number): Box => {
  const p = toWorld(o, lx, lz);
  return box(name, p.x, p.z, hx, hz, o.rot ?? 0);
};
const at = (o: Pose, lx: number, lz: number) => toWorld(o, lx, lz);

/** Market stall reach (half width) by stall level; the biggest is used for the tests. */
export const STALL_REACH = [2.2, 3.2, 4.0];
export const TABLE_FRACTIONS = [0.5, 1, 0];

/** Tables on the restaurant terrace (a table with its two chairs), in world space. */
export const TABLES: Box[] = TABLE_FRACTIONS.map((f, i) => {
  const t = L.terrace;
  return local(`table ${i}`, L.plots.restaurant, t.x0 + (t.x1 - t.x0) * f, (t.z0 + t.z1) / 2, 0.5, 0.9);
});

/** The round walkable square, cut off by a straight wall on the camera side. A walker's centre may be anywhere inside it, less its own radius. */
export const WALK_DISC = { cx: L.ring.cx, cz: L.ring.cz, r: L.ring.front, zMax: L.ring.cz + L.ring.south };
/** Walkable rectangles: x0, x1, z0, z1. The pier, the causeway through the east gate and the lighthouse point. */
export const WALK_RECTS: [number, number, number, number][] = [
  [-L.pierHalfWidth, L.pierHalfWidth, L.pierEndZ, 1.2],
  [L.causeway.x0, L.causeway.x1, L.causeway.z0, L.causeway.z1],
  [L.point.x0, L.point.x1, L.point.z0, L.point.z1],
];

/** A point on a circle round the square's centre, `deg` degrees from straight up (east is positive). */
export const rimPoint = (deg: number, r: number): [number, number] => {
  const p = (deg * Math.PI) / 180;
  return [L.ring.cx + r * Math.sin(p), L.ring.cz - r * Math.cos(p)];
};
/** Lamp posts just outside the front ring, one in each gap between two buildings, and a row along the low wall on the camera side; and the lamps on the pier. */
const GAP_DEGS = [-1, 1].flatMap((s) => [0, 1, 2].map((k) => s * (L.ring.first + L.ring.step * (k + 0.5))));
const WALL_DEGS = [-1, 1].flatMap((sg) => [105, 115].map((d) => sg * d));
const WALL_Z = L.ring.cz + L.ring.south + 0.6;
export const STREET_LAMPS: [number, number][] = [
  ...GAP_DEGS.map((d) => rimPoint(d, L.ring.front + 0.7)), ...WALL_DEGS.map((d) => rimPoint(d, L.ring.front + 0.9)),
  ...[-14, -6, 6, 14].map((x) => [x, WALL_Z] as [number, number]),
];
export const PIER_LAMPS: [number, number, boolean][] = [[-1.85, -4, true], [1.85, -10.5, true], [-1.85, -16, true], [1.85, -4, false], [-1.85, -10.5, false], [1.85, -16, false]];
/** No benches or tubs stand in the square. */
export const BENCHES: [number, number][] = [];
export const PLANTERS: [number, number][] = [];
/** Lawns with a tree each outside the low wall on the camera side: [x0, x1, z0, z1]. The trunk stands in the middle. */
export const LAWNS: [number, number, number, number][] = [-17, -9, 9, 17].map((x) => [x - 3, x + 3, WALL_Z + 2.4 - 1.1, WALL_Z + 2.4 + 1.1] as [number, number, number, number]);

/** Where the three townspeople with something to say stand (each one is solid, so none stands in a lane). */
export const NPC_POSTS = {
  fishmonger: at(L.market, 0, -1.9),
  shipwright: at(L.shipyard, 3.3, FOOT.shipyard[1] + 1.4),
  innkeeper: at(L.inn, 2.0, FOOT.inn[1] + 1.4),
};

/** Everything with a corner: buildings, plots, tubs, tables. */
export const BOXES: Box[] = [
  local('icebox', L.iceBox, 0, 0, FOOT.iceBox[0], FOOT.iceBox[1]),
  local('market', L.market, 0, 0, STALL_REACH[2], FOOT.market[1]),
  local('shipyard', L.shipyard, 0, 0, FOOT.shipyard[0], FOOT.shipyard[1]),
  local('shipyard hull', L.shipyard, 0, -(FOOT.shipyard[1] + 2.6), 1.5, 0.8),
  local('inn', L.inn, 0, 0, FOOT.inn[0], FOOT.inn[1]),
  local('tower', L.bellTower, 0, 0, FOOT.bellTower[0], FOOT.bellTower[1]),
  local('board', L.noticeBoard, 0, 0, FOOT.noticeBoard[0], FOOT.noticeBoard[1]),
  ...BUILDING_IDS.filter((id) => id !== 'lighthouse').map((id) => local(id, L.plots[id], 0, 0, PLOT_HALF[id][0], PLOT_HALF[id][1])),
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
const QZ = L.queueZone;
export const QUEUE_BOX: Box = local('queue', L.market, (QZ.x0 + QZ.x1) / 2, (QZ.z0 + QZ.z1) / 2, (QZ.x1 - QZ.x0) / 2, (QZ.z1 - QZ.z0) / 2);

/** Every door and interaction point on foot, with its name. */
export const DOORS: [string, number, number][] = [
  ...BUILDING_IDS.map((id) => [id, L.plots[id].doorX, L.plots[id].doorZ] as [string, number, number]),
  ...Object.entries(L.stations).map(([k, v]) => [k, v.x, v.z] as [string, number, number]),
];

/** A clear lane is a turned box too. */
export type Lane = Box;
/** The ring walkway: this band of the square (radii from its centre) stays free of every solid, all round the horseshoe. */
export const RING_BAND = { r0: L.ring.freeInner, r1: L.ring.freeOuter };
/** The open middle of the square: nothing at all stands inside this radius. */
export const SQUARE_R = L.ring.freeInner;
/** The straight way from a spot out to the free ring band: `width` wide, running straight in towards the square's centre. The lighthouse's runs south along the causeway. */
export function approachLane(name: string, x: number, z: number, width = L.approachWidth): Lane {
  if (x > L.point.x0) return box(`approach to ${name}`, x, z + 2.5, width / 2, 2.5, 0);
  const { deg, r } = ringOf(x, z), len = Math.max(1, r - SQUARE_R + 1);
  const [cx, cz] = rimPoint(deg, r - len / 2 + 0.3);
  return box(`approach to ${name}`, cx, cz, width / 2, len / 2 + 0.3, -(deg * Math.PI) / 180);
}
export const APPROACHES: Lane[] = [
  ...DOORS.map(([n, x, z]) => approachLane(n, x, z)),
  box('approach to the pier head and fishing spot', 0, (L.fishingSpot.z + 8) / 2, 1.4, (8 - L.fishingSpot.z) / 2, 0),
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
