import {
  BOAT_UPKEEP, CAPTAIN_LEVEL_TRIPS, CAPTAIN_NAMES, CANDIDATE_COUNT, DOCKHAND_NAMES, DOCKHAND_SPEED, DOCKHAND_WAGE, ICE_CAPACITY,
  LAYOUT, MAX_DOCKHANDS, TRAITS, VETERAN_CHANCE, VETERAN_RANK,
} from './config';
import type { ZoneId } from './config';
import { dispatchBoat, unloadBoat } from './boats';
import { rackRoom, restaurantWants, serveRestaurantCrate, startSmoking, coldRoom } from './buildings';
import { freeDockSlot, isSpoiled, removeCrate } from './crates';
import { planJob } from './routing';
import { activeCaptain, bestZone, zoneUnlockedFor } from './fleet';
import { sellCrateObj } from './market';
import { CAPTAINS_RANK, DOCKHANDS_RANK, captainsUnlocked, dockhandsUnlocked, rankOf } from './rank';
import type { Rng } from './rng';
import type { Check, Crate, Dockhand, Ev, GameState, HaulPolicy, Job, Pt } from './state';
import { nextId } from './state';
import { isNight } from './time';
import { captainWage } from './captains';
import { workerSpeedMult } from './town';
import { spendOnUpkeep } from './ledger';

// ---- candidates & hiring -------------------------------------------------

export function refreshCandidates(state: GameState, rng: Rng): void {
  const taken = new Set([...state.boats.map((b) => b.captain?.name), ...state.dockhands.map((d) => d.name)]);
  state.candidates = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const names = CAPTAIN_NAMES.filter((n) => !taken.has(n) && !state.candidates.some((c) => c.name === n));
    const trait = rng.pick(TRAITS);
    const name = rng.pick(names.length ? names : CAPTAIN_NAMES);
    // From VETERAN_RANK some arrive with experience (level 2 or 3) and ask for more pay.
    let trips = 0;
    if (rankOf(state) >= VETERAN_RANK) {
      const r = rng.next();
      if (r < VETERAN_CHANCE[1]) trips = CAPTAIN_LEVEL_TRIPS[2];
      else if (r < VETERAN_CHANCE[0] + VETERAN_CHANCE[1]) trips = CAPTAIN_LEVEL_TRIPS[1];
    }
    state.candidates.push({ id: nextId(state), name, trait, trips });
  }
}

export function canHireCaptain(state: GameState, boatId: number): Check {
  if (!captainsUnlocked(rankOf(state))) return { ok: false, reason: 'Rank too low', needRank: CAPTAINS_RANK };
  const b = state.boats.find((x) => x.id === boatId);
  if (!b) return { ok: false, reason: 'No such boat' };
  if (b.captain) return { ok: false, reason: 'This boat has a captain' };
  return { ok: true };
}

export function hireCaptain(state: GameState, candidateId: number, boatId: number): Ev[] {
  const chk = canHireCaptain(state, boatId);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot hire now.', needRank: chk.needRank }];
  const i = state.candidates.findIndex((c) => c.id === candidateId);
  if (i < 0) return [{ type: 'denied', reason: 'That captain has gone.' }];
  const b = state.boats.find((x) => x.id === boatId)!;
  const [cap] = state.candidates.splice(i, 1);
  b.captain = { ...cap };
  b.target = bestZone(b);
  return [{ type: 'hired', role: 'captain', name: cap.name }];
}

export function fireCaptain(state: GameState, boatId: number): Ev[] {
  const b = state.boats.find((x) => x.id === boatId);
  if (!b?.captain) return [{ type: 'denied', reason: 'There is no captain to let go.' }];
  const name = b.captain.name;
  b.captain = null;
  return [{ type: 'fired', role: 'captain', name }];
}

export function canHireDockhand(state: GameState): Check {
  if (!dockhandsUnlocked(rankOf(state))) return { ok: false, reason: 'Rank too low', needRank: DOCKHANDS_RANK };
  if (state.dockhands.length >= MAX_DOCKHANDS) return { ok: false, reason: 'No room for more workers' };
  return { ok: true };
}

export function hireDockhand(state: GameState, rng: Rng): Ev[] {
  const chk = canHireDockhand(state);
  if (!chk.ok) return [{ type: 'denied', reason: chk.reason ?? 'You cannot hire now.', needRank: chk.needRank }];
  const used = new Set(state.dockhands.map((d) => d.name));
  const name = rng.pick(DOCKHAND_NAMES.filter((n) => !used.has(n)));
  let slot = 0;
  while (state.dockhands.some((d) => d.slot === slot)) slot++;
  state.dockhands.push({ id: nextId(state), name, slot, job: null });
  return [{ type: 'hired', role: 'dockhand', name }];
}

