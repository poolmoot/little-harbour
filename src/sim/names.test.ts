import { describe, expect, it } from 'vitest';
import { checkName, renameBoat, setHarbourName } from './names';
import { initialState } from './state';
import { loadGame, saveGame } from './save';
import { Rng } from './rng';

describe('names', () => {
  it('starts as Little Harbour', () => expect(initialState().harbourName).toBe('Little Harbour'));
  it('trims and accepts simple names', () => {
    expect(checkName('  Seagull Bay ')).toEqual({ ok: true, name: 'Seagull Bay' });
    expect(checkName("Mum's Boat 2!").ok).toBe(true);
    expect(checkName('Ærø Øl').ok).toBe(true);
  });
  it('rejects empty, too long and odd characters', () => {
    expect(checkName('   ').problem).toBe('empty');
    expect(checkName('A'.repeat(17)).problem).toBe('long');
    expect(checkName('A'.repeat(16)).ok).toBe(true);
    expect(checkName('<b>hi</b>').problem).toBe('chars');
    expect(checkName('a_b').problem).toBe('chars');
  });
  it('renames the harbour and boats, and leaves names alone when invalid', () => {
    const s = initialState();
    expect(setHarbourName(s, ' Bay ')[0]).toEqual({ type: 'harbourRenamed', name: 'Bay' });
    expect(s.harbourName).toBe('Bay');
    expect(setHarbourName(s, '')[0].type).toBe('denied');
    expect(s.harbourName).toBe('Bay');
    expect(renameBoat(s, 1, 'Spray')[0]).toEqual({ type: 'boatRenamed', boatId: 1, name: 'Spray' });
    expect(s.boats[0].name).toBe('Spray');
    expect(renameBoat(s, 1, '@@')[0].type).toBe('denied');
    expect(renameBoat(s, 99, 'Spray')[0].type).toBe('denied');
    expect(s.boats[0].name).toBe('Spray');
  });
  it('survives a save and defaults for old saves', () => {
    const d = new Map<string, string>();
    const st = { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k) };
    const s = initialState();
    setHarbourName(s, 'Seagull Bay');
    renameBoat(s, 1, 'Spray');
    saveGame(s, st);
    const l = loadGame(st, new Rng(1))!;
    expect(l.harbourName).toBe('Seagull Bay');
    expect(l.boats[0].name).toBe('Spray');
    d.set('harbour-game-save', JSON.stringify({ version: 4, harbourName: 5 }));
    expect(loadGame(st, new Rng(1))!.harbourName).toBe('Little Harbour');
  });
});
