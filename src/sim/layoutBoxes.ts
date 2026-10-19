import { BUILDING_IDS, FOOT, LAYOUT, PLOT_HALF, toWorld } from './config';

/**
 * Ground footprints of everything solid in the harbour, the walkable ground, and the lanes that must stay clear. Pure data (no Three.js):
 * the layout tests walk it, and the view builds its walking collision from the very same lists, so what the tests check is what the
 * player bumps into. Positions are world units, x east, z towards the camera. The town is one small square with a row of buildings on its
 * sea side and one down each side (see LAYOUT).
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
const S = L.square;

/** Market stall reach (half width) by stall level; the biggest is used for the tests. */
export const STALL_REACH = [2.2, 3.2, 4.0];
export const TABLE_FRACTIONS = [0.5, 1, 0];

/** Tables on the restaurant terrace (a table with its two chairs), in world space. */
export const TABLES: Box[] = TABLE_FRACTIONS.map((f, i) => {
  const t = L.terrace;
  return local(`table ${i}`, L.plots.restaurant, t.x0 + (t.x1 - t.x0) * f, (t.z0 + t.z1) / 2, 0.5, 0.9);
});

/** Walkable rectangles: x0, x1, z0, z1. The square, the pier running out of its sea side, and the breakwater to the lighthouse from its top-right corner. */
export const WALK_RECTS: [number, number, number, number][] = [
  [S.x0, S.x1, S.z0, S.z1],
  [-L.pierHalfWidth, L.pierHalfWidth, L.pierEndZ, 1.2],
  [L.breakwater.x0, L.breakwater.x1, L.breakwater.z0, L.breakwater.z1],
];

/** The inner edges of the frontage on the three rows (where the walking lane starts) and the lane's far edges. */
export const FRONTAGE = { west: S.x0 + S.front, east: S.x1 - S.front, sea: S.z0 + S.front };
/** Lamp posts in the gaps between buildings on the two side rows, and a row along the low wall on the camera side; and the lamps on the pier. */
export const WALL_Z = S.z1 + 0.5;
export const STREET_LAMPS: [number, number][] = [
  [S.x0 - 0.25, 4.55], [S.x0 - 0.25, 10.75], [S.x1 + 0.25, 8.65],
  ...[-12, -9, -6, 6, 9, 12].map((x) => [x, WALL_Z] as [number, number]),
];
export const PIER_LAMPS: [number, number, boolean][] = [[-1.85, -4, true], [1.85, -10.5, true], [-1.85, -16, true], [1.85, -4, false], [-1.85, -10.5, false], [1.85, -16, false]];
/** No benches or tubs stand in the square. */
export const BENCHES: [number, number][] = [];
export const PLANTERS: [number, number][] = [];
/** Lawns with a tree each outside the low wall on the camera side: [x0, x1, z0, z1]. The trunk stands in the middle. */
export const LAWNS: [number, number, number, number][] = [-17.2, -10.4, 10.4, 17.2].map((x) => [x - 2.6, x + 2.6, WALL_Z + 1.5, WALL_Z + 3.7] as [number, number, number, number]);

/** Where the three townspeople with something to say stand (each one is solid, so none stands in a lane). */
export const NPC_POSTS = {
  fishmonger: at(L.market, 0, -1.9),
  shipwright: at(L.shipyard, -3.5, FOOT.shipyard[1] + 1.0),
  innkeeper: at(L.inn, 2.2, FOOT.inn[1] + 1.4),
};

/** Everything with a corner: buildings, plots, tubs, tables. */
export const BOXES: Box[] = [
  local('icebox', L.iceBox, 0, 0, FOOT.iceBox[0], FOOT.iceBox[1]),
  local('market', L.market, 0, 0, STALL_REACH[2], FOOT.market[1]),
  local('shipyard', L.shipyard, 0, 0, FOOT.shipyard[0], FOOT.shipyard[1]),
  local('shipyard hull', L.shipyard, FOOT.shipyard[0] + 2.2, 0, 1.5, 0.8),
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

/** A clear lane is a box too (never turned). */
export type Lane = Box;
/**
 * The walking lane along the inside of each of the three rows, `square.lane` wide, starting where the frontage ends. The west and east lanes
 * run down the sides, the sea lane along the top; together they make a U round the open middle, and every door's approach ends in one of them.
 */
export const LANES: Lane[] = [
  box('sea lane', 0, (FRONTAGE.sea + FRONTAGE.sea + S.lane) / 2, FRONTAGE.east, S.lane / 2),
  box('west lane', (FRONTAGE.west + FRONTAGE.west + S.lane) / 2, (FRONTAGE.sea + S.z1 - 0.5) / 2, S.lane / 2, (S.z1 - 0.5 - FRONTAGE.sea) / 2),
  box('east lane', (FRONTAGE.east + FRONTAGE.east - S.lane) / 2, (FRONTAGE.sea + S.z1 - 0.5) / 2, S.lane / 2, (S.z1 - 0.5 - FRONTAGE.sea) / 2),
];
/** The open middle of the square, between the two side lanes and below the sea lane: nothing at all stands in it. */
export const MIDDLE: Box = box('middle', 0, (FRONTAGE.sea + S.lane + S.z1) / 2, FRONTAGE.east - S.lane, (S.z1 - FRONTAGE.sea - S.lane) / 2);
/** The straight way from a door's spot out to the walking lane: `width` wide. The lighthouse's runs back along the breakwater to the square. */
export function approachLane(name: string, x: number, z: number, width = L.approachWidth): Lane {
  if (x > S.x1 && z < S.z0) return box(`approach to ${name}`, x, (z + S.z0) / 2, width / 2, (S.z0 - z) / 2);
  if (x < FRONTAGE.west) { const x0 = S.x0 + 0.1; return box(`approach to ${name}`, (x0 + FRONTAGE.west) / 2, z, (FRONTAGE.west - x0) / 2, width / 2); }
  if (x > FRONTAGE.east) { const x1 = S.x1 - 0.1; return box(`approach to ${name}`, (x1 + FRONTAGE.east) / 2, z, (x1 - FRONTAGE.east) / 2, width / 2); }
  const z0 = S.z0 + 0.2;
  return box(`approach to ${name}`, x, (z0 + FRONTAGE.sea) / 2, width / 2, (FRONTAGE.sea - z0) / 2);
}
export const APPROACHES: Lane[] = [
  ...DOORS.map(([n, x, z]) => approachLane(n, x, z)),
  box('path from the pier into the square', 0, (L.fishingSpot.z + FRONTAGE.sea + S.lane) / 2, 1.6, (FRONTAGE.sea + S.lane - L.fishingSpot.z) / 2, 0),
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
