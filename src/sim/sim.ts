import { decayCrates, discardSpoiled } from './crates';
import { recoverDemand } from './market';
import { stepBoats } from './boats';
import { payWages, refreshCandidates, stepCaptains, stepDockhands } from './staff';
import { stepRank } from './rank';
import { stepFishing } from './fishing';
import { fillOrders, stepOrders } from './orders';
import type { Rng } from './rng';
import type { Ev, GameState } from './state';
import { advanceClock } from './time';

export { initialState } from './state';
export type { GameState, Ev } from './state';
export { dispatchBoat, unloadBoat } from './boats';
export { pickUp, storeInIce, takeFromIce, handCrates, dockCrates, carryCapacity } from './crates';
export { sellAll, sellCrate } from './market';
export { castLine, hook, cancelCast } from './fishing';
export { buyUpgrade } from './upgrades';
export { buyBoat, buyBoatUpgrade, bestZone } from './fleet';
export { rankOf } from './rank';
export { fireCaptain, fireDockhand, hireCaptain, hireDockhand, setBoatTarget, setHaulPolicy } from './staff';

export { phaseOf } from './time';

/** Start-of-game setup: post the first orders. */
export function startGame(state: GameState, rng: Rng): Ev[] {
  if (state.candidates.length === 0) refreshCandidates(state, rng);
  return fillOrders(state, rng);
}

/** Advance the whole simulation by dt seconds. */
export function step(state: GameState, dt: number, rng: Rng): Ev[] {
  const evs: Ev[] = [];
  const clockEvs = advanceClock(state, dt);
  for (const e of clockEvs) {
    if (e.type !== 'dayEnded') continue;
    discardSpoiled(state);
    evs.push(...payWages(state, e.stats)); // wages belong to the day that just ended
    refreshCandidates(state, rng);
  }
  evs.push(...clockEvs);
  evs.push(...stepBoats(state, dt, rng));
  evs.push(...stepCaptains(state));
  evs.push(...stepDockhands(state, dt));
  evs.push(...decayCrates(state, dt));
  recoverDemand(state, dt);
  evs.push(...stepOrders(state, dt, rng));
  evs.push(...stepFishing(state, dt));
  evs.push(...stepRank(state));
  return evs;
}
