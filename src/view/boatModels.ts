import * as THREE from 'three';
import { bake, bx, cy, flat, put, ropeCoil, tex, windowMat } from './kit';
import { boards } from './textures';
import { deckGeometry, gunwale, gunwaleY, halfWidthAt, hullGeometry, hullLid, stationZ } from './hull';
import type { HullPaint, HullShape } from './hull';

/** Everything that makes one boat size its own boat: hull lines, paint, and where things sit on board. */
export interface BoatTier {
  shape: HullShape;
  paint: HullPaint;
  /** Colour of the rail round the top edge, and of the inside of the hull. */
  rail: number;
  inside: number;
  /** Height of the open working deck where crates and the captain stand. */
  deckY: number;
  mastH: number;
  mastZ: number;
  /** Crate grid on deck: columns, rows, z of the first row, z step per row, x spacing. */
  crates: readonly [cols: number, rows: number, z0: number, dz: number, dx: number];
  captainZ: number;
}

const WHITE = 0xf4f1e8, CREAM = 0xf2e6c4, NAVY = 0x2a4a7a, RED = 0xd6453a, IRON = 0x2d3236, BRASS = 0xe0b040;

/** Rowboat, sloop, cutter, trawler. */
export const BOAT_TIERS: readonly BoatTier[] = [
  { // a varnished wooden dinghy
    shape: { len: 4, hw: 0.8, H: 0.72, sheerBow: 0.3, sheerStern: 0.18, bowFrac: 0.4, bowPow: 0.7, sternTaper: 0.26, keelBow: 0.28, keelStern: 0.1, draft: 0.36 },
    paint: { bottom: 0x7a4a2e, stripe: CREAM, side: 0xcf8f4f, sheer: CREAM },
    rail: 0x8a5a34, inside: 0xb98a55, deckY: 0.2, mastH: 2.8, mastZ: -0.5, crates: [2, 4, 1.0, -0.5, 0.56], captainZ: 1.45,
  },
  { // a slim white sailing boat with a blue top plank
    shape: { len: 4.8, hw: 0.95, H: 0.84, sheerBow: 0.3, sheerStern: 0.08, bowFrac: 0.5, bowPow: 0.85, sternTaper: 0.4, keelBow: 0.34, keelStern: 0.14, draft: 0.4 },
    paint: { bottom: NAVY, stripe: RED, side: WHITE, sheer: 0x2f6fb8 },
    rail: 0xb9824a, inside: 0xd9c9a4, deckY: 0.32, mastH: 4.0, mastZ: -0.6, crates: [2, 4, 1.2, -0.45, 0.6], captainZ: 1.75,
  },
  { // a sturdy green cutter with a cabin
    shape: { len: 6, hw: 1.15, H: 0.98, sheerBow: 0.36, sheerStern: 0.14, bowFrac: 0.45, bowPow: 0.8, sternTaper: 0.3, keelBow: 0.36, keelStern: 0.14, draft: 0.46 },
    paint: { bottom: 0x8a2f2a, stripe: CREAM, side: 0x3f8a5f, sheer: CREAM },
    rail: 0x8a5a34, inside: 0xd9c9a4, deckY: 0.4, mastH: 4.6, mastZ: -0.8, crates: [3, 4, 1.6, -0.5, 0.55], captainZ: 2.25,
  },
  { // a big red steel trawler with a high bow and a wheelhouse
    shape: { len: 7, hw: 1.4, H: 1.12, sheerBow: 0.62, sheerStern: 0.1, bowFrac: 0.34, bowPow: 0.62, sternTaper: 0.16, keelBow: 0.4, keelStern: 0.12, draft: 0.55 },
    paint: { bottom: IRON, stripe: WHITE, side: 0xcf4436, sheer: WHITE },
    rail: IRON, inside: 0xa9b4bd, deckY: 0.5, mastH: 3.9, mastZ: 0.3, crates: [3, 4, -0.4, -0.5, 0.6], captainZ: 3.0,
  },
];