export function fireDockhand(state: GameState, id: number): Ev[] {
  const d = state.dockhands.find((x) => x.id === id);
  if (!d) return [{ type: 'denied', reason: 'No such worker.' }];
  releaseCrates(state, d);
  state.dockhands = state.dockhands.filter((x) => x.id !== id);
  return [{ type: 'fired', role: 'dockhand', name: d.name }];
}

export function setHaulPolicy(state: GameState, p: HaulPolicy): Ev[] {
  state.haulPolicy = p;
  return [];
}

export function setBoatTarget(state: GameState, boatId: number, zone: ZoneId): Ev[] {
  const b = state.boats.find((x) => x.id === boatId);
  if (!b) return [{ type: 'denied', reason: 'No such boat.' }];
  if (!zoneUnlockedFor(b, zone)) return [{ type: 'denied', reason: 'This boat is too small to go there.' }];
  b.target = zone;
  return [];
}

// ---- wages ----------------------------------------------------------------

export const dailyWages = (state: GameState): number =>
  state.boats.reduce((a, b) => a + (b.captain ? captainWage(b.captain, b.hull) : 0), 0) + state.dockhands.length * DOCKHAND_WAGE;

/** Care for all boats a day. */
export const dailyUpkeep = (state: GameState): number => state.boats.reduce((a, b) => a + BOAT_UPKEEP[b.hull], 0);

/** Pay everyone at 06:00, then the boats' care. Staff who cannot be paid sit the day out; care takes what there is. There is no debt. */
export function payWages(state: GameState, stats: { wages: number }): Ev[] {
  let paid = 0, unpaid = 0;
  const pay = (wage: number, set: (u: boolean) => void) => {
    if (state.money >= wage) {
      state.money -= wage;
      stats.wages += wage;
      set(false);
      paid++;
    } else {
      set(true);
      unpaid++;
    }
  };
  for (const b of state.boats) if (b.captain) pay(captainWage(b.captain, b.hull), (u) => { b.captain!.unpaid = u; });
  for (const d of state.dockhands) pay(DOCKHAND_WAGE, (u) => { d.unpaid = u; });
  const upkeep = Math.min(Math.max(0, state.money), dailyUpkeep(state));
  if (upkeep > 0) spendOnUpkeep(state, upkeep);
  return paid + unpaid > 0 || upkeep > 0 ? [{ type: 'wagesPaid', paid, unpaid, upkeep }] : [];
}

// ---- captains at work -------------------------------------------------------

export function stepCaptains(state: GameState): Ev[] {
  const evs: Ev[] = [];
  for (const b of state.boats) {
    if (!activeCaptain(b)) continue;
    if (b.status === 'returned') evs.push(...unloadBoat(state, b.id, true));
    if (b.status === 'docked' && (!isNight(state) || state.buildings.lighthouse > 0)) {
      const r = dispatchBoat(state, b.id, undefined, true);
      if (r[0].type === 'boatDispatched') evs.push(r[0]);
    }
  }
  return evs;
}

// ---- dockhands at work ---------------------------------------------------------

export const homePos = (slot: number): Pt => ({ x: LAYOUT.dockhandHome.x + slot * 0.8, z: LAYOUT.dockhandHome.z });

