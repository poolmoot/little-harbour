import * as THREE from 'three';
import { BUILDINGS, FOOT, INTERACT_RANGE, LAYOUT, toWorld } from '../sim/config';
import type { BuildingId } from '../sim/config';
import { canBuyBuilding, readySmoked } from '../sim/buildings';
import { rankOf } from '../sim/rank';
import type { GameState } from '../sim/state';
import { canBuy } from '../sim/upgrades';
import { MARK_TEXT } from '../ui/screenText';
import { bake, bx, cy, flat, lampMat, put, signMesh, toon } from './kit';
import { drawIcon } from './markIcons';
import type { MarkIcon } from './markIcons';

/**
 * What tells the player which buildings can be used: a hanging signboard with an icon over every door (lit at night),
 * a doormat and a small lantern by it, a soft glow on the ground and a floating name plate when the player is near,
 * and small bubbles over a building when something is ready, can be bought, or has just opened up.
 * Positions come from LAYOUT; the bubbles are worked out from the game state (no rules live here).
 */

type MarkId = 'market' | 'board' | 'shipyard' | 'inn' | BuildingId;

interface Def {
  id: MarkId;
  icon: MarkIcon;
  /** The signboard: where it hangs, how big (1 = 1.9 wide), whether it hangs from a wall bracket or sits on little posts. */
  sx: number; sy: number; sz: number; scale: number; mount: 'wall' | 'rail' | 'posts';
  /** Where the player stands to use it; the mat lies here and the glow and name plate are centred on it. */
  stationX: number; stationZ: number;
  bubbleY: number;
  /** The building's pose (turned to face the centre of the square), the door's sideways spot and the front wall's depth, in the building's own frame. */
  pose: { x: number; z: number; rot: number }; doorLx: number; frontLz: number;
  /** Where the bubble floats, in world x and z. */
  bx: number; bz: number;
  /** Doormat and lantern: the lantern's sideways offset, and (for posts) where the signboard's posts start from the ground. */
  lx?: number; postFrom?: number;
  /** A building that can be bought: the sign says "for sale" until it is built. */
  plot?: BuildingId;
  /** Depth of an empty lot, for hanging the "for sale" sign on its post. */
  lotDepth?: number;
}

const L = LAYOUT;
const P = L.plots;
/** How much further from the wall a camera-facing board hangs on a side row. */
const SIDE_OUT = 0.85;
type Pose = { x: number; z: number; rot: number };
/** One building's marks, worked out from its pose: the sign hangs `signLz` in front of its middle (plus `signLx` across), the door is at `doorLx`. */
function mk(id: MarkId, icon: MarkIcon, pose: Pose, hz: number, o: { signLx?: number; signLz: number; sy: number; scale: number; mount: Def['mount']; doorLx: number; station: { x: number; z: number }; bubbleY: number; lx?: number; postFrom?: number; plot?: BuildingId; lotDepth?: number }): Def {
  // Boards always face the camera, so on the two side rows (turned 90 degrees) one hangs further out from the wall to stay clear of it.
  const lz = o.signLz + (pose.rot !== 0 && o.mount === 'wall' ? SIDE_OUT : 0);
  const sg = toWorld(pose, o.signLx ?? 0, lz), bb = toWorld(pose, o.signLx ?? 0, o.plot ? 1.5 : lz);
  return { id, icon, sx: sg.x, sy: o.sy, sz: sg.z, scale: o.scale, mount: o.mount, stationX: o.station.x, stationZ: o.station.z, bubbleY: o.bubbleY, pose, doorLx: o.doorLx, frontLz: hz, bx: bb.x, bz: bb.z, lx: o.lx, postFrom: o.postFrom, plot: o.plot, lotDepth: o.lotDepth };
}
const DEFS: Def[] = [
  mk('market', 'fish', L.market, FOOT.market[1], { signLz: 1.55, sy: 2.0, scale: 0.85, mount: 'rail', doorLx: -1.5, station: L.stations.market, bubbleY: 3.7, lx: -0.55 }),
  mk('board', 'paper', L.noticeBoard, FOOT.noticeBoard[1], { signLz: 0.3, sy: 3.05, scale: 0.8, mount: 'posts', doorLx: 0, station: L.stations.board, bubbleY: 4.2, lx: -1.0, postFrom: 2.55 }),
  mk('shipyard', 'anchor', L.shipyard, FOOT.shipyard[1], { signLx: -1.1, signLz: FOOT.shipyard[1] + 0.5, sy: 3.4, scale: 1, mount: 'wall', doorLx: -1.1, station: L.stations.shipyard, bubbleY: 5.4, lx: 1.4 }),
  mk('inn', 'mug', L.inn, FOOT.inn[1], { signLx: -1.8, signLz: FOOT.inn[1] + 0.5, sy: 3.05, scale: 1, mount: 'wall', doorLx: -1.8, station: L.stations.inn, bubbleY: 5.6, lx: 1.2 }),
  mk('smokehouse', 'smoke', P.smokehouse, FOOT.smokehouse[1], { signLx: 1.2, signLz: FOOT.smokehouse[1] + 0.5, sy: 3.0, scale: 0.95, mount: 'wall', doorLx: 1.2, station: { x: P.smokehouse.doorX, z: P.smokehouse.doorZ }, bubbleY: 5.0, plot: 'smokehouse', lotDepth: 3.6 }),
  mk('restaurant', 'plate', P.restaurant, FOOT.restaurant[1], { signLx: -1.5, signLz: FOOT.restaurant[1] + 0.35, sy: 3.45, scale: 0.95, mount: 'wall', doorLx: -1.5, station: { x: P.restaurant.doorX, z: P.restaurant.doorZ }, bubbleY: 5.4, plot: 'restaurant', lotDepth: 3.6 }),
  mk('lighthouse', 'light', P.lighthouse, FOOT.lighthouse[1], { signLz: 1.7, sy: 2.7, scale: 0.8, mount: 'wall', doorLx: 0, station: { x: P.lighthouse.doorX, z: P.lighthouse.doorZ }, bubbleY: 4.4, plot: 'lighthouse', lotDepth: 2.6 }),
];