// One material draws every painted hull: the colours live in the geometry.
const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
// Writes depth but no colour: drawn after the boat and before the sea, it stops the water surface showing inside the hull.
const lidMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const insideMat = (c: number) => { const m = flat(c, 0.9).clone(); m.side = THREE.BackSide; return m; };
const deckMat = () => tex('boatdeck', boards('boatdeck', [206, 170, 118], 6, true), 0.9);
const darkWood = () => flat(0x6a4a30, 0.8);

/** Marks a mesh so `bake` leaves it alone (animated parts, and meshes that carry vertex colours). */
const keep = <T extends THREE.Object3D>(o: T): T => { o.traverse((m) => { m.userData.keep = true; }); return o; };

function ring(R: number, r: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
  return put(new THREE.TorusGeometry(R, r, 6, 14), m, x, y, z, parent);
}

/** A cross plank from side to side at station u, resting at height y. */
function thwart(s: HullShape, u: number, y: number, depth: number, m: THREE.Material, parent: THREE.Object3D): void {
  bx(halfWidthAt(s, u, y) * 2 - 0.04, 0.06, depth, m, 0, y, stationZ(s, u), parent);
}

/** A wall across the hull at station u from the working deck up to height y (closes off a raised deck). */
function bulkhead(s: HullShape, u: number, y0: number, y1: number, m: THREE.Material, parent: THREE.Object3D): void {
  bx(halfWidthAt(s, u, (y0 + y1) / 2) * 2 - 0.06, y1 - y0, 0.06, m, 0, (y0 + y1) / 2, stationZ(s, u), parent);
}

/** Rudder blade on the transom with a tiller reaching forward over the stern. */
function rudder(s: HullShape, parent: THREE.Object3D): void {
  const z = stationZ(s, 1), top = gunwaleY(s, 1);
  bx(0.06, top * 0.9, 0.34, darkWood(), 0, top * 0.5, z + 0.17, parent);
  const tiller = cy(0.03, 0.04, 1.0, darkWood(), 0, top + 0.12, z - 0.4, parent, 6);
  tiller.rotation.x = Math.PI / 2 - 0.12;
}

function bowsprit(s: HullShape, length: number, parent: THREE.Object3D): void {
  const spar = cy(0.04, 0.06, length, darkWood(), 0, gunwaleY(s, 0) + 0.04, stationZ(s, 0) - length * 0.3, parent, 6);
  spar.rotation.x = Math.PI / 2 + 0.1;
}

/** Hull, inside lining, rails, sea-blocking lid and the open working deck: the parts every boat shares. */
function shell(t: BoatTier, deckFrom: number, root: THREE.Group): void {
  const s = t.shape;
  const hull = hullGeometry(s, t.paint);
  keep(put(hull, paintMat, 0, 0, 0, root));
  keep(put(hull, insideMat(t.inside), 0, 0, 0, root)).castShadow = false;
  for (const side of [-1, 1]) put(gunwale(s, side), flat(t.rail, 0.7), 0, 0, 0, root);
  const lid = keep(new THREE.Mesh(hullLid(s), lidMat));
  lid.renderOrder = 1;
  root.add(lid);
  put(deckGeometry(s, deckFrom, 0.985, t.deckY), deckMat(), 0, 0, 0, root).castShadow = false;
}

/** A raised deck from the bow back to station u1, with a wall where it drops to the working deck. */
function foredeck(t: BoatTier, u1: number, y: number, root: THREE.Group): void {
  put(deckGeometry(t.shape, 0.03, u1, y), deckMat(), 0, 0, 0, root);
  bulkhead(t.shape, u1, t.deckY, y, flat(t.inside, 0.9), root);
}

export interface BoatBuild {
  group: THREE.Group;
  /** Rowboat only: the two oars (rotated to row) and the group holding oars and rowlocks. */
  oars: THREE.Group[];
  oarRig: THREE.Group | null;
}

