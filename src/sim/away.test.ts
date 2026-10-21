import { describe, expect, it } from 'vitest';
import { AWAY_MAX_SECONDS } from './config';
import { applyAway, awayEarnings } from './away';
import { Rng } from './rng';
import { loadGameWithAway, saveGame } from './save';
import type { StorageLike } from './save';
import { initialState } from './state';
import type { GameState } from './state';

function captained(): GameState {
  const s = initialState();
  s.money = 200;
  s.lifetime = 600;
  s.rank = 1;
  s.boats[0].captain = { id: 90, name: 'Ansel', trait: 'swift' };
  s.dockhands.push({ id: 91, name: 'Pip', slot: 0, job: null });
  return s;
}
function memory(): StorageLike {
  const d = new Map<string, string>();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

describe('earnings while away', () => {
  it('a harbour with no captains earns nothing', () => {
    const s = initialState();
    expect(awayEarnings(s, 3600, new Rng(1))!.earned).toBe(0);
    const m = s.money;
    expect(applyAway(s, 3600, new Rng(1)).events).toEqual([]);
    expect(s.money).toBe(m);
  });
  it('a captained harbour earns a positive, stable amount', () => {
    const a = awayEarnings(captained(), 1800, new Rng(5))!;
    const b = awayEarnings(captained(), 1800, new Rng(5))!;
    expect(a.earned).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(a.perMinute).toBeGreaterThan(0);
  });
  it('caps the time at 8 hours and ignores under 60 seconds', () => {
    const s = captained();
    const long = awayEarnings(s, AWAY_MAX_SECONDS * 3, new Rng(5))!;
    const cap = awayEarnings(s, AWAY_MAX_SECONDS, new Rng(5))!;
    expect(long.seconds).toBe(AWAY_MAX_SECONDS);
    expect(long.earned).toBe(cap.earned);
    expect(awayEarnings(s, 59, new Rng(5))).toBeNull();
    expect(awayEarnings(s, 60, new Rng(5))).not.toBeNull();
  });
  it('leaves the live state, clock and random stream untouched while measuring', () => {
    const s = captained();
    const before = JSON.stringify(s);
    const rng = new Rng(7);
    const probe = new Rng(7);
    awayEarnings(s, 3600, rng);
    expect(JSON.stringify(s)).toBe(before);
    expect(rng.next()).toBe(probe.next());
  });
  it('credits money, lifetime and the day line, and emits an event', () => {
    const s = captained();
    const m = s.money, l = s.lifetime, e = s.stats.earned;
    const { result, events } = applyAway(s, 3600, new Rng(5));
    expect(result!.earned).toBeGreaterThan(0);
    expect(s.money).toBe(m + result!.earned);
    expect(s.lifetime).toBe(l + result!.earned);
    expect(s.stats.away).toBe(result!.earned);
    expect(s.stats.earned).toBe(e);
    expect(events[0]).toMatchObject({ type: 'awayEarnings', earned: result!.earned });
  });
  it('loads with the time away worked out from the saved-at stamp', () => {
    const st = memory();
    const s = captained();
    saveGame(s, st, 1_000_000);
    const l = loadGameWithAway(st, new Rng(3), 1_000_000 + 3600_000)!;
    expect(l.away!.seconds).toBe(3600);
    expect(l.state.money).toBe(200 + l.away!.earned);
    const none = loadGameWithAway(st, new Rng(3), 1_000_000 + 30_000)!;
    expect(none.away).toBeNull();
    saveGame(s, st); // no stamp given: the old one stays; an unstamped save never counts
    const fresh = memory();
    saveGame(captained(), fresh);
    expect(loadGameWithAway(fresh, new Rng(3), 9e12)!.away).toBeNull();
  });
});
