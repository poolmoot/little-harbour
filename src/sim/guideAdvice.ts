import { handCrates } from './crates';
import { trackCost, tripCostFor } from './fleet';
import { GUIDE_STEPS, guideDone } from './guide';
import type { GuideTarget } from './guide';
import type { GameState } from './state';
import { isNight } from './time';

/**
 * The guide never sends the player to something they cannot do yet. When the current step costs more than they have (the trip
 * at "send", crate space at "space"), or boats cannot sail at night, this says what to do instead, in this order: unload a
 * waiting boat, carry crates to the market, send the boat again if the trip can be paid, otherwise fish from the pier.
 */

export type EarnHow = 'unload' | 'carry' | 'pickup' | 'send' | 'pier';
export interface GuideAdvice {
  why: 'cost' | 'night';
  how: EarnHow;
  target: GuideTarget;
  /** What the player has and what the step costs (not set at night). */
  need?: { have: number; cost: number };
}

function earnMore(s: GameState): { how: EarnHow; target: GuideTarget } {
  const boat = s.boats[0];
  if (s.boats.some((b) => b.status === 'returned')) return { how: 'unload', target: 'boat' };
  if (handCrates(s).length) return { how: 'carry', target: 'market' };
  if (s.crates.some((c) => c.loc === 'dock')) return { how: 'pickup', target: 'crate' };
  if (boat && boat.status === 'docked' && !isNight(s) && s.money >= tripCostFor(boat.target, boat)) return { how: 'send', target: 'boat' };
  return { how: 'pier', target: 'pierEnd' };
}

/** Advice for the current step, or null when the step can simply be done. */
export function guideAdvice(s: GameState): GuideAdvice | null {
  if (guideDone(s)) return null;
  const boat = s.boats[0];
  if (!boat) return null;
  switch (GUIDE_STEPS[s.guide.step].id) {
    case 'send': {
      if (isNight(s)) return { why: 'night', how: 'pier', target: 'pierEnd' };
      const cost = tripCostFor(boat.target, boat);
      return s.money < cost ? { why: 'cost', how: 'pier', target: 'pierEnd', need: { have: s.money, cost } } : null;
    }
    case 'space': {
      const cost = trackCost(boat, 'hold');
      return cost !== null && s.money < cost ? { why: 'cost', ...earnMore(s), need: { have: s.money, cost } } : null;
    }
    default: return null;
  }
}