function rowboat(t: BoatTier, b: BoatBuild): void {
  const s = t.shape, g = b.group, wood = flat(0xb98a55, 0.85);
  shell(t, 0.1, g);
  thwart(s, 0.25, 0.46, 0.3, wood, g);
  thwart(s, 0.94, 0.46, 0.3, wood, g);
  cy(0.045, 0.055, 0.5, darkWood(), 0, gunwaleY(s, 0.02) + 0.1, stationZ(s, 0.02), g, 6);   // bow post
  ring(0.07, 0.018, flat(IRON, 0.5), 0, gunwaleY(s, 0.03) + 0.02, stationZ(s, 0.05), g);    // mooring ring
  ropeCoil(g, 0, t.deckY, stationZ(s, 0.17), 0.7);
  const rig = keep(new THREE.Group());
  for (const side of [-1, 1]) {
    const u = 0.27;
    const lock = new THREE.Group();
    lock.position.set(side * halfWidthAt(s, u), gunwaleY(s, u) + 0.04, stationZ(s, u));
    cy(0.025, 0.03, 0.14, flat(IRON, 0.5), 0, 0, 0, lock, 5);
    const oar = new THREE.Group();
    cy(0.028, 0.028, 2.4, flat(0xc89c62, 0.7), side * 0.45, 0, 0, oar, 6).rotation.z = Math.PI / 2;
    bx(0.7, 0.012, 0.16, flat(0xe8d6b0, 0.7), side * 1.55, 0, 0, oar);
    lock.add(oar);
    rig.add(lock);
    b.oars.push(oar);
  }
  keep(rig);
  g.add(rig);
  b.oarRig = rig;
}

function sloop(t: BoatTier, b: BoatBuild): void {
  const s = t.shape, g = b.group, deck = s.H - 0.06;
  shell(t, 0.4, g);
  foredeck(t, 0.4, deck, g);
  bx(0.5, 0.1, 0.5, flat(WHITE, 0.7), 0, deck + 0.05, stationZ(s, 0.24), g);              // fore hatch
  bx(0.42, 0.03, 0.42, flat(0x2f6fb8, 0.6), 0, deck + 0.11, stationZ(s, 0.24), g);
  for (const side of [-1, 1]) bx(0.05, 0.05, 0.2, flat(BRASS, 0.4), side * 0.3, deck + 0.03, stationZ(s, 0.12), g); // cleats
  thwart(s, 0.95, t.deckY + 0.3, 0.34, flat(0xb9824a, 0.8), g);                              // helm seat
  cy(0.11, 0.13, 0.12, darkWood(), 0, deck + 0.06, t.mastZ, g, 10);                        // mast collar
  bowsprit(s, 1.3, g);
  rudder(s, g);
}

function cutter(t: BoatTier, b: BoatBuild): void {
  const s = t.shape, g = b.group, deck = s.H - 0.06;
  const cabinZ = stationZ(s, 0.27), cabinW = 1.3, cabinL = 1.5, cabinH = 0.5;
  shell(t, 0.44, g);
  foredeck(t, 0.44, deck, g);
  bx(cabinW, cabinH, cabinL, flat(CREAM, 0.8), 0, deck + cabinH / 2, cabinZ, g);
  bx(cabinW + 0.14, 0.07, cabinL + 0.14, flat(0x8a5a34, 0.6), 0, deck + cabinH + 0.035, cabinZ, g);
  for (const side of [-1, 1]) {
    for (const dz of [-0.36, 0.36]) {
      const port = cy(0.11, 0.11, 0.03, windowMat, side * (cabinW / 2 + 0.005), deck + 0.3, cabinZ + dz, g, 12);
      port.rotation.z = Math.PI / 2;
      ring(0.115, 0.022, flat(BRASS, 0.4), side * (cabinW / 2 + 0.02), deck + 0.3, cabinZ + dz, g).rotation.y = Math.PI / 2;
    }
    cy(0.018, 0.018, cabinL * 0.8, flat(BRASS, 0.4), side * 0.42, deck + cabinH + 0.14, cabinZ, g, 5).rotation.x = Math.PI / 2; // handrail
    bx(0.05, 0.05, 0.22, flat(BRASS, 0.4), side * 0.4, deck + 0.03, stationZ(s, 0.08), g);
  }
  ring(0.2, 0.06, flat(0xf08a2a, 0.6), 0, deck + 0.28, cabinZ + cabinL / 2 + 0.04, g);     // lifebuoy on the cabin's aft wall
  thwart(s, 0.95, t.deckY + 0.32, 0.36, flat(0xb9824a, 0.8), g);
  cy(0.12, 0.14, 0.12, darkWood(), 0, t.deckY + 0.06, t.mastZ, g, 10);
  bowsprit(s, 1.9, g);
  rudder(s, g);
}

