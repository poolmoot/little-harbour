// Earnings while the player is away: boats with captains keep fishing and workers keep carrying.
// The sim never reads the clock; the caller passes the seconds away.
import { AWAY_MAX_SECONDS, AWAY_MIN_SECONDS, AWAY_SHARE, AWAY_SIM_SECONDS } from './config';
import { earnAway } from './ledger';
import { stepRank } from './rank';
import type { Rng } from './rng';
import type { Ev, GameState } from './state';
import { step } from './sim';

export interface AwayResult {
  seconds: number; // time away, capped
  earned: number; // money credited
  perMinute: number; // measured net money per minute
}

const net = (st: { earned: number; wages: number; tripCosts: number }): number => st.earned - st.wages - st.tripCosts;

/** Net money per real second the harbour makes with nobody playing, measured on a copy over one in-game day. */
export function measureAwayRate(state: GameState, rng: Rng): number {
  if (!state.boats.some((b) => b.captain)) return 0;
  const sim: GameState = structuredClone(state);
  const r = rng.clone();
  // Start from a clean quay so one-off stock does not inflate the figure.
  sim.crates = sim.crates.filter((c) => c.loc === 'smoke');
  for (const b of sim.boats) b.catch = [];
  sim.fishing = { phase: 'idle', timer: 0 };
  for (const d of sim.dockhands) d.job = null;
  const base = net(sim.stats);
  let total = 0;
  const dt = 0.25;
  const n = Math.round(AWAY_SIM_SECONDS / dt);
  for (let i = 0; i < n; i++) {
    for (const e of step(sim, dt, r)) if (e.type === 'dayEnded') total += net(e.stats);
  }
  total += net(sim.stats) - base;
  return Math.max(0, total) / AWAY_SIM_SECONDS;
}

/** What the harbour earned while the player was gone, or null when the absence is too short to count. Changes nothing. */
export function awayEarnings(state: GameState, secondsAway: number, rng: Rng): AwayResult | null {
  if (!(secondsAway >= AWAY_MIN_SECONDS)) return null;
  const seconds = Math.min(secondsAway, AWAY_MAX_SECONDS);
  const rate = measureAwayRate(state, rng);
  return { seconds, earned: Math.floor(rate * seconds * AWAY_SHARE), perMinute: rate * 60 };
}

/** Work out and credit the earnings. Only money, lifetime earnings and the day's away line change. */
export function applyAway(state: GameState, secondsAway: number, rng: Rng): { result: AwayResult | null; events: Ev[] } {
  const result = awayEarnings(state, secondsAway, rng);
  if (!result || result.earned <= 0) return { result, events: [] };
  earnAway(state, result.earned);
  return { result, events: [{ type: 'awayEarnings', seconds: result.seconds, earned: result.earned, perMinute: result.perMinute }, ...stepRank(state)] };
}
