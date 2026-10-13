import { BOAT_COST, REPAIR_COST_FRACTION, REPAIR_SECONDS, TRACK_COST } from './config';
import { spend } from './ledger';
import type { Boat, Check, Ev, GameState } from './state';

/** What the boat's size is worth: the rowboat price plus the boat-size steps bought since. */
export function boatSizeValue(b: Boat): number {
  let v = BOAT_COST[1];
  for (let i = 1; i <= b.hull; i++) v += TRACK_COST.hull[i];
  return v;
}
export const repairCost = (b: Boat): number => Math.round(boatSizeValue(b) * REPAIR_COST_FRACTION);

export function canRepair(state: GameState, boatId: number): Check {
  const b = state.boats.find((x) => x.id === boatId);
  if (!b) return { ok: false, reason: 'No such boat.' };
  if (!b.damaged) return { ok: false, reason: 'This boat is not broken.' };
  if (b.repairLeft !== undefined) return { ok: false, reason: 'It is being fixed.' };
  if (b.status !== 'docked') return { ok: false, reason: 'Unload the boat first.' };
  const cost = repairCost(b);
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost };
  return { ok: true, cost };
}

/** Pay the boat builder to fix a broken boat. It takes REPAIR_SECONDS. */
export function repairBoat(state: GameState, boatId: number): Ev[] {
  const chk = canRepair(state, boatId);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot fix that.' }];
  const b = state.boats.find((x) => x.id === boatId)!;
  spend(state, chk.cost!);
  b.repairLeft = REPAIR_SECONDS;
  return [{ type: 'boatRepairStarted', boatId, cost: chk.cost! }];
}

export function stepRepairs(state: GameState, dt: number): Ev[] {
  const evs: Ev[] = [];
  for (const b of state.boats) {
    if (b.repairLeft === undefined) continue;
    b.repairLeft -= dt;
    if (b.repairLeft <= 0) {
      b.repairLeft = undefined;
      b.damaged = false;
      evs.push({ type: 'boatRepaired', boatId: b.id });
    }
  }
  return evs;
}

/** The "Stay home in storms" tick in the boat panel. */
export function setStayInStorms(state: GameState, boatId: number, stay: boolean): Ev[] {
  const b = state.boats.find((x) => x.id === boatId);
  if (!b) return [{ type: 'denied', reason: 'No such boat.' }];
  b.stayInStorms = stay;
  return [];
}
