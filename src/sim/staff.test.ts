import { describe, expect, it } from 'vitest';
import { step, startGame } from './sim';
import { Rng } from './rng';
import { initialState } from './state';
import type { GameState } from './state';
import { dockCrates, addCrate, pickUp, handCrates } from './crates';
import { canHireCaptain, fireCaptain, fireDockhand, hireCaptain, hireDockhand, payWages, refreshCandidates, setBoatTarget, stepCaptains } from './staff';
import { holdSize, rareMult, tripTimeFor } from './fleet';
import { CAPTAIN_WAGE, DOCKHAND_WAGE, ZONES } from './config';
import { dispatchBoat, stepBoats } from './boats';
import { rollCatch } from './catch';

const rng = () => new Rng(7);
function ranked(life: number): GameState {
  const s = initialState();
  s.lifetime = life;
  s.rank = 4;
  return s;
}
function run(s: GameState, secs: number, r = rng()) {
  for (let t = 0; t < secs; t += 0.25) step(s, 0.25, r);
}

describe('captains', () => {
  it('offers three candidates and a new set each day', () => {
    const s = initialState();
    const r = rng();
    startGame(s, r);
    expect(s.candidates).toHaveLength(3);
    const ids = s.candidates.map((c) => c.id);
    s.dayTime = 359.9;
    s.lastPhase = 'night';
    step(s, 0.2, r);
    expect(s.candidates).toHaveLength(3);
    expect(s.candidates.map((c) => c.id)).not.toEqual(ids);
  });
  it('need rank Skipper & Co and a free boat', () => {
    const s = initialState();
    refreshCandidates(s, rng());
    expect(hireCaptain(s, s.candidates[0].id, 1)[0].type).toBe('denied');
    s.lifetime = 3300;
    expect(canHireCaptain(s, 1).ok).toBe(true);
    const c = s.candidates[0];
    expect(hireCaptain(s, c.id, 1)[0].type).toBe('hired');
    expect(s.boats[0].captain?.name).toBe(c.name);
    expect(s.candidates).toHaveLength(2);
    expect(hireCaptain(s, s.candidates[0].id, 1)[0].type).toBe('denied'); // already captained
    expect(fireCaptain(s, 1)[0].type).toBe('fired');
    expect(s.boats[0].captain).toBeNull();
  });
  it('traits change trip time, rare weights, hold size and wage', () => {
    const s = initialState();
    const b = s.boats[0];
    const cap = (trait: 'swift' | 'lucky' | 'careful' | 'thrifty') => ({ id: 1, name: 'X', trait, wage: 40 });
    b.captain = cap('swift');
    expect(tripTimeFor(b, 'shallows')).toBeCloseTo(ZONES.shallows.trip * 0.85);
    b.captain = cap('lucky');
    expect(rareMult(b)).toBeCloseTo(1.25);
    b.captain = cap('careful');
    expect(holdSize(b)).toBe(5);
    s.lifetime = 3300;
    b.captain = null;
    s.candidates = [{ id: 50, name: 'Thr', trait: 'thrifty', wage: 28 }];
    hireCaptain(s, 50, 1);
    expect(s.boats[0].captain?.wage).toBe(28);
    s.boats[0].captain!.unpaid = true; // an absent captain gives no bonus
    expect(holdSize(b)).toBe(4);
  });
  it('sails by itself: unloads, re-sends, day and night', () => {
    const s = ranked(3300);
    const r = rng();
    s.boats[0].captain = { id: 5, name: 'Ansel', trait: 'swift', wage: 40 };
    s.money = 1000;
    run(s, 20, r);
    expect(s.boats[0].status).toBe('out');
    run(s, 40, r); // trip is ~21 s: back, unloaded, sent again
    expect(dockCrates(s).length).toBeGreaterThanOrEqual(4);
    expect(s.book.herring.caught + s.book.mackerel.caught + s.book.flounder.caught).toBeGreaterThanOrEqual(4);
    // night: captains keep sailing
    s.dayTime = 215;
    s.lastPhase = 'night';
    s.boats[0].status = 'returned';
    s.boats[0].catch = ['herring'];
    stepCaptains(s);
    expect(s.boats[0].status).toBe('out');
  });
  it('sails to its assigned zone and cannot be assigned beyond the hull', () => {
    const s = ranked(3300);
    s.boats[0].hull = 1;
    expect(setBoatTarget(s, 1, 'opensea')[0].type).toBe('denied');
    setBoatTarget(s, 1, 'reef');
    s.boats[0].captain = { id: 5, name: 'Ansel', trait: 'swift', wage: 40 };
    stepCaptains(s);
    expect(s.boats[0].zone).toBe('reef');
  });
});

