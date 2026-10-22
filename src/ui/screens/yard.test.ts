import { TRACK_MAX } from '../../sim/config';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../audio/settings';
import { TRACKS } from '../../sim/config';
import { initialState } from '../../sim/sim';
import type { GameState } from '../../sim/state';
import { berthScreen } from './berth';
import { boatScreen } from './boat';
import { crewScreen } from './crew';
import { shipyardScreen } from './shipyard';
import type { ScreenCtx } from './types';

const ctx = (state: GameState, over: Partial<ScreenCtx> = {}): ScreenCtx => ({
  state, arg: 0, tab: '', confirmReset: false, quality: 'auto', summary: null, hasSave: false, confirmNew: false, audio: { ...DEFAULT_SETTINGS }, ...over,
});
const rich = (): GameState => {
  const s = initialState();
  s.lifetime = 1_000_000;
  s.money = 1_000_000;
  return s;
};
const addBoat = (s: GameState): void => {
  const b = { ...s.boats[0], id: 100 + s.boats.length, berth: s.boats.length, name: `Extra ${s.boats.length}` };
  s.boats.push(b);
};

describe('shipyard page', () => {
  it('is one page with no tabs and three clear sections', () => {
    const v = shipyardScreen(ctx(rich()));
    expect(v.tabs).toBeUndefined();
    expect(v.body).toContain('Your boats (1 of 4)');
    expect(v.body).toContain('Buy a new boat');
    expect(v.body).toContain('Harbour upgrades');
  });

  it('shows a big Open button for every boat', () => {
    const s = rich();
    addBoat(s);
    const v = shipyardScreen(ctx(s));
    expect(v.body.match(/data-act="openboat"/g)).toHaveLength(4);
    expect(v.body).toContain('Open Extra 1');
  });

  it('shows each harbour upgrade with its price and a Buy button in view', () => {
    const v = shipyardScreen(ctx(rich()));
    expect(v.body.match(/data-act="buy"/g)).toHaveLength(3);
    expect(v.body).toContain('Buy — ');
  });

  it('explains a locked boat or upgrade: rank, price and what is missing', () => {
    const s = initialState();
    s.money = 50;
    const v = shipyardScreen(ctx(s));
    expect(v.body).toContain('Needs rank: Boat Owner (you are Beginner)');
    expect(v.body).toContain('class="lock rank"');
    expect(v.body).toContain('700');
  });

  it('says how much money is missing once the rank is high enough', () => {
    const s = initialState();
    s.lifetime = 1_000_000;
    s.money = 100;
    const v = shipyardScreen(ctx(s));
    expect(v.body).toContain('You need $600 more');
  });

  it('says all spots are used when there are four boats', () => {
    const s = rich();
    addBoat(s); addBoat(s); addBoat(s);
    const v = shipyardScreen(ctx(s));
    expect(v.body).toContain('You have all four boats');
    expect(v.body).not.toContain('data-act="buyboat"');
  });
});

describe('boat window upgrades', () => {
  it('shows the price on every upgrade button, the level and what comes next', () => {
    const s = rich();
    const html = boatScreen(ctx(s, { arg: s.boats[0].id })).body;
    expect(html.match(/data-act="up"/g)).toHaveLength(TRACKS.length);
    expect(html).toContain('Upgrade — ');
    expect(html).toContain('0 of 3 upgrades');
    expect(html).toContain('Next:');
    expect(html).toContain('class="dots"');
  });

  it('shows a Maxed state and no button action when fully upgraded', () => {
    const s = rich();
    s.boats[0].hold = TRACK_MAX.hold;
    const html = boatScreen(ctx(s, { arg: s.boats[0].id })).body;
    expect(html).toContain('Maxed');
    expect(html).toContain('Fully upgraded');
  });

  it('explains a locked upgrade', () => {
    const s = initialState();
    s.money = 5;
    const html = boatScreen(ctx(s, { arg: s.boats[0].id })).body;
    expect(html).toContain('You need $');
    expect(html).toContain('Needs rank: Boat Owner (you are Beginner)');
  });

  it('explains a locked fishing place', () => {
    const s = initialState();
    const html = boatScreen(ctx(s, { arg: s.boats[0].id, tab: 'grounds' })).body;
    expect(html).toContain('class="lock other"');
    expect(html).toContain('Needs a bigger boat');
  });
});

describe('hire window locks', () => {
  it('explains why captains and workers are locked', () => {
    const s = initialState();
    const html = crewScreen(ctx(s)).body;
    expect(html).toContain('Needs rank:');
    expect(html).toContain('class="lock');
  });
});

describe('boat spot window', () => {
  it('shows the boat you would get, its price and a big Buy button', () => {
    const s = rich();
    const v = berthScreen(ctx(s, { arg: 1 }));
    expect(v.title).toBe('Boat spot 2');
    expect(v.body).toContain('New rowboat');
    expect(v.body).toContain('700');
    expect(v.foot).toContain('data-act="buyboat"');
    expect(v.foot).toContain('hero');
  });

  it('explains the lock and greys the button when it cannot be bought', () => {
    const v = berthScreen(ctx(initialState(), { arg: 1 }));
    expect(v.body).toContain('Needs rank: Boat Owner (you are Beginner)');
    expect(v.foot).toMatch(/off"[^>]*data-act="buyboat"|data-act="buyboat"[^>]*>/);
    expect(v.foot).toContain('Locked');
    expect(v.foot).not.toContain('hero');
  });

  it('offers to open the boat when one is already tied up there', () => {
    const s = rich();
    const v = berthScreen(ctx(s, { arg: s.boats[0].berth }));
    expect(v.foot).toContain('data-act="openboat"');
  });
});

describe('captains are easy to find', () => {
  it('shows a Get a captain card with candidates and Hire buttons on the first page of the boat window', () => {
    const s = rich();
    s.candidates = [{ id: 7, name: 'Ansel', trait: 'swift' }] as GameState['candidates'];
    const v = boatScreen(ctx(s, { arg: s.boats[0].id }));
    expect(v.tabs?.map((t) => t.id)).toEqual(['upgrades', 'grounds']);
    expect(v.body).toContain('Get a captain');
    expect(v.body).toContain('Ansel');
    expect(v.body).toContain('$60 a day');
    expect(v.body).toContain('data-act="hirecap"');
  });

  it('explains the lock when captains are not open yet', () => {
    const v = (() => { const s = initialState(); return boatScreen(ctx(s, { arg: s.boats[0].id })); })();
    expect(v.body).toContain('Get a captain');
    expect(v.body).toContain('Needs rank: Boat Owner (you are Beginner)');
  });

  it('shows the captain, the place they fish and End job when hired', () => {
    const s = rich();
    s.boats[0].captain = { id: 7, name: 'Ansel', trait: 'swift', unpaid: false } as never;
    const body = boatScreen(ctx(s, { arg: s.boats[0].id })).body;
    expect(body).toContain('Your captain');
    expect(body).toContain('Fishes:');
    expect(body).toContain('data-act="firecap"');
    expect(body).toContain('Change place');
  });

  it('tells the shipyard cards whether a boat sails by itself, with a button to get a captain', () => {
    const s = rich();
    const body = shipyardScreen(ctx(s)).body;
    expect(body).toContain('You send it');
    expect(body).toContain('Get a captain');
    s.boats[0].captain = { id: 7, name: 'Ansel', trait: 'swift', unpaid: false } as never;
    const b2 = shipyardScreen(ctx(s)).body;
    expect(b2).toContain('Sails by itself');
    expect(b2).not.toContain('Get a captain');
  });
});
