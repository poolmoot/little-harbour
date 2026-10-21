import { BUILDINGS, CONTRACT_RANK } from './config';
import type { BuildingId } from './config';
import { CAPTAINS_RANK, DOCKHANDS_RANK, rankOf } from './rank';
import type { Ev, GameState } from './state';

/**
 * The starting guide. It is a small layer on top of the real game state: every step is finished by something the player
 * actually did (the same counters the goal chain reads), never by a timer. It does not replace the goal chain: the goals keep
 * running and paying out underneath, and the HUD simply shows the guide card in place of the goal panel while a step is open.
 */

/** Where a step or card points. The drawing code turns these into positions using LAYOUT and the interaction points. */
export type GuideTarget = 'boat' | 'pierEnd' | 'market' | 'shipyard' | 'board' | 'inn' | 'crate' | BuildingId;

export type StepId = 'walk' | 'send' | 'pier' | 'unload' | 'carry' | 'sell' | 'space' | 'board';

export const GUIDE_STEPS: readonly { id: StepId; target: GuideTarget }[] = [
  { id: 'walk', target: 'boat' },
  { id: 'send', target: 'boat' },
  { id: 'pier', target: 'pierEnd' },
  { id: 'unload', target: 'boat' },
  { id: 'carry', target: 'crate' },
  { id: 'sell', target: 'market' },
  { id: 'space', target: 'shipyard' },
  { id: 'board', target: 'board' },
];

/** Metres the player must walk to finish the first step. */
export const WALK_GOAL = 6;
/** Game seconds between two unlock cards, so an older save with many new things does not get a pile of cards at once. */
export const UNLOCK_GAP = 45;
/** Fish caught before the fish book card comes up. */
export const BOOK_CARD_FISH = 3;

export type UnlockId = 'workers' | 'captains' | 'coldstore' | 'smokehouse' | 'restaurant' | 'lighthouse' | 'contracts' | 'weather' | 'book' | 'away';

interface UnlockDef { id: UnlockId; target?: GuideTarget; ready?(s: GameState): boolean }

export const UNLOCKS: readonly UnlockDef[] = [
  { id: 'workers', target: 'inn', ready: (s) => rankOf(s) >= DOCKHANDS_RANK },
  { id: 'captains', target: 'inn', ready: (s) => rankOf(s) >= CAPTAINS_RANK },
  { id: 'coldstore', target: 'coldstore', ready: (s) => rankOf(s) >= BUILDINGS.coldstore.rank },
  { id: 'smokehouse', target: 'smokehouse', ready: (s) => rankOf(s) >= BUILDINGS.smokehouse.rank },
  { id: 'restaurant', target: 'restaurant', ready: (s) => rankOf(s) >= BUILDINGS.restaurant.rank },
  { id: 'lighthouse', target: 'lighthouse', ready: (s) => rankOf(s) >= BUILDINGS.lighthouse.rank },
  { id: 'contracts', target: 'board', ready: (s) => rankOf(s) >= CONTRACT_RANK },
  { id: 'weather', ready: (s) => s.weather !== 'calm' || s.nextWeather !== 'calm' },
  { id: 'book', ready: (s) => Object.values(s.book).reduce((n, b) => n + b.caught, 0) >= BOOK_CARD_FISH },
  { id: 'away' }, // only by noteAway
];

export interface GuideState {
  step: number; // index into GUIDE_STEPS; GUIDE_STEPS.length when the opening is finished
  walked: number; // metres walked so far (stops counting once the first step is done)
  boardSeen: boolean; // the notice board has been opened
  welcomed: boolean; // the harbour master's welcome has been shown
  gentle: boolean; // fish keep their freshness until the first sale
  seen: string[]; // unlock cards already shown
  nextCardAt: number; // clock seconds: no unlock card before this
}

export const newGuide = (): GuideState => ({ step: 0, walked: 0, boardSeen: false, welcomed: false, gentle: true, seen: [], nextCardAt: 0 });

export const guideDone = (s: GameState): boolean => s.guide.step >= GUIDE_STEPS.length;

/** True while crates do not lose freshness: a new game, until the first sale. */
export const isGentle = (s: GameState): boolean => s.guide.gentle && s.tally.sold === 0;

