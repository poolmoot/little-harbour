/**
 * Visit and play counting through PostHog (the snippet in index.html). Only a few plain event names and numbers leave the
 * game: never a harbour or boat name, never anything the player typed. If the snippet is missing or blocked, every call does nothing.
 */
import type { Ev } from './sim/sim';

export interface Tracked { name: string; props?: Record<string, string | number | boolean> }

/** Which sim events are worth counting, and what to say about each. Pure, so it can be tested. */
export function trackedFor(e: Ev): Tracked | null {
  switch (e.type) {
    case 'boatDispatched': return e.auto ? null : { name: 'boat_sent', props: { zone: e.zone } };
    case 'boatBought': return { name: 'boat_bought' };
    case 'hired': return { name: 'hired', props: { role: e.role } };
    case 'buildingBuilt': return { name: 'building_built', props: { building: e.id, level: e.level } };
    case 'rankUp': return { name: 'rank_up', props: { rank: e.rank } };
    case 'goalDone': return { name: 'goal_done', props: { goal: e.id } };
    case 'dayEnded': return { name: 'day_ended', props: { day: e.day } };
    case 'kingFishFound': return { name: 'king_fish_found' };
    case 'endingReached': return { name: 'ending_reached', props: { days: e.days, boats: e.boats } };
    default: return null;
  }
}

interface PostHogLike { capture(name: string, props?: Record<string, unknown>): void }

/** Send one event. Never throws, and does nothing in a dev build so test runs do not fill the dashboard. */
export function track(name: string, props?: Record<string, string | number | boolean>): void {
  if (import.meta.env.DEV) return;
  try {
    (window as unknown as { posthog?: PostHogLike }).posthog?.capture(name, props);
  } catch { /* counting must never break the game */ }
}

export function trackEvents(evs: Ev[]): void {
  for (const e of evs) {
    const t = trackedFor(e);
    if (t) track(t.name, t.props);
  }
}

/** What the player has chosen about counting. 'none' means the PostHog snippet is missing or blocked, so there is nothing to ask. */
export type Consent = 'pending' | 'granted' | 'denied' | 'none';

interface ConsentApi { get_explicit_consent_status?(): string; opt_in_capturing(): void; opt_out_capturing(): void }

const api = (): ConsentApi | undefined => (window as unknown as { posthog?: ConsentApi }).posthog;

export function consentStatus(): Consent {
  try {
    const s = api()?.get_explicit_consent_status?.();
    return s === 'pending' || s === 'granted' || s === 'denied' ? s : 'none';
  } catch { return 'none'; }
}

export function setConsent(yes: boolean): void {
  try { if (yes) api()?.opt_in_capturing(); else api()?.opt_out_capturing(); } catch { /* counting must never break the game */ }
}
