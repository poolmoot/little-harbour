import { BOAT_RANGE, BUILDING_IDS, CRATE_RANGE, INTERACT_RANGE, LAYOUT } from './sim/config';
import { binCrates, carryCapacity, castLine, deliverKingFish, dockCrates, handCrates, hook, pickUpBin, unloadBoat } from './sim/sim';
import type { Ev, GameState } from './sim/sim';
import type { Rng } from './sim/rng';
import type { Prompt } from './ui/hud';
import type { PanelKind } from './ui/panels';
import { SAY2 } from './ui/screenText';
import { BUILDING_LABEL, say } from './ui/text';


export type TargetKind = 'crate' | 'boat' | 'market' | 'shipyard' | 'board' | 'icebox' | 'fishing' | 'inn' | 'plot';
export interface Target {
  kind: TargetKind;
  id: number;
  x: number;
  z: number;
  dist: number;
}

export const STATIONS: Record<Exclude<TargetKind, 'crate' | 'boat' | 'plot'>, { x: number; z: number; range: number }> = {
  market: { ...LAYOUT.stations.market, range: INTERACT_RANGE },
  shipyard: { ...LAYOUT.stations.shipyard, range: INTERACT_RANGE },
  board: { ...LAYOUT.stations.board, range: INTERACT_RANGE },
  icebox: { ...LAYOUT.stations.icebox, range: INTERACT_RANGE },
  inn: { ...LAYOUT.stations.inn, range: INTERACT_RANGE },
  fishing: { x: LAYOUT.fishingSpot.x, z: LAYOUT.fishingSpot.z, range: 3.2 },
};

/** What pressing E does: either game events to run, or a panel to open. */
export type Interaction = { evs: Ev[] } | { open: PanelKind; arg?: number } | null;

export function interact(t: Target | null, s: GameState, rng: Rng): Interaction {
  if (!t) return null;
  switch (t.kind) {
    case 'crate': return { evs: pickUpBin(s, t.id) };
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
    case 'inn': return handCrates(s).some((c) => c.king) ? { evs: deliverKingFish(s) } : { open: 'hire' };
    case 'plot': return { open: 'plot', arg: t.id };
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
  BUILDING_IDS.forEach((id, i) => {
    const p = LAYOUT.plots[id];
    consider('plot', i, p.doorX, p.doorZ, INTERACT_RANGE);
  });
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
      const take = Math.min(binCrates(s, c.x, c.z).length, carryCapacity(s) - handCrates(s).length);
      return { text: take > 1 ? say.pickUpMany(take) : say.pickUp(c.species, Math.round(c.freshness)), key: true };
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
    case 'inn': return handCrates(s).some((c) => c.king) ? { text: SAY2.promptKing, key: true, hot: true } : { text: say.inn, key: true };
    case 'plot': {
      const id = BUILDING_IDS[t.id];
      return { text: BUILDING_LABEL.prompt(id, s.buildings[id]), key: true };
    }
    case 'icebox': return { text: s.upgrades.icebox ? say.iceOwned : say.iceBuy, key: true };
    case 'fishing':
      if (s.fishing.phase === 'idle') return { text: say.cast, key: true };
      if (s.fishing.phase === 'bite') return { text: say.pullNow, key: true, hot: true };
      return { text: say.waitBite, key: true, dim: true };
  }
}

