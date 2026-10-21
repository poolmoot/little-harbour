import { describe, expect, it } from 'vitest';
import { dispatchBoat } from './boats';
import { addCrate } from './crates';
import { Rng } from './rng';
import { SAVE_KEY, loadGame, saveGame, clearSave } from './save';
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
    expect(l.version).toBe(7);
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
    s.boats[0].captain = { id: 4, name: 'Ansel', trait: 'lucky' };
    saveGame(s, st);
    const l = loadGame(st, new Rng(1))!;
    expect(l.boats[0].captain?.trait).toBe('lucky');
    expect(l.dockhands[0].job).toBeNull();
    expect(l.crates[0].loc).toBe('dock');
    expect(l.crates[0].carrier).toBeUndefined();
  });
});

describe('migration from version 3 (before the tycoon stage)', () => {
  const v3 = () => ({
    version: 3, money: 4321, day: 12, dayTime: 200, clock: 4000, nextId: 80, lifetime: 9000, rank: 2,
    upgrades: { icebox: true, handcart: true, stall1: true, stall2: false },
    boats: [
      { id: 1, name: 'Gull', berth: 0, hull: 2, hold: 2, gear: 1, sails: 1, target: 'opensea', captain: { id: 5, name: 'Ansel', trait: 'swift' }, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [] },
      { id: 2, name: 'Wren', berth: 1, hull: 1, hold: 1, gear: 0, sails: 0, target: 'reef', captain: null, status: 'docked', zone: null, progress: 0, tripTime: 0, catch: [] },
    ],
    dockhands: [{ id: 7, name: 'Pip', slot: 0, job: null }],
    crates: [{ id: 9, species: 'cod', freshness: 55, loc: 'ice' }],
    book: { herring: { caught: 30, bestSale: 9 }, seabass: { caught: 4, bestSale: 40 }, tuna: { caught: 2, bestSale: 150 } },
    stats: { earned: 100, sold: 10, spoiled: 1, filled: 1, missed: 0, income: {}, bonus: 0, wages: 0, tripCosts: 5, spent: 0, best: { species: null, price: 0 } },
  });

  it('loads with money, boats, staff, rank and fish book intact, and the new parts at their starting values', () => {
    const st = memory();
    st.setItem('harbour-game-save', JSON.stringify(v3()));
    const l = loadGame(st, new Rng(1))!;
    expect(l.version).toBe(7);
    expect(l.money).toBe(4321);
    expect(l.day).toBe(12);
    expect(l.lifetime).toBe(9000);
    expect(l.rank).toBe(2);
    expect(l.boats.map((b) => [b.name, b.hull, b.hold, b.gear, b.sails])).toEqual([['Gull', 2, 2, 1, 1], ['Wren', 1, 1, 0, 0]]);
    expect(l.boats[0].captain!.name).toBe('Ansel');
    expect(l.boats.every((b) => b.stayInStorms)).toBe(true);
    expect(l.dockhands).toHaveLength(1);
    expect(l.book.seabass.caught).toBe(4);
    expect(l.crates[0].freshness).toBe(55);
    expect(l.upgrades).toEqual({ icebox: true, handcart: true, stall1: true, stall2: false });
    expect(l.buildings).toEqual({ coldstore: 0, smokehouse: 0, restaurant: 0, lighthouse: 0 });
    expect(l.weather).toBe('calm');
    expect(l.smokeList).toEqual(['herring', 'mackerel']);
    expect(l.contracts).toEqual({ offers: [], active: null, coolUntil: 0 });
    expect(l.king.found).toBe(false);
  });
  it('skips goals the player has clearly already met, without paying for them', () => {
    const st = memory();
    st.setItem('harbour-game-save', JSON.stringify(v3()));
    const l = loadGame(st, new Rng(1))!;
    expect(l.money).toBe(4321);
    expect(l.goal).toBeGreaterThanOrEqual(10);
    // The next unmet goal is a building one: the player has built nothing yet.
    const s2 = loadGame(st, new Rng(1))!;
    expect(s2.goal).toBe(l.goal);
  });
  it('round-trips a version 4 save with buildings and a contract', () => {
    const st = memory();
    const s = initialState();
    s.buildings.smokehouse = 2;
    s.smokeList = ['cod'];
    s.weather = 'fog';
    s.special = { kind: 'bigcatch', zone: 'reef' };
    s.goal = 7;
    s.tally.sold = 55;
    s.contracts.active = { id: 3, species: 'cod', smoked: true, qty: 9, filled: 2, days: 3, deadline: 1000, reward: 900, baseValue: 360 };
    s.king.found = true;
    saveGame(s, st);
    const l = loadGame(st, new Rng(1))!;
    expect(l.buildings.smokehouse).toBe(2);
    expect(l.smokeList).toEqual(['cod']);
    expect(l.weather).toBe('fog');
    expect(l.special).toEqual({ kind: 'bigcatch', zone: 'reef' });
    expect(l.goal).toBe(7);
    expect(l.tally.sold).toBe(55);
    expect(l.contracts.active!.filled).toBe(2);
    expect(l.king.found).toBe(true);
  });
});

describe('migration to version 6 (starting guide)', () => {
  it('an older save already past the opening loads with the guide done', () => {
    const old = { ...initialState(), version: 5, lifetime: 900 } as Record<string, unknown>;
    delete old.guide;
    const store = new Map<string, string>();
    store.set(SAVE_KEY, JSON.stringify(old));
    const s = loadGame({ getItem: (k) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} }, new Rng(1))!;
    expect(s.version).toBe(7);
    expect(s.guide.step).toBeGreaterThanOrEqual(8);
    expect(s.guide.welcomed).toBe(true);
    expect(s.guide.gentle).toBe(false);
  });
});
