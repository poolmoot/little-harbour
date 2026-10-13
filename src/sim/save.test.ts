import { describe, expect, it } from 'vitest';
import { dispatchBoat } from './boats';
import { addCrate } from './crates';
import { Rng } from './rng';
import { loadGame, saveGame, clearSave } from './save';
import type { StorageLike } from './save';
import { initialState } from './state';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('save', () => {
  it('round-trips state and keeps crate freshness exactly', () => {
    const st = memory();
    const s = initialState();
    s.money = 321;
    s.upgrades.icebox = true;
    const c = addCrate(s, 'snapper', 'ice');
    c.freshness = 61.5;
    saveGame(s, st);
    const l = loadGame(st, new Rng(1))!;
    expect(l.money).toBe(321);
    expect(l.upgrades.icebox).toBe(true);
    expect(l.crates[0].freshness).toBe(61.5);
  });
  it('puts boats that were out back at the berth with the catch ready', () => {
    const st = memory();
    const s = initialState();
    dispatchBoat(s, 1, 'shallows');
    saveGame(s, st);
    const l = loadGame(st, new Rng(1))!;
    expect(l.boats[0].status).toBe('returned');
    expect(l.boats[0].catch).toHaveLength(4);
  });
  it('returns null for missing, corrupt or future saves, and clears', () => {
    const st = memory();
    expect(loadGame(st, new Rng(1))).toBeNull();
    st.setItem('harbour-game-save', '{nope');
    expect(loadGame(st, new Rng(1))).toBeNull();
    st.setItem('harbour-game-save', JSON.stringify({ version: 999 }));
    expect(loadGame(st, new Rng(1))).toBeNull();
    saveGame(initialState(), st);
    clearSave(st);
    expect(loadGame(st, new Rng(1))).toBeNull();
  });
  it('fills defaults for fields missing in an older save', () => {
    const st = memory();
    st.setItem('harbour-game-save', JSON.stringify({ version: 1, money: 5 }));
    const l = loadGame(st, new Rng(1))!;
    expect(l.money).toBe(5);
    expect(l.demand.herring).toBe(1);
    expect(l.boats).toHaveLength(1);
  });
});

describe('migration from the MVP save', () => {
  it('moves global Hold/Hull levels onto every boat and keeps money, boats and logbook', () => {
    const st = memory();
    const old = {
      version: 1, money: 777, day: 4, dayTime: 100, clock: 900, nextId: 20,
      upgrades: { icebox: true, handcart: false, hold1: true, hold2: true, hull: true, boat2: true },
      boats: [
        { id: 1, berth: 0, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [] },
        { id: 2, berth: 1, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [] },
      ],
      crates: [{ id: 5, species: 'snapper', freshness: 50, loc: 'ice' }],
      demand: { herring: 0.8 },
      book: { herring: { caught: 12, bestSale: 9 }, lobster: { caught: 1, bestSale: 88 } },
      stats: { earned: 40, sold: 3, spoiled: 0, filled: 0, missed: 0 },
    };
    st.setItem('harbour-game-save', JSON.stringify(old));
    const l = loadGame(st, new Rng(1))!;
    expect(l.version).toBe(3);
    expect(l.money).toBe(777);
    expect(l.boats).toHaveLength(2);
    for (const b of l.boats) {
      expect(b.hold).toBe(2);
      expect(b.hull).toBe(1);
      expect(b.gear).toBe(0);
      expect(b.captain).toBeNull();
    }
    expect(l.upgrades.icebox).toBe(true);
    expect((l.upgrades as Record<string, boolean>).hold1).toBeUndefined();
    expect(l.book.herring.caught).toBe(12);
    expect(l.book.lobster.bestSale).toBe(88);
    expect(l.book.cod.caught).toBe(0);
    expect(l.crates[0].freshness).toBe(50);
    expect(l.demand.tuna).toBe(1);
    expect(l.stats.income.herring).toBe(0);
    expect(l.lifetime).toBeGreaterThanOrEqual(777);
    expect(l.dockhands).toEqual([]);
  });
  it('round-trips staff and returns hauled crates to the dock', () => {
    const st = memory();
    const s = initialState();
    s.dockhands = [{ id: 9, name: 'Pip', slot: 0, job: { phase: 'haul', path: [{ x: 0, z: 0 }], len: 1, d: 0, crateIds: [1], dest: 'market' } }];
    const c = addCrate(s, 'cod', 'hand');
    c.loc = 'haul';
    c.carrier = 9;
    s.boats[0].captain = { id: 4, name: 'Ansel', trait: 'lucky', wage: 40 };
    saveGame(s, st);
    const l = loadGame(st, new Rng(1))!;
    expect(l.boats[0].captain?.trait).toBe('lucky');
    expect(l.dockhands[0].job).toBeNull();
    expect(l.crates[0].loc).toBe('dock');
    expect(l.crates[0].carrier).toBeUndefined();
  });
});
