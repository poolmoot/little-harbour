import { BUILDING_IDS, GOALS, ZONES } from './config';
import type { GoalArrow, GoalDef, Species } from './config';
import { earnReward } from './ledger';
import { rankOf } from './rank';
import type { Ev, GameState } from './state';

/** How far along a goal is. The goal is met when have >= need. */
export function goalProgress(state: GameState, g: GoalDef): { have: number; need: number } {
  const t = state.tally;
  const n = g.n ?? 1;
  switch (g.kind) {
    case 'dispatched': return { have: t.dispatched, need: n };
    case 'unloaded': return { have: t.unloaded, need: n };
    case 'sold': return { have: t.sold, need: n };
    case 'pier': return { have: t.pier, need: n };
    case 'orders': return { have: t.orders, need: n };
    case 'storm': return { have: t.storm, need: n };
    case 'contracts': return { have: t.contracts, need: n };
    case 'holdLevel': return { have: Math.max(...state.boats.map((b) => b.hold)), need: n };
    case 'rank': return { have: rankOf(state), need: n };
    case 'dockhands': return { have: state.dockhands.length, need: n };
    case 'boats': return { have: state.boats.length, need: n };
    case 'captains': return { have: state.boats.filter((b) => b.captain).length, need: n };
    case 'zoneSent': return { have: t.zoneSent[g.zone!], need: n };
    case 'building': return { have: state.buildings[g.building!] > 0 ? 1 : 0, need: 1 };
    case 'buildingLevel': return { have: Math.max(...BUILDING_IDS.map((b) => state.buildings[b])), need: n };
    case 'zoneFish': {
      const fish = Object.keys(ZONES[g.zone!].table) as Species[];
      return { have: fish.filter((f) => state.book[f].caught > 0).length, need: fish.length };
    }
    case 'king': return { have: state.king.found ? 1 : 0, need: 1 };
  }
}

export const goalMet = (state: GameState, g: GoalDef): boolean => {
  const p = goalProgress(state, g);
  return p.have >= p.need;
};

export interface CurrentGoal { index: number; total: number; id: string; reward: number; arrow?: GoalArrow; have: number; need: number }

/** The goal the HUD shows, or null when every goal is done. */
export function currentGoal(state: GameState): CurrentGoal | null {
  const g = GOALS[state.goal];
  if (!g) return null;
  const p = goalProgress(state, g);
  return { index: state.goal, total: GOALS.length, id: g.id, reward: g.reward, arrow: g.arrow, have: Math.min(p.have, p.need), need: p.need };
}

/** Finish every goal that is met, one after another, paying each reward. Goals already met when they come up complete at once. */
export function stepGoals(state: GameState): Ev[] {
  const evs: Ev[] = [];
  while (state.goal < GOALS.length && goalMet(state, GOALS[state.goal])) {
    const g = GOALS[state.goal];
    earnReward(state, g.reward);
    evs.push({ type: 'goalDone', index: state.goal, id: g.id, reward: g.reward });
    state.goal += 1;
  }
  return evs;
}

/** Skip goals that an older save already meets, without paying for them. */
export function catchUpGoals(state: GameState): void {
  while (state.goal < GOALS.length && goalMet(state, GOALS[state.goal])) state.goal += 1;
}
