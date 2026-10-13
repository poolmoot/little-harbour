import { SPECIES } from './config';
import { removeCrate } from './crates';
import type { Ev, GameState } from './state';

export interface EndingSummary { days: number; earned: number; fishCaught: number; boats: number }

export function endingSummary(state: GameState): EndingSummary {
  return {
    days: state.day,
    earned: Math.floor(state.lifetime),
    fishCaught: SPECIES.reduce((a, sp) => a + state.book[sp].caught, 0),
    boats: state.boats.length,
  };
}

/** Carry the King Fish to the inn. The story ends once; the game keeps going and the fish hangs on the wall. */
export function deliverKingFish(state: GameState): Ev[] {
  const c = state.crates.find((k) => k.king && k.loc === 'hand');
  if (!c) return [{ type: 'denied', reason: 'You are not carrying the King Fish.' }];
  removeCrate(state, c.id);
  state.king.delivered = true;
  return [{ type: 'endingReached', ...endingSummary(state) }];
}

/** Debug and test helper: put the King Fish in the player's hands. */
export function grantKingFish(state: GameState): void {
  state.king.found = true;
  state.king.day = state.day;
  state.crates = state.crates.filter((k) => !k.king);
  const id = state.nextId++;
  state.crates.push({ id, species: 'sturgeon', freshness: 100, loc: 'hand', king: true });
}
