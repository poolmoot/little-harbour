import { describe, expect, it } from 'vitest';
import { hintFor } from './coach';

describe('guide button rings', () => {
  it('rings Send out in the boat window and Sell in the market window', () => {
    expect(hintFor('send', 'boat')?.press).toContain('send');
    expect(hintFor('send', null)).toBeNull();
    expect(hintFor('sell', 'market')?.press).toContain('sell');
  });
  it('guides the crate space upgrade through the shipyard and boat windows', () => {
    expect(hintFor('space', null)).toBeNull();
    expect(hintFor('space', 'shipyard')?.press).toContain('openboat');
    expect(hintFor('space', 'boat')?.press).toContain('hold');
  });
  it('has no ring for steps without a window button', () => {
    expect(hintFor('walk', null)).toBeNull();
    expect(hintFor('board', 'board')).toBeNull();
  });
  it('never rings a purchase the player cannot afford', () => {
    const poor = { why: 'cost', how: 'pier', target: 'pierEnd', need: { have: 5, cost: 110 } } as const;
    expect(hintFor('space', 'boat', poor)).toBeNull();
    expect(hintFor('send', 'boat', poor)).toBeNull();
  });
});
