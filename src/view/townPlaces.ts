import { FOOT, LAYOUT, toWorld } from '../sim/config';
import { TABLE_FRACTIONS } from '../sim/layoutBoxes';

/** Fixed spots the town's people use. Everything is in world units (x east, z towards the camera). */
export interface Spot { x: number; z: number }

/** Where people come out of town and go back into it: just in front of doors and at the edges of the square. They fade in and out here. */
export const GATES: Spot[] = [
  { x: LAYOUT.stations.shipyard.x, z: LAYOUT.stations.shipyard.z },
  { x: LAYOUT.stations.inn.x, z: LAYOUT.stations.inn.z },
  toWorld(LAYOUT.bellTower, 0.6, FOOT.bellTower[1] + 1.2),
  { x: LAYOUT.plots.smokehouse.doorX, z: LAYOUT.plots.smokehouse.doorZ },
  { x: LAYOUT.plots.coldstore.doorX, z: LAYOUT.plots.coldstore.doorZ },
];

export function randomGate(except = -1): { spot: Spot; index: number } {
  let i = Math.floor(Math.random() * GATES.length);
  if (i === except) i = (i + 1) % GATES.length;
  return { spot: GATES[i], index: i };
}

/** The gate nearest a point. */
export function nearestGate(x: number, z: number): Spot {
  let best = GATES[0], bd = Infinity;
  for (const g of GATES) { const d = (g.x - x) ** 2 + (g.z - z) ** 2; if (d < bd) { bd = d; best = g; } }
  return best;
}

/** Places in the market queue, front first. The line runs along the stall's front (a little unevenly), inside `LAYOUT.queueZone`, which is in the market's own frame. */
const QZ = LAYOUT.queueZone;
export const QUEUE_SLOTS: Spot[] = [0, 1, 2, 3, 4].map((i) => toWorld(LAYOUT.market, 
  Math.min(QZ.x1 - 0.3, Math.max(QZ.x0 + 0.3, 0.6 + i * 0.7)),
  QZ.z0 + (QZ.z1 - QZ.z0) * (i % 2 ? 0.7 : 0.1)));
/** A customer at the front of the queue faces the stall (the market's own -z, which is this heading in the world). */
export const FACE_STALL = LAYOUT.market.rot + Math.PI;

/** The tables on the restaurant terrace, in the restaurant's own frame, placed inside `LAYOUT.terrace` and filled in order as the restaurant grows. */
const TZ = LAYOUT.terrace;
export const TABLE_SPOTS: Spot[] = TABLE_FRACTIONS.map((f) => ({ x: TZ.x0 + (TZ.x1 - TZ.x0) * f, z: (TZ.z0 + TZ.z1) / 2 }));
/** Chair offsets from a table centre in the same frame: one each side, in front and behind. */
export const CHAIR_OFFSETS: Spot[] = [{ x: 0, z: -0.62 }, { x: 0, z: 0.62 }];

export interface SeatSpot extends Spot { heading: number; table: number }

/** World position and facing of the two chairs at a table. Seats face the table. */
export function seatsOf(table: number, out: SeatSpot[] = []): SeatSpot[] {
  const plot = LAYOUT.plots.restaurant, rot = plot.rot ?? 0, t = TABLE_SPOTS[table];
  for (let i = 0; i < 2; i++) {
    const p = toWorld(plot, t.x + CHAIR_OFFSETS[i].x, t.z + CHAIR_OFFSETS[i].z);
    // The chair at z-0.62 (towards the building) faces the camera side (+z in the restaurant frame); the other faces the building.
    const faceLz = i === 0 ? 1 : -1;
    const face = Math.atan2(faceLz * Math.sin(rot), faceLz * Math.cos(rot));
    out[i] = { x: p.x, z: p.z, heading: face, table };
  }
  return out;
}

/** Where a pier-head crowd stands: a loose group west of the pier mouth on the rim of the square, and a few on the pier itself. */
export const CROWD_SPOTS: Spot[] = [
  { x: -2.7, z: 0.9 }, { x: -3.3, z: 2.0 }, { x: -2.5, z: 3.0 }, { x: -3.7, z: 2.5 },
  { x: -1.75, z: LAYOUT.quayZ - 0.9 }, { x: 1.75, z: LAYOUT.quayZ - 0.9 }, { x: -1.75, z: LAYOUT.quayZ - 3.2 }, { x: 1.75, z: LAYOUT.quayZ - 2.4 },
];
