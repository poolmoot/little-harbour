import { LAYOUT } from './sim/config';
import { dockCrates } from './sim/sim';
import type { GuideTarget } from './sim/guide';
import type { GameState } from './sim/state';
import { STATIONS } from './interaction';

/** The world position a guide target points to, taken from LAYOUT and the interaction points (never typed in here). */
export function guidePoint(t: GuideTarget, s: GameState, from: { x: number; z: number }): { x: number; z: number } {
  switch (t) {
    case 'boat': {
      const b = s.boats.find((x) => x.status === 'returned') ?? s.boats[0];
      const berth = LAYOUT.berths[b.berth];
      return { x: berth.edgeX, z: berth.edgeZ };
    }
    case 'pierEnd': return STATIONS.fishing;
    case 'crate': {
      let best: { x: number; z: number } | null = null, bd = Infinity;
      for (const c of dockCrates(s)) {
        const d = Math.hypot((c.x ?? 0) - from.x, (c.z ?? 0) - from.z);
        if (d < bd) { bd = d; best = { x: c.x ?? 0, z: c.z ?? 0 }; }
      }
      return best ?? STATIONS.market;
    }
    case 'market': case 'shipyard': case 'board': case 'inn': return STATIONS[t];
    default: return { x: LAYOUT.plots[t].doorX, z: LAYOUT.plots[t].doorZ };
  }
}