describe('wages', () => {
  it('are paid at 06:00 and counted in the ledger', () => {
    const s = ranked(3300);
    s.boats[0].captain = { id: 5, name: 'A', trait: 'swift', wage: CAPTAIN_WAGE };
    s.dockhands = [{ id: 6, name: 'Pip', slot: 0, job: null }];
    s.money = 500;
    s.boats[0].status = 'out'; // stays at sea, so no trip cost is paid at dawn
    s.boats[0].tripTime = 999;
    s.dayTime = 359.9;
    s.lastPhase = 'night';
    const evs = step(s, 0.2, rng());
    const end = evs.find((e) => e.type === 'dayEnded');
    expect(end && end.type === 'dayEnded' && end.stats.wages).toBe(CAPTAIN_WAGE + DOCKHAND_WAGE);
    expect(s.money).toBe(500 - CAPTAIN_WAGE - DOCKHAND_WAGE);
  });
  it('unpaid staff do not work that day, there is no debt, and they work again once paid', () => {
    const s = ranked(3300);
    s.boats[0].captain = { id: 5, name: 'A', trait: 'swift', wage: CAPTAIN_WAGE };
    s.dockhands = [{ id: 6, name: 'Pip', slot: 0, job: null }];
    s.money = CAPTAIN_WAGE + 10; // enough for the captain only
    payWages(s, s.stats);
    expect(s.money).toBe(10);
    expect(s.boats[0].captain!.unpaid).toBe(false);
    expect(s.dockhands[0].unpaid).toBe(true);
    addCrate(s, 'herring', 'dock', 0);
    run(s, 5);
    expect(s.dockhands[0].job).toBeNull();
    expect(dockCrates(s).length).toBeGreaterThanOrEqual(1);
    s.money = 0;
    payWages(s, s.stats);
    expect(s.boats[0].captain!.unpaid).toBe(true);
    s.boats[0].status = 'docked';
    stepCaptains(s);
    expect(s.boats[0].status).toBe('docked');
    expect(s.money).toBe(0);
    s.money = 500;
    payWages(s, s.stats);
    expect(s.dockhands[0].unpaid).toBe(false);
    expect(s.boats[0].captain!.unpaid).toBe(false);
  });
});

