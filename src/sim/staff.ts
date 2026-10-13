import {
  CAPTAIN_NAMES, CAPTAIN_WAGE, CANDIDATE_COUNT, DOCKHAND_NAMES, DOCKHAND_SPEED, DOCKHAND_WAGE, ICE_CAPACITY, LAYOUT,
  MAX_DOCKHANDS, THRIFTY_MULT, TRAITS,
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

// ---- candidates & hiring -------------------------------------------------

export function refreshCandidates(state: GameState, rng: Rng): void {
  const taken = new Set([...state.boats.map((b) => b.captain?.name), ...state.dockhands.map((d) => d.name)]);
  state.candidates = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const names = CAPTAIN_NAMES.filter((n) => !taken.has(n) && !state.candidates.some((c) => c.name === n));
    const trait = rng.pick(TRAITS);
    const name = rng.pick(names.length ? names : CAPTAIN_NAMES);
    state.candidates.push({ id: nextId(state), name, trait, wage: Math.round(CAPTAIN_WAGE * (trait === 'thrifty' ? THRIFTY_MULT : 1)) });
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
  state.boats.reduce((a, b) => a + (b.captain?.wage ?? 0), 0) + state.dockhands.length * DOCKHAND_WAGE;

/** Pay everyone at 06:00. Staff who cannot be paid sit the day out; there is no debt. */
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
  for (const b of state.boats) if (b.captain) pay(b.captain.wage, (u) => { b.captain!.unpaid = u; });
  for (const d of state.dockhands) pay(DOCKHAND_WAGE, (u) => { d.unpaid = u; });
  return paid + unpaid > 0 ? [{ type: 'wagesPaid', paid, unpaid }] : [];
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

/** A walk between two places on the quay: out of the pier lane, along the east-west corridor, then to the spot. */
export function walkPath(from: Pt, to: Pt): Pt[] {
  const raw: Pt[] = [from];
  if (from.z < 1.5) raw.push(laneEntry(from.x));
  const cz = LAYOUT.corridorZ;
  const last = raw[raw.length - 1];
  raw.push({ x: last.x, z: cz }, { x: to.x, z: cz }, to);
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
  const e = laneEntry(from.x);
  return dest === 'market'
    ? [from, e, { x: -2.2, z: 6.4 }, { x: LAYOUT.marketDrop.x, z: 6.4 }, LAYOUT.marketDrop]
    : [from, e, { x: -2.4, z: LAYOUT.iceDrop.z }, LAYOUT.iceDrop];
}
function backPath(from: Pt, home: Pt, dest: Job['dest']): Pt[] {
  if (BUILDING_DEST[dest] || from.x > 8 || from.x < -9.5) return walkPath(from, home);
  if (dest === 'market' && from.z > 4) return [from, { x: LAYOUT.marketDrop.x, z: 6.4 }, { x: -2.2, z: 6.4 }, home];
  if (dest === 'ice' && from.z > 3) return [from, { x: -2.4, z: LAYOUT.iceDrop.z }, home];
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
      } else if (job.dest === 'smoke' && rackRoom(state) > 0 && !c.smoked && !isSpoiled(c)) {
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
    d.job.d += DOCKHAND_SPEED * dt;
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
