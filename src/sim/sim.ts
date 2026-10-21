import { decayCrates, discardSpoiled } from './crates';
import { resetRestaurant, stepSmokehouse } from './buildings';
import { stepContracts } from './contracts';
import { stepBookRewards } from './fishbook';
import { stepGoals } from './goals';
import { stepGuide } from './guide';
import { stepIncome } from './income';
import { stepRepairs } from './storm';
import { rollNewDay, startWeather } from './weather';
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
export { pickUp, pickUpBin, binCrates, storeInIce, takeFromIce, handCrates, dockCrates, carryCapacity } from './crates';
export { sellAll, sellCrate } from './market';
export { castLine, hook, cancelCast } from './fishing';
export { buyUpgrade } from './upgrades';
export { buyBoat, buyBoatUpgrade, bestZone } from './fleet';
export { buyBuilding, canBuyBuilding, nextBuildingCost, buildingMaxLevel, storeInCold, takeFromCold, smokeCrate, collectSmoked, setSmokeList, sellToRestaurant, restaurantPrice } from './buildings';
export { acceptContract } from './contracts';
export { buyProject, canBuyProject, projectDone } from './town';
export { captainLevel, captainWage } from './captains';
export { currentGoal, goalProgress } from './goals';
export { stepGuide, noteWalk, noteBoardOpened, noteWelcomed, noteAway, isGentle, guideDone, GUIDE_STEPS, UNLOCKS } from './guide';
export { repairBoat, canRepair, repairCost, setStayInStorms } from './storm';
export { deliverKingFish, endingSummary } from './ending';
export { applyAway, awayEarnings, measureAwayRate } from './away';
export type { AwayResult } from './away';
export { moneyPerMinute } from './income';
export { rankOf } from './rank';
export { fireCaptain, fireDockhand, hireCaptain, hireDockhand, setBoatTarget, setHaulPolicy } from './staff';

export { bookCompletion, crateSize, crateStars, starsFor, sizeMult, midSize, zoneFish } from './fishbook';
export { renameBoat, setHarbourName, checkName } from './names';
export { phaseOf } from './time';

/** Start-of-game setup: post the first orders. */
export function startGame(state: GameState, rng: Rng): Ev[] {
  if (state.candidates.length === 0) refreshCandidates(state, rng);
  if (state.day === 1 && state.clock === 0) startWeather(state, rng);
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
    resetRestaurant(state);
    const w = rollNewDay(state, rng);
    e.forecast = w.forecast;
    evs.push(w.ev);
  }
  evs.push(...clockEvs);
  evs.push(...stepBoats(state, dt, rng));
  evs.push(...stepCaptains(state));
  evs.push(...stepDockhands(state, dt));
  evs.push(...decayCrates(state, dt));
  recoverDemand(state, dt);
  evs.push(...stepOrders(state, dt, rng));
  evs.push(...stepFishing(state, dt));
  evs.push(...stepSmokehouse(state, dt));
  evs.push(...stepRepairs(state, dt));
  evs.push(...stepContracts(state, rng));
  stepIncome(state, dt);
  evs.push(...stepRank(state));
  evs.push(...stepBookRewards(state));
  evs.push(...stepGoals(state));
  evs.push(...stepGuide(state));
  return evs;
}
