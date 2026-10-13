import { decayCrates, discardSpoiled } from './crates';
import { recoverDemand } from './market';
import { stepBoats } from './boats';
import { stepFishing } from './fishing';
import { fillOrders, stepOrders } from './orders';
import type { Rng } from './rng';
import type { Ev, GameState } from './state';
import { advanceClock } from './time';

export { initialState, holdSize } from './state';
export type { GameState, Ev } from './state';
export { dispatchBoat, unloadBoat, zoneUnlocked } from './boats';
export { pickUp, storeInIce, takeFromIce, nearestDockCrate, handCrates, iceCrates, dockCrates, carryCapacity, isSpoiled, freshnessMultiplier } from './crates';
export { sellAll, sellCrate, crateValue, unitPrice } from './market';
export { castLine, hook, cancelCast } from './fishing';
export { buyUpgrade, canBuy } from './upgrades';
export { matchingOrder } from './orders';
export { formatClock, phaseOf, hourOf, isNight } from './time';

/** Start-of-game setup: post the first orders. */
export function startGame(state: GameState, rng: Rng): Ev[] {
  return fillOrders(state, rng);
}

/** Advance the whole simulation by dt seconds. */
export function step(state: GameState, dt: number, rng: Rng): Ev[] {
  const evs: Ev[] = [];
  const clockEvs = advanceClock(state, dt);
  for (const e of clockEvs) if (e.type === 'dayEnded') discardSpoiled(state);
  evs.push(...clockEvs);
  evs.push(...stepBoats(state, dt, rng));
  evs.push(...decayCrates(state, dt));
  recoverDemand(state, dt);
  evs.push(...stepOrders(state, dt, rng));
  evs.push(...stepFishing(state, dt));
  return evs;
}