describe('dockhands', () => {
  const hire = (s: GameState) => { hireDockhand(s, rng()); return s.dockhands[s.dockhands.length - 1]; };
  it('need rank Boat Owner and cap at four', () => {
    const s = initialState();
    expect(hireDockhand(s, rng())[0].type).toBe('denied');
    s.lifetime = 500;
    for (let i = 0; i < 6; i++) hireDockhand(s, rng());
    expect(s.dockhands).toHaveLength(4);
    expect(new Set(s.dockhands.map((d) => d.slot)).size).toBe(4);
  });
  it('walk to the dock, carry 2 crates (4 with the handcart) and sell them at the market', () => {
    const s = ranked(500);
    hire(s);
    for (let i = 0; i < 5; i++) addCrate(s, 'mackerel', 'dock', 0);
    const r = rng();
    step(s, 0.1, r);
    expect(s.dockhands[0].job?.crateIds).toHaveLength(2);
    expect(s.dockhands[0].job?.phase).toBe('out');
    const m0 = s.money;
    run(s, 25, r);
    expect(s.money).toBeGreaterThan(m0);
    expect(s.stats.sold).toBeGreaterThanOrEqual(2);
    // handcart doubles it
    const s2 = ranked(500);
    s2.upgrades.handcart = true;
    hire(s2);
    for (let i = 0; i < 6; i++) addCrate(s2, 'mackerel', 'dock', 0);
    step(s2, 0.1, rng());
    expect(s2.dockhands[0].job?.crateIds).toHaveLength(4);
  });
  it('take the most valuable fresh crates first and never double-claim', () => {
    const s = ranked(500);
    hire(s);
    hire(s);
    addCrate(s, 'herring', 'dock', 0);
    const gold = addCrate(s, 'lobster', 'dock', 0);
    addCrate(s, 'snapper', 'dock', 0);
    const old = addCrate(s, 'lobster', 'dock', 0);
    old.freshness = 10;
    step(s, 0.1, rng());
    const a = s.dockhands[0].job!.crateIds, b = s.dockhands[1].job!.crateIds;
    expect(a[0]).toBe(gold.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
    expect(a).toContain(gold.id);
  });
  it('go home to sleep at night: nobody starts a job, and they wake and work again at dawn', () => {
    const s = ranked(500);
    hire(s);
    s.dayTime = 205; // just before night
    s.lastPhase = 'dusk';
    for (let i = 0; i < 4; i++) addCrate(s, 'mackerel', 'dock', 0);
    const r = rng();
    const evs = [];
    for (let t = 0; t < 60; t += 0.25) evs.push(...step(s, 0.25, r));
    expect(evs.filter((e) => e.type === 'workersSleep')).toHaveLength(1);
    expect(s.dockhands[0].job).toBeNull();
    expect(dockCrates(s).length).toBeGreaterThan(0); // left for the morning
    s.dayTime = 358;
    const wake = [];
    for (let t = 0; t < 4; t += 0.25) wake.push(...step(s, 0.25, r));
    expect(wake.filter((e) => e.type === 'workersWake')).toHaveLength(1);
    step(s, 0.25, r);
    expect(s.dockhands[0].job).not.toBeNull();
  });
  it('a worker already carrying at nightfall delivers first; one walking to a crate lets go and walks home', () => {
    const s = ranked(500);
    hire(s);
    hire(s);
    s.dayTime = 200;
    for (let i = 0; i < 4; i++) addCrate(s, 'mackerel', 'dock', 0);
    const r = rng();
    step(s, 0.1, r); // both start 'out'
    const jobs = s.dockhands.map((d) => d.job!);
    expect(jobs.map((j) => j.phase)).toEqual(['out', 'out']);
    s.dayTime = 211;
    s.lastPhase = 'night';
    step(s, 0.1, r);
    expect(s.dockhands.every((d) => d.job?.phase === 'back')).toBe(true);
    expect(s.crates.every((c) => c.carrier === undefined)).toBe(true);
    for (let t = 0; t < 60; t += 0.25) step(s, 0.25, r);
    expect(s.dockhands.every((d) => d.job === null)).toBe(true);
    // carrying workers deliver first
    const t2 = ranked(500);
    hire(t2);
    t2.dayTime = 200;
    addCrate(t2, 'mackerel', 'dock', 0);
    const r2 = rng();
    for (let t = 0; t < 12 && t2.dockhands[0].job?.phase !== 'haul'; t += 0.25) step(t2, 0.25, r2);
    expect(t2.dockhands[0].job?.phase).toBe('haul');
    t2.dayTime = 212;
    t2.lastPhase = 'night';
    const sold0 = t2.stats.sold;
    for (let t = 0; t < 40; t += 0.25) step(t2, 0.25, r2);
    expect(t2.stats.sold).toBe(sold0 + 1);
    expect(t2.dockhands[0].job).toBeNull();
  });
  it('the player can still take a crate a dockhand has claimed, and firing returns carried crates', () => {
    const s = ranked(500);
    const d = hire(s);
    const c = addCrate(s, 'seabass', 'dock', 0);
    step(s, 0.1, rng());
    pickUp(s, c.id);
    expect(handCrates(s)).toHaveLength(1);
    run(s, 15);
    expect(d.job).toBeNull();
    const c2 = addCrate(s, 'seabass', 'dock', 0);
    run(s, 8);
    c2.loc === 'haul' ? expect(fireDockhand(s, d.id)[0].type).toBe('fired') : fireDockhand(s, d.id);
    expect(s.crates.every((k) => k.loc !== 'haul')).toBe(true);
  });
});

describe('new zones', () => {
  it('open sea and deep roll their own fish, rare weights scale with gear', () => {
    const r = new Rng(3);
    const open = rollCatch('opensea', 'day', 400, r);
    expect(open.every((x) => ['cod', 'tuna', 'swordfish'].includes(x))).toBe(true);
    const deep = rollCatch('deep', 'day', 400, r);
    expect(deep.every((x) => ['anglerfish', 'squid', 'sturgeon'].includes(x))).toBe(true);
    const n = (m: number) => rollCatch('deep', 'day', 6000, new Rng(11), m).filter((x) => x === 'sturgeon').length;
    expect(n(2.2)).toBeGreaterThan(n(1) * 1.6);
  });
  it('trip times follow the zone table and a boat needs the hull', () => {
    const s = initialState();
    s.boats[0].hull = 2;
    s.money = 200;
    expect(dispatchBoat(s, 1, 'deep')[0].type).toBe('denied');
    dispatchBoat(s, 1, 'opensea');
    expect(s.boats[0].tripTime).toBe(ZONES.opensea.trip);
    s.boats[0].status = 'docked';
    s.boats[0].hull = 3;
    dispatchBoat(s, 1, 'deep');
    expect(s.boats[0].tripTime).toBe(ZONES.deep.trip);
    stepBoats(s, ZONES.deep.trip + 1, rng());
    expect(s.boats[0].catch).toHaveLength(4);
  });
});
