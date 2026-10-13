import { BOAT_RANGE, CRATE_RANGE, INTERACT_RANGE, LAYOUT } from './sim/config';
import { carryCapacity, castLine, dockCrates, handCrates, hook, pickUp, unloadBoat } from './sim/sim';
import type { Ev, GameState } from './sim/sim';
import type { Rng } from './sim/rng';
import type { Prompt } from './ui/hud';
import type { PanelKind } from './ui/panels';
import { say } from './ui/text';


export type TargetKind = 'crate' | 'boat' | 'market' | 'shipyard' | 'board' | 'icebox' | 'fishing' | 'inn';
export interface Target {
  kind: TargetKind;
  id: number;
  x: number;
  z: number;
  dist: number;
}

export const STATIONS: Record<Exclude<TargetKind, 'crate' | 'boat'>, { x: number; z: number; range: number }> = {
  market: { x: LAYOUT.market.x, z: LAYOUT.market.z + 1.7, range: INTERACT_RANGE },
  shipyard: { x: LAYOUT.shipyard.x, z: LAYOUT.shipyard.z + 2.8, range: INTERACT_RANGE },
  board: { x: LAYOUT.noticeBoard.x, z: LAYOUT.noticeBoard.z + 0.5, range: INTERACT_RANGE },
  icebox: { x: LAYOUT.iceBox.x, z: LAYOUT.iceBox.z + 1.1, range: INTERACT_RANGE },
  inn: { x: LAYOUT.inn.x + 0.8, z: LAYOUT.inn.z + 3.6, range: INTERACT_RANGE },
  fishing: { x: LAYOUT.fishingSpot.x, z: LAYOUT.fishingSpot.z, range: 3.2 },
};

/** What pressing E does: either game events to run, or a panel to open. */
export type Interaction = { evs: Ev[] } | { open: PanelKind; arg?: number } | null;

export function interact(t: Target | null, s: GameState, rng: Rng): Interaction {
  if (!t) return null;
  switch (t.kind) {
    case 'crate': return { evs: pickUp(s, t.id) };
    case 'boat': {
      const b = s.boats.find((x) => x.id === t.id);
      if (!b) return null;
      if (b.status === 'returned' && !b.captain) return { evs: unloadBoat(s, b.id) };
      return { open: 'boat', arg: b.id };
    }
    case 'market': return { open: 'market' };
    case 'shipyard': return { open: 'shipyard' };
    case 'board': return { open: 'board' };
    case 'icebox': return { open: 'ice' };
    case 'inn': return { open: 'hire' };
    case 'fishing': return { evs: s.fishing.phase === 'idle' ? castLine(s, rng) : hook(s, rng) };
  }
}

export function findTarget(s: GameState, p: { x: number; z: number }): Target | null {
  let best: Target | null = null;
  for (const c of dockCrates(s)) {
    const d = Math.hypot((c.x ?? 0) - p.x, (c.z ?? 0) - p.z);
    if (d <= CRATE_RANGE && (!best || d < best.dist)) best = { kind: 'crate', id: c.id, x: c.x ?? 0, z: c.z ?? 0, dist: d };
  }
  if (best) return best;
  const consider = (kind: TargetKind, id: number, x: number, z: number, range: number) => {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d <= range && (!best || d < best.dist)) best = { kind, id, x, z, dist: d };
  };
  for (const b of s.boats) {
    const berth = LAYOUT.berths[b.berth];
    consider('boat', b.id, berth.edgeX, berth.edgeZ, BOAT_RANGE);
  }
  for (const k of Object.keys(STATIONS) as (keyof typeof STATIONS)[]) {
    const st = STATIONS[k];
    consider(k, 0, st.x, st.z, st.range);
  }
  return best;
}

export function promptFor(s: GameState, t: Target | null): Prompt | null {
if (!t) return null;
  switch (t.kind) {
    case 'crate': {
      const c = s.crates.find((x) => x.id === t.id);
      if (!c) return null;
      if (c.freshness <= 0) return { text: say.throwAway(c.species), key: true };
      if (handCrates(s).length >= carryCapacity(s)) return { text: say.handsFull, key: false, dim: true };
      return { text: say.pickUp(c.species, Math.round(c.freshness)), key: true };
    }
    case 'boat': {
      const b = s.boats.find((x) => x.id === t.id);
      if (!b) return null;
      if (b.status === 'returned' && !b.captain) return { text: say.unload(b.name, b.catch.length), key: true, hot: true };
      return { text: say.openBoat(b.name, b.status === 'out' ? Math.max(0, Math.ceil(b.tripTime - b.progress)) : null), key: true };
    }
    case 'market': return { text: say.market, key: true };
    case 'shipyard': return { text: say.shipyard, key: true };
    case 'board': return { text: say.board, key: true };
    case 'inn': return { text: say.inn, key: true };
    case 'icebox': return { text: s.upgrades.icebox ? say.iceOwned : say.iceBuy, key: true };
    case 'fishing':
      if (s.fishing.phase === 'idle') return { text: say.cast, key: true };
      if (s.fishing.phase === 'bite') return { text: say.pullNow, key: true, hot: true };
      return { text: say.waitBite, key: true, dim: true };
  }
}