function pathLen(p: Pt[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
  return l;
}

function mkJob(phase: Job['phase'], path: Pt[], crateIds: number[], dest: Job['dest'], src?: Job['src']): Job {
  const job: Job = { phase, path, len: pathLen(path), d: 0, crateIds, dest };
  if (src) job.src = src;
  return job;
}

const BUILDING_DEST: Partial<Record<Job['dest'], keyof typeof LAYOUT.plots>> = { cold: 'coldstore', restaurant: 'restaurant', smoke: 'smokehouse' };
const doorOf = (id: keyof typeof LAYOUT.plots): Pt => ({ x: LAYOUT.plots[id].doorX, z: LAYOUT.plots[id].doorZ });

/** The walking lane as a U round the open middle of the square: down the west side, along the sea side, down the east side (centre lines). */
const SQ = LAYOUT.square;
const LANE_W = SQ.x0 + SQ.front + SQ.lane / 2, LANE_E = SQ.x1 - SQ.front - SQ.lane / 2, LANE_S = SQ.z0 + SQ.front + SQ.lane / 2, LANE_END = SQ.z1 - 1.5;
const U: Pt[] = [{ x: LANE_W, z: LANE_END }, { x: LANE_W, z: LANE_S }, { x: LANE_E, z: LANE_S }, { x: LANE_E, z: LANE_END }];
const clampTo = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** The nearest spot on the lane's centre line, and how far along the U it is (in distance from its west end). */
function joinLane(p: Pt): { pt: Pt; s: number } {
  let best = { pt: U[0], s: 0 }, bd = Infinity, s0 = 0;
  for (let i = 1; i < U.length; i++) {
    const a = U[i - 1], b = U[i], len = Math.hypot(b.x - a.x, b.z - a.z);
    const t = clampTo(((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (len * len), 0, 1);
    const q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d < bd) { bd = d; best = { pt: q, s: s0 + t * len }; }
    s0 += len;
  }
  return best;
}
/** Waypoints from a spot to where it joins the lane (the lighthouse's breakwater leaves the square's top-right corner and joins at the east end of the sea lane). */
function toLane(p: Pt): { via: Pt[]; join: { pt: Pt; s: number } } {
  if (p.x > SQ.x1 && p.z < SQ.z0) return { via: [{ x: p.x, z: SQ.z0 - 0.4 }, { x: SQ.x1 - 0.6, z: SQ.z0 + 0.5 }], join: joinLane({ x: LANE_E, z: LANE_S }) };
  return { via: [], join: joinLane(p) };
}

/**
 * A walk between two places in the harbour: out of the pier lane, across to the walking lane, along it (down one side, along the sea side
 * and down the other as far as needed), then across to the spot. The lanes and the frontage are kept clear by the layout tests.
 */
export function walkPath(from: Pt, to: Pt): Pt[] {
  const raw: Pt[] = [from];
  if (from.z < 1.5 && Math.abs(from.x) < 3) raw.push(laneEntry(from.x));
  const a = toLane(raw[raw.length - 1]), b = toLane(to);
  raw.push(...a.via, a.join.pt);
  let s0 = 0;
  const corners: { s: number; pt: Pt }[] = [];
  for (let i = 1; i < U.length; i++) { s0 += Math.hypot(U[i].x - U[i - 1].x, U[i].z - U[i - 1].z); if (i < U.length - 1) corners.push({ s: s0, pt: U[i] }); }
  const mids = corners.filter((c) => c.s > Math.min(a.join.s, b.join.s) + 0.01 && c.s < Math.max(a.join.s, b.join.s) - 0.01);
  raw.push(...(a.join.s <= b.join.s ? mids : mids.reverse()).map((c) => c.pt), b.join.pt, ...b.via.slice().reverse(), to);
  return raw.filter((p, i) => i === 0 || Math.hypot(p.x - raw[i - 1].x, p.z - raw[i - 1].z) > 0.01);
}

/** Where a job's walker is right now, and which way it faces. */
export function jobPose(job: Job, out: { x: number; z: number; dx: number; dz: number }): void {
  let d = Math.min(job.d, job.len);
  const p = job.path;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
    if (d <= seg || i === p.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 1;
      out.x = p[i - 1].x + (p[i].x - p[i - 1].x) * t;
      out.z = p[i - 1].z + (p[i].z - p[i - 1].z) * t;
      out.dx = p[i].x - p[i - 1].x;
      out.dz = p[i].z - p[i - 1].z;
      return;
    }
    d -= seg;
  }
  out.x = p[0].x; out.z = p[0].z; out.dx = 0; out.dz = 0;
}

function laneEntry(x: number): Pt {
  return { x: Math.max(-1.4, Math.min(1.4, x)), z: 0.6 };
}

function haulPath(from: Pt, dest: Job['dest']): Pt[] {
  const bld = BUILDING_DEST[dest];
  if (bld) return walkPath(from, doorOf(bld));
  if (from.z > 4 && dest === 'market') return walkPath(from, LAYOUT.marketDrop); // collecting from a building on the quay
  if (dest === 'market') return walkPath(from, LAYOUT.marketDrop);
  return walkPath(from, LAYOUT.iceDrop);
}
function backPath(from: Pt, home: Pt, dest: Job['dest']): Pt[] {
  if (BUILDING_DEST[dest] || dest === 'market') return walkPath(from, home);
  if (dest === 'ice') return walkPath(from, home);
  return [from, laneEntry(from.x), home];
}

function releaseCrates(state: GameState, d: Dockhand): void {
  for (const c of [...state.crates]) {
    if (c.carrier !== d.id) continue;
    c.carrier = undefined;
    if (c.loc === 'haul') {
      c.loc = 'dock';
      const p = freeDockSlot(state, c.x !== undefined && c.x > 0 ? 1 : 0);
      c.x = p.x; c.z = p.z; c.layer = p.layer;
    }
  }
  d.job = null;
}

function startJob(state: GameState, d: Dockhand): void {
  const plan = planJob(state);
  if (!plan) return;
  for (const c of plan.crates) c.carrier = d.id;
  const from = homePos(d.slot);
  const first = plan.crates[0];
  if (plan.src === 'smoke') {
    d.job = mkJob('out', walkPath(from, doorOf('smokehouse')), plan.crates.map((c) => c.id), plan.dest, 'smoke');
    return;
  }
  const target = { x: first.x ?? 0, z: first.z ?? 0 };
  d.job = mkJob('out', [from, laneEntry(target.x), target], plan.crates.map((c) => c.id), plan.dest, 'dock');
}

function finishPhase(state: GameState, d: Dockhand, evs: Ev[]): void {
  const job = d.job!;
  const home = homePos(d.slot);
  const here = job.path[job.path.length - 1];
  if (job.phase === 'out') {
    const got: Crate[] = [];
    for (const id of job.crateIds) {
      const c = state.crates.find((k) => k.id === id);
      const here0 = job.src === 'smoke' ? c?.loc === 'smoke' && c.smoked : c?.loc === 'dock' && !isSpoiled(c);
      if (c && here0 && c.carrier === d.id) got.push(c);
    }
    for (const c of state.crates) if (c.carrier === d.id && !got.includes(c)) c.carrier = undefined;
    if (got.length === 0) {
      d.job = mkJob('back', backPath(here, home, job.dest), [], job.dest);
      return;
    }
    for (const c of got) { c.loc = 'haul'; c.smokeLeft = undefined; }
    d.job = mkJob('haul', haulPath(here, job.dest), got.map((c) => c.id), job.dest);
    return;
  }
  if (job.phase === 'haul') {
    for (const id of job.crateIds) {
      const c = state.crates.find((k) => k.id === id);
      if (!c) continue;
      c.carrier = undefined;
      if (job.dest === 'market') {
        evs.push(...sellCrateObj(state, c, true));
      } else if (job.dest === 'restaurant' && restaurantWants(state, c)) {
        evs.push(...serveRestaurantCrate(state, c, true));
      } else if (job.dest === 'smoke' && rackRoom(state) > 0 && !c.smoked && !c.golden && !isSpoiled(c)) {
        startSmoking(state, c);
        evs.push({ type: 'crateSmoking', crateId: c.id });
      } else if (job.dest === 'cold' && coldRoom(state) > 0 && !isSpoiled(c)) {
        c.loc = 'cold';
      } else if (job.dest === 'ice' && state.crates.filter((k) => k.loc === 'ice').length < ICE_CAPACITY) {
        c.loc = 'ice';
      } else if (isSpoiled(c)) {
        removeCrate(state, c.id);
      } else {
        c.loc = 'dock';
        const p = freeDockSlot(state, 0);
        c.x = p.x; c.z = p.z; c.layer = p.layer;
      }
    }
    d.job = mkJob('back', backPath(here, home, job.dest), [], job.dest);
    return;
  }
  d.job = null;
}

export function stepDockhands(state: GameState, dt: number): Ev[] {
  const evs: Ev[] = [];
  for (const d of state.dockhands) {
    if (!d.job) {
      if (!d.unpaid) startJob(state, d);
      continue;
    }
    d.job.d += DOCKHAND_SPEED * workerSpeedMult(state) * dt;
    if (d.job.d >= d.job.len) finishPhase(state, d, evs);
  }
  return evs;
}

/** Put every hauled crate back on the dock (used when loading a save). */
export function resetDockhands(state: GameState): void {
  for (const d of state.dockhands) d.job = null;
  for (const c of state.crates) {
    c.carrier = undefined;
    if (c.loc === 'haul') {
      c.loc = 'dock';
      const p = freeDockSlot(state, 0);
      c.x = p.x; c.z = p.z; c.layer = p.layer;
    }
  }
}