/** Index of a step id. */
export const stepIndex = (id: StepId): number => GUIDE_STEPS.findIndex((x) => x.id === id);

/**
 * The step to show now. Usually the saved step, but before the first sale a fish in the player's hands (from the pier or a
 * crate) jumps straight to "Sell your fish", so nobody stands holding a fish waiting for the boat. After that sale the guide
 * carries on from the saved step (unloading the boat, and so on).
 */
export function shownStep(s: GameState): number {
  const sell = stepIndex('sell');
  if (s.guide.step < sell && s.tally.sold === 0 && s.crates.some((c) => c.loc === 'hand' && !c.king)) return sell;
  return s.guide.step;
}

function stepDone(s: GameState, id: StepId): boolean {
  const t = s.tally;
  switch (id) {
    case 'walk': return s.guide.walked >= WALK_GOAL || t.dispatched >= 1;
    case 'send': return t.dispatched >= 1;
    case 'pier': return t.pier >= 1 || t.unloaded >= 1 || s.boats.some((b) => b.status === 'returned');
    case 'unload': return t.unloaded >= 1;
    case 'carry': return t.sold >= 1 || s.crates.some((c) => c.loc === 'hand');
    case 'sell': return t.sold >= 1;
    case 'space': return s.boats.some((b) => b.hold >= 1);
    case 'board': return s.guide.boardSeen || t.orders >= 1;
  }
}

/** Count metres walked, for the first step. */
export function noteWalk(s: GameState, metres: number): void {
  if (s.guide.step === 0 && metres > 0) s.guide.walked += metres;
}

/** The notice board window was opened. */
export function noteBoardOpened(s: GameState): void {
  s.guide.boardSeen = true;
}

/** The welcome has been shown. */
export function noteWelcomed(s: GameState): void {
  s.guide.welcomed = true;
}

function unlockEvent(s: GameState, id: UnlockId): Ev[] {
  if (s.guide.seen.includes(id)) return [];
  s.guide.seen.push(id);
  s.guide.nextCardAt = s.clock + UNLOCK_GAP;
  return [{ type: 'guideUnlock', id }];
}

/** Earnings while away were paid: the one card about that. */
export function noteAway(s: GameState): Ev[] {
  return unlockEvent(s, 'away');
}

/** Move to the next step when the current one is finished, and bring up at most one unlock card. Called every step. */
export function stepGuide(s: GameState): Ev[] {
  const evs: Ev[] = [];
  const g = s.guide;
  while (g.step < GUIDE_STEPS.length && stepDone(s, GUIDE_STEPS[g.step].id)) {
    g.step += 1;
    evs.push({ type: 'guideStep', index: g.step, done: g.step >= GUIDE_STEPS.length });
  }
  // Unlock cards wait until the first sale is made, so they never crowd the opening.
  if (s.tally.sold >= 1 && s.clock >= g.nextCardAt) {
    for (const u of UNLOCKS) {
      if (u.ready && !g.seen.includes(u.id) && u.ready(s)) {
        evs.push(...unlockEvent(s, u.id));
        break;
      }
    }
  }
  return evs;
}

/** For a save from before the guide: the opening counts as done when the player has already sold or earned something; cards for things they already use are marked seen. */
export function guideForOldSave(s: GameState): GuideState {
  const g = newGuide();
  const past = s.tally.sold >= 1 || s.lifetime > 0;
  if (!past) return g;
  g.step = GUIDE_STEPS.length;
  g.walked = WALK_GOAL;
  g.boardSeen = true;
  g.welcomed = true;
  g.gentle = false;
  const used: Partial<Record<UnlockId, boolean>> = {
    workers: s.dockhands.length > 0,
    captains: s.boats.some((b) => b.captain),
    coldstore: s.buildings.coldstore > 0,
    smokehouse: s.buildings.smokehouse > 0,
    restaurant: s.buildings.restaurant > 0,
    lighthouse: s.buildings.lighthouse > 0,
    contracts: s.tally.contracts > 0 || !!s.contracts.active,
    weather: s.tally.storm > 0,
  };
  g.seen = (Object.keys(used) as UnlockId[]).filter((k) => used[k]);
  return g;
}
