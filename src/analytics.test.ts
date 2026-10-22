import { describe, expect, it } from 'vitest';
import { trackedFor } from './analytics';

describe('analytics', () => {
  it('counts the big moments with plain numbers only', () => {
    expect(trackedFor({ type: 'rankUp', rank: 2 })).toEqual({ name: 'rank_up', props: { rank: 2 } });
    expect(trackedFor({ type: 'boatBought', boatId: 3 })).toEqual({ name: 'boat_bought' });
    expect(trackedFor({ type: 'hired', role: 'captain', name: 'Ada' })).toEqual({ name: 'hired', props: { role: 'captain' } });
  });

  it('skips boats sent by captains and everything else', () => {
    expect(trackedFor({ type: 'boatDispatched', boatId: 1, zone: 'shallows', cost: 5, auto: true } as never)).toBeNull();
    expect(trackedFor({ type: 'workersSleep' })).toBeNull();
  });

  it('never passes a typed name along', () => {
    const t = trackedFor({ type: 'hired', role: 'dockhand', name: 'Secret Name' });
    expect(JSON.stringify(t)).not.toContain('Secret');
  });
});