function trawler(t: BoatTier, b: BoatBuild): void {
  const s = t.shape, g = b.group, fore = s.H + 0.12, d = t.deckY;
  const iron = flat(IRON, 0.5), white = flat(0xeee6d2, 0.8), houseZ = 1.75;
  shell(t, 0.2, g);
  foredeck(t, 0.2, fore, g);
  // winch on the foredeck
  cy(0.26, 0.26, 0.5, iron, 0, fore + 0.34, stationZ(s, 0.13), g, 10).rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) bx(0.1, 0.6, 0.12, flat(0xe0902a, 0.6), side * 0.33, fore + 0.3, stationZ(s, 0.13), g);
  // wheelhouse with a blue roof, windows all round, a funnel and a radar
  bx(1.9, 1.35, 2.0, white, 0, d + 0.675, houseZ, g);
  bx(2.1, 0.1, 2.25, flat(0x2f5f9a, 0.7), 0, d + 1.4, houseZ, g);
  bx(1.7, 0.45, 0.06, windowMat, 0, d + 0.95, houseZ - 1.0, g);
  for (const side of [-1, 1]) {
    bx(0.06, 0.45, 1.3, windowMat, side * 0.95, d + 0.95, houseZ - 0.15, g);
    ring(0.2, 0.06, flat(0xf08a2a, 0.6), side * 0.99, d + 0.42, houseZ + 0.6, g).rotation.y = Math.PI / 2; // lifebuoys
  }
  cy(0.17, 0.21, 0.7, flat(0xe0702a, 0.7), 0.45, d + 1.8, houseZ + 0.55, g, 10);
  cy(0.18, 0.18, 0.12, iron, 0.45, d + 2.18, houseZ + 0.55, g, 10);
  cy(0.03, 0.03, 0.35, iron, -0.5, d + 1.62, houseZ - 0.4, g, 5);
  bx(0.5, 0.06, 0.1, white, -0.5, d + 1.82, houseZ - 0.4, g);
  // stern gantry for hauling nets
  const gz = stationZ(s, 0.97);
  for (const side of [-1, 1]) bx(0.09, 1.9, 0.09, iron, side * 0.95, d + 0.95, gz, g).rotation.z = -side * 0.12;
  bx(1.8, 0.09, 0.09, iron, 0, d + 1.88, gz, g);
  // old tyres as fenders along both sides
  for (const side of [-1, 1]) for (const u of [0.42, 0.6, 0.78]) {
    ring(0.2, 0.085, flat(0x1d2024, 0.9), side * (halfWidthAt(s, u) + 0.07), gunwaleY(s, u) - 0.3, stationZ(s, u), g).rotation.y = Math.PI / 2;
  }
}

const BUILDERS = [rowboat, sloop, cutter, trawler];

/** Build the static model for a boat size. Fixed parts are merged so each boat costs only a handful of draw calls. */
export function buildBoat(tier: number): BoatBuild {
  const b: BoatBuild = { group: new THREE.Group(), oars: [], oarRig: null };
  BUILDERS[tier](BOAT_TIERS[tier], b);
  bake(b.group);
  return b;
}
