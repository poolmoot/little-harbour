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