// ---- pieces -------------------------------------------------------------------------------------------------

const BOARD_W = 1.9, BOARD_H = 0.88;
const DARK = 0x3a2a1c;

function boardTexture(icon: MarkIcon, name: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 178;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b4a2f';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = i % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.08)';
    g.lineWidth = 2;
    const y = 8 + i * 12.5;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(120, y + 4, 260, y - 4, c.width, y); g.stroke();
  }
  g.strokeStyle = '#f0dcae'; g.lineWidth = 7;
  g.strokeRect(9, 9, c.width - 18, c.height - 18);
  g.fillStyle = 'rgba(20,12,6,.35)';
  g.beginPath(); g.roundRect(22, 22, 118, 134, 14); g.fill();
  drawIcon(g, icon, 28, 32, 106);
  // the name, one or two lines, to the right of the icon
  const words = name.toUpperCase().split(' ');
  const lines = words.length > 1 && name.length > 9 ? [words[0], words.slice(1).join(' ')] : [words.join(' ')];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = lines.length === 1 ? 38 : 40;
  g.font = `bold ${size}px "Lilita One", "Trebuchet MS", sans-serif`;
  lines.forEach((ln, i) => {
    const y = c.height / 2 + (i - (lines.length - 1) / 2) * 46;
    const x = 262;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(ln, x + 2, y + 3, 200);
    g.fillStyle = '#f6ecd2'; g.fillText(ln, x, y, 200);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A small wall lantern: a bracket, a glass lamp that lights at night, and a cap. */
function lantern(g: THREE.Object3D, x: number, y: number, z: number, iron: THREE.Material): void {
  bx(0.04, 0.04, 0.3, iron, x, y + 0.12, z - 0.15, g);
  put(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8), lampMat, x, y, z, g).castShadow = false;
  put(new THREE.ConeGeometry(0.15, 0.13, 8), iron, x, y + 0.17, z, g);
}

/** A doormat and (optionally) a lantern at a door, in the frame of `g`. x is across, z is where the front wall is. */
export function addDoorFurniture(g: THREE.Object3D, x: number, wallZ: number, lanternDx: number | null, iron: THREE.Material): void {
  bx(1.8, 0.03, 1.0, flat(0x3a2a1c, 0.95), x, 0.03, wallZ + 0.7, g).castShadow = false;
  bx(1.62, 0.035, 0.84, flat(0x9a4a3a, 0.95), x, 0.045, wallZ + 0.7, g).castShadow = false;
  bx(1.1, 0.04, 0.4, flat(0xd6a65a, 0.95), x, 0.05, wallZ + 0.7, g).castShadow = false;
  if (lanternDx !== null) lantern(g, x + lanternDx, 2.0, wallZ + 0.12, iron);
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,236,160,.9)'); grad.addColorStop(0.55, 'rgba(255,214,110,.35)'); grad.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

type BubbleKind = 'ready' | 'up' | 'new';
const BUBBLE_COLOUR: Record<BubbleKind, [string, string]> = { ready: ['#7fe08a', '#2f9f4a'], up: ['#ffd84a', '#e0a010'], new: ['#7fc4ff', '#2f78d6'] };

function bubbleTexture(kind: BubbleKind): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 128;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#0b1a44';
  g.beginPath(); g.roundRect(10, 8, 172, 84, 26); g.moveTo(84, 90); g.lineTo(96, 120); g.lineTo(110, 90); g.stroke();
  const grad = g.createLinearGradient(0, 8, 0, 92);
  grad.addColorStop(0, BUBBLE_COLOUR[kind][0]); grad.addColorStop(1, BUBBLE_COLOUR[kind][1]);
  g.fillStyle = grad; g.fill();
  g.fillStyle = '#fff'; g.strokeStyle = '#0b1a44'; g.lineWidth = 7;
  if (kind === 'up') {
    g.beginPath(); g.moveTo(96, 18); g.lineTo(128, 52); g.lineTo(108, 52); g.lineTo(108, 80); g.lineTo(84, 80); g.lineTo(84, 52); g.lineTo(64, 52); g.closePath(); g.stroke(); g.fill();
  } else {
    g.font = '900 54px "Lilita One", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText(MARK_TEXT.bubble[kind], 96, 52); g.fillText(MARK_TEXT.bubble[kind], 96, 52);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function platePill(text: string, tex: THREE.CanvasTexture): void {
  const c = tex.image as HTMLCanvasElement, g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.font = 'bold 54px "Lilita One", "Trebuchet MS", sans-serif';
  const w = Math.min(c.width - 16, g.measureText(text).width + 70);
  g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = '#0b1a44'; g.fillStyle = '#fff3d6';
  g.beginPath(); g.roundRect((c.width - w) / 2, 14, w, 78, 30); g.stroke(); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a1a10';
  g.fillText(text, c.width / 2, 54, w - 40);
  tex.needsUpdate = true;
}

// ---- the thing that owns it all ---------------------------------------------------------------------------------

const VISITED_KEY = 'little-harbour-visited';

interface Sign { def: Def; group: THREE.Group; mat: THREE.MeshStandardMaterial; forSale: boolean; phase: number }
interface Mark { def: Def; signs: Sign[]; bubble: THREE.Sprite; bubbleKind: BubbleKind | null; bubbleScale: number }

export class BuildingMarks {
  private marks: Mark[] = [];
  private glow: THREE.Mesh;
  private plate: THREE.Sprite;
  private plateTex: THREE.CanvasTexture;
  private plateFor: string | null = null;
  private plateScale = 0;
  private near: Mark | null = null;
  private visited = new Set<string>();
  private bubbleTex: Record<BubbleKind, THREE.CanvasTexture>;

  constructor(parent: THREE.Object3D) {
    try { for (const k of JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]')) this.visited.add(String(k)); } catch { /* no saved list */ }
    const iron = flat(0x2d3236, 0.5), wood = flat(DARK, 0.9);
    const stat = new THREE.Group();
    parent.add(stat);
    const live = new THREE.Group();
    parent.add(live);
    this.bubbleTex = { ready: bubbleTexture('ready'), up: bubbleTexture('up'), new: bubbleTexture('new') };

    for (const def of DEFS) {
      const signs: Sign[] = [];
      const variants: { forSale: boolean; label: string; icon: MarkIcon }[] = def.plot
        ? [{ forSale: true, label: `${MARK_TEXT.names[def.id]} ${MARK_TEXT.forSale.toLowerCase()}`, icon: 'forsale' }, { forSale: false, label: MARK_TEXT.names[def.id], icon: def.icon }]
        : [{ forSale: false, label: MARK_TEXT.names[def.id], icon: def.icon }];
      for (const v of variants) {
        const lot = v.forSale ? toWorld(def.pose, 0, def.lotDepth! / 2 + 0.12) : null;
        const sx = lot ? lot.x : def.sx;
        const sy = v.forSale ? 1.75 : def.sy;
        const sz = lot ? lot.z : def.sz;
        const k = v.forSale ? 0.85 : def.scale;
        const g = new THREE.Group();
        g.position.set(sx, sy, sz);
        g.rotation.y = 0;   // boards always face the camera, even on the side rows
        const mesh = signMesh('', BOARD_W * k, BOARD_H * k);
        const mat = toon(new THREE.MeshStandardMaterial({ map: boardTexture(v.icon, v.label), emissiveMap: null, emissive: 0xffb860, roughness: 0.9 }));
        mat.emissiveMap = mat.map;
        mat.emissiveIntensity = 0;
        mesh.material = mat;
        // hang the board from its rail by two short chains; the rail's top end sits at the board's top edge + 0.25
        const top = (BOARD_H * k) / 2;
        g.add(mesh);
        live.add(g);
        const own = new THREE.Group();   // static bracket parts, baked with the rest of the signs' fittings
        own.position.set(sx, sy, sz);
        stat.add(own);
        bx(BOARD_W * k + 0.2, 0.06, 0.06, iron, 0, top + 0.28, 0, own);
        // the two short chains hang from the rail (baked with it: the board's sway is far too small to show at their length)
        for (const dx of [-1, 1]) bx(0.025, 0.28, 0.025, iron, dx * BOARD_W * k * 0.36, top + 0.14, 0, own).castShadow = false;
        if (!v.forSale && def.mount === 'wall') {
          if (def.pose.rot === 0) for (const dx of [-1, 1]) bx(0.05, 0.05, 0.5, iron, dx * BOARD_W * k * 0.46, top + 0.28, -0.25, own);
          else {
            // a side row: one arm from the wall straight out to the board's middle (the wall is `frontLz` from the building's middle)
            const wall = toWorld(def.pose, 0, def.frontLz), len = Math.abs(sx - wall.x);
            bx(len, 0.06, 0.06, iron, (wall.x - sx) / 2, top + 0.28, 0, own);
          }
        }
        if (!v.forSale && def.mount === 'posts') {
          const from = def.postFrom ?? 0, hi = sy + top + 0.28;
          for (const dx of [-1, 1]) cy(0.04, 0.05, hi - from, wood, dx * (BOARD_W * k * 0.5 + 0.12), (from + hi) / 2 - sy, 0, own, 6);
        }
        signs.push({ def, group: g, mat, forSale: v.forSale, phase: Math.random() * 6 });
      }
      // doormat and lantern at the door (a plot gets its own when the building goes up, see tycoonView.ts)
      if (!def.plot) {
        const mat = new THREE.Group();
        mat.position.set(def.pose.x, 0, def.pose.z);
        mat.rotation.y = def.pose.rot;
        stat.add(mat);
        addDoorFurniture(mat, def.doorLx, def.frontLz, def.lx ?? 1.2, iron);
      }
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex.new, transparent: true, depthWrite: false, fog: false }));
      bubble.position.set(def.bx, def.bubbleY, def.bz);
      bubble.visible = false;
      bubble.center.set(0.5, 0);
      live.add(bubble);
      this.marks.push({ def, signs, bubble, bubbleKind: null, bubbleScale: 0 });
    }
    bake(stat);

    // the soft glow on the ground and the floating name plate: one of each, moved to whichever building the player is at
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    this.glow.renderOrder = 2;
    this.glow.visible = false;
    live.add(this.glow);
    const pc = document.createElement('canvas');
    pc.width = 512; pc.height = 112;
    this.plateTex = new THREE.CanvasTexture(pc);
    this.plateTex.colorSpace = THREE.SRGBColorSpace;
    this.plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.plateTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.plate.scale.set(3.6, 0.79, 1);
    this.plate.renderOrder = 10;
    this.plate.visible = false;
    live.add(this.plate);
  }

  /** What bubble (if any) a building should show, worked out from the state. */
  private bubbleFor(m: Mark, s: GameState): BubbleKind | null {
    const id = m.def.id;
    if (id === 'smokehouse' && s.buildings.smokehouse > 0 && readySmoked(s).length > 0) return 'ready';
    if (m.def.plot) {
      const lvl = s.buildings[m.def.plot];
      if (lvl === 0) return rankOf(s) >= BUILDINGS[m.def.plot].rank && !this.visited.has(id) ? 'new' : null;
      return canBuyBuilding(s, m.def.plot).ok ? 'up' : null;
    }
    if (id === 'market') return canBuy(s, s.upgrades.stall1 ? 'stall2' : 'stall1').ok ? 'up' : null;
    return null;
  }

  /** Once a frame. `lantern` is 0 by day and 1 at night. */
  sync(s: GameState, now: number, dt: number, player: { x: number; z: number }, lantern: number): void {
    let near: Mark | null = null, nd = INTERACT_RANGE + 0.5;
    for (const m of this.marks) {
      const d = Math.hypot(m.def.stationX - player.x, m.def.stationZ - player.z);
      if (d < nd) { nd = d; near = m; }
      if (m.def.plot && d < INTERACT_RANGE && !this.visited.has(m.def.id)) {
        this.visited.add(m.def.id);
        try { localStorage.setItem(VISITED_KEY, JSON.stringify([...this.visited])); } catch { /* private window */ }
      }
    }
    this.near = near;
    const k = Math.min(1, dt * 8);
    for (const m of this.marks) {
      const built = m.def.plot ? s.buildings[m.def.plot] > 0 : true;
      for (const sg of m.signs) {
        sg.group.visible = sg.forSale ? !built : built;
        if (!sg.group.visible) continue;
        const glowing = m === near ? 0.5 + Math.sin(now * 4) * 0.2 : 0;
        sg.mat.emissiveIntensity = lantern * 0.9 + glowing;
        sg.group.rotation.z = Math.sin(now * 1.1 + sg.phase) * 0.035;
      }
      const kind = this.bubbleFor(m, s);
      if (kind && kind !== m.bubbleKind) { m.bubbleKind = kind; (m.bubble.material as THREE.SpriteMaterial).map = this.bubbleTex[kind]; (m.bubble.material as THREE.SpriteMaterial).needsUpdate = true; }
      m.bubbleScale += ((kind ? 1 : 0) - m.bubbleScale) * k;
      m.bubble.visible = m.bubbleScale > 0.02;
      if (m.bubble.visible) {
        const sc = 1.45 * m.bubbleScale * (1 + Math.sin(now * 3 + m.def.sx) * 0.05);
        m.bubble.scale.set(sc * 1.5, sc, 1);
        m.bubble.position.y = m.def.bubbleY + Math.sin(now * 2.4 + m.def.sx) * 0.12;
      }
    }
    // glow and name plate
    const want = near ? 1 : 0;
    this.plateScale += (want - this.plateScale) * k;
    if (near) {
      const lbl = near.signs.find((sg) => sg.group.visible);
      const name = lbl ? (lbl.forSale ? `${MARK_TEXT.names[near.def.id]} ${MARK_TEXT.forSale.toLowerCase()}` : MARK_TEXT.names[near.def.id]) : MARK_TEXT.names[near.def.id];
      if (this.plateFor !== name) { this.plateFor = name; platePill(name, this.plateTex); }
      this.plate.position.set(near.def.sx, near.def.sy + 1.35 + Math.sin(now * 2.2) * 0.07, near.def.sz);
      this.glow.position.set(near.def.stationX, 0.07, near.def.stationZ);
      this.glow.rotation.y = near.def.pose.rot;
    }
    this.plate.visible = this.plateScale > 0.02;
    this.plate.material.opacity = Math.min(1, this.plateScale * 1.2);
    this.glow.visible = this.plateScale > 0.02;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = this.plateScale * (0.55 + Math.sin(now * 3.2) * 0.2);
    this.glow.scale.set(5, 1, 3.4);
  }

  /** The mark nearest the player right now, for the tests and the guide (null when none is in reach). */
  get nearest(): string | null { return this.near?.def.id ?? null; }
}

