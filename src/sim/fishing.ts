import { FISH_HOOK_WINDOW, FISH_WAIT_MAX, FISH_WAIT_MIN } from './config';
import { rollPier } from './catch';
import { recordCaught } from './boats';
import { rollFish } from './fishbook';
import { addCrate, carryCapacity, handCrates } from './crates';
import type { Rng } from './rng';
import type { Ev, GameState } from './state';

export function castLine(state: GameState, rng: Rng): Ev[] {
  if (state.fishing.phase !== 'idle') return [{ type: 'denied', reason: 'Already fishing.' }];
  if (handCrates(state).length >= carryCapacity(state)) return [{ type: 'denied', reason: 'Your hands are full.' }];
  state.fishing = { phase: 'waiting', timer: rng.range(FISH_WAIT_MIN, FISH_WAIT_MAX) };
  return [{ type: 'castStarted' }];
}

export function cancelCast(state: GameState): Ev[] {
  if (state.fishing.phase === 'idle') return [];
  state.fishing = { phase: 'idle', timer: 0 };
  return [{ type: 'fishLost', reason: 'cancelled' }];
}

export function hook(state: GameState, rng: Rng): Ev[] {
  const f = state.fishing;
  if (f.phase === 'idle') return [];
  if (f.phase === 'waiting') {
    state.fishing = { phase: 'idle', timer: 0 };
    return [{ type: 'fishLost', reason: 'early' }];
  }
  state.fishing = { phase: 'idle', timer: 0 };
  if (handCrates(state).length >= carryCapacity(state)) return [{ type: 'fishLost', reason: 'full' }];
  const species = rollPier(rng);
  const fish = rollFish(species, rng);
  addCrate(state, species, 'hand', 0, fish);
  recordCaught(state, species, fish.size, fish.golden);
  state.tally.pier += 1;
  const evs: Ev[] = [{ type: 'fishLanded', species }];
  if (fish.golden) evs.push({ type: 'goldenCaught', species });
  return evs;
}

export function stepFishing(state: GameState, dt: number): Ev[] {
  const f = state.fishing;
  if (f.phase === 'idle') return [];
  f.timer -= dt;
  if (f.timer > 0) return [];
  if (f.phase === 'waiting') {
    state.fishing = { phase: 'bite', timer: FISH_HOOK_WINDOW };
    return [{ type: 'biteStarted' }];
  }
  state.fishing = { phase: 'idle', timer: 0 };
  return [{ type: 'fishLost', reason: 'late' }];
}
