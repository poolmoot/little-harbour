import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS, UNLOCK_GAP, WALK_GOAL, guideDone, guideForOldSave, isGentle, noteAway, noteBoardOpened, noteWalk, stepGuide } from './guide';
import { addCrate, decayCrates } from './crates';
import { initialState } from './state';
import { dispatchBoat } from './boats';

describe('guide steps', () => {
  it('starts at the first step and finishes walking from real distance', () => {
    const s = initialState();
    expect(stepGuide(s)).toHaveLength(0);
    noteWalk(s, WALK_GOAL - 1);
    expect(s.guide.step).toBe(0);
    noteWalk(s, 2);
    const evs = stepGuide(s);
    expect(evs[0]).toMatchObject({ type: 'guideStep', index: 1 });
    expect(GUIDE_STEPS[s.guide.step].id).toBe('send');
  });
  it('sending a boat finishes walking and sending together', () => {
    const s = initialState();
    dispatchBoat(s, 1, 'shallows');
    stepGuide(s);
    expect(GUIDE_STEPS[s.guide.step].id).toBe('pier');
  });
  it('is done after the board is opened and the other steps are met', () => {
    const s = initialState();
    s.tally.dispatched = s.tally.unloaded = s.tally.sold = 1;
    s.boats[0].hold = 1;
    stepGuide(s);
    expect(guideDone(s)).toBe(false);
    noteBoardOpened(s);
    stepGuide(s);
    expect(guideDone(s)).toBe(true);
  });
});

describe('gentle start', () => {
  it('crates keep their freshness until the first sale', () => {
    const s = initialState();
    const c = addCrate(s, 'herring', 'dock');
    decayCrates(s, 100);
    expect(c.freshness).toBe(100);
    expect(isGentle(s)).toBe(true);
    s.tally.sold = 1;
    decayCrates(s, 100);
    expect(c.freshness).toBeLessThan(100);
  });
  it('old saves are never gentle', () => {
    const s = initialState();
    s.lifetime = 50;
    expect(guideForOldSave(s).gentle).toBe(false);
  });
});

describe('unlock cards', () => {
  it('wait for the first sale, come one at a time, and only once', () => {
    const s = initialState();
    s.lifetime = 5000; // rank 2
    expect(stepGuide(s).some((e) => e.type === 'guideUnlock')).toBe(false);
    s.tally.sold = 1;
    const a = stepGuide(s).filter((e) => e.type === 'guideUnlock');
    expect(a).toHaveLength(1);
    expect(stepGuide(s).filter((e) => e.type === 'guideUnlock')).toHaveLength(0);
    s.clock += UNLOCK_GAP;
    expect(stepGuide(s).filter((e) => e.type === 'guideUnlock')).toHaveLength(1);
  });
  it('the away card comes once', () => {
    const s = initialState();
    expect(noteAway(s)).toHaveLength(1);
    expect(noteAway(s)).toHaveLength(0);
  });
  it('an old save skips cards for things it already uses', () => {
    const s = initialState();
    s.lifetime = 600;
    s.dockhands.push({ id: 1, name: 'Pip', slot: 0, job: null });
    const g = guideForOldSave(s);
    expect(g.seen).toContain('workers');
    expect(g.seen).not.toContain('smokehouse');
    expect(g.step).toBe(GUIDE_STEPS.length);
  });
});
