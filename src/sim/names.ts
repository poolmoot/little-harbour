// Names: the harbour and each boat.
import { NAME_MAX, NAME_MIN, NAME_PATTERN } from './config';
import type { Ev, GameState } from './state';

export interface NameCheck { ok: boolean; name?: string; problem?: 'empty' | 'long' | 'chars' }

/** Trim and check a name: 1 to 16 characters, letters, digits, spaces and simple marks (' . , ! & -). */
export function checkName(raw: string): NameCheck {
  const name = String(raw ?? '').trim();
  if (name.length < NAME_MIN) return { ok: false, problem: 'empty' };
  if ([...name].length > NAME_MAX) return { ok: false, problem: 'long' };
  if (!NAME_PATTERN.test(name)) return { ok: false, problem: 'chars' };
  return { ok: true, name };
}

const REASON = { empty: 'Please type a name.', long: 'That name is too long.', chars: 'That name has letters that are not allowed.' };

export function setHarbourName(state: GameState, raw: string): Ev[] {
  const c = checkName(raw);
  if (!c.ok) return [{ type: 'denied', reason: REASON[c.problem!] }];
  state.harbourName = c.name!;
  return [{ type: 'harbourRenamed', name: c.name! }];
}

export function renameBoat(state: GameState, boatId: number, raw: string): Ev[] {
  const b = state.boats.find((x) => x.id === boatId);
  if (!b) return [{ type: 'denied', reason: 'No such boat.' }];
  const c = checkName(raw);
  if (!c.ok) return [{ type: 'denied', reason: REASON[c.problem!] }];
  b.name = c.name!;
  return [{ type: 'boatRenamed', boatId, name: c.name! }];
}
