import { describe, expect, it } from 'vitest';
import { EventRouter, weatherSound } from './events';
import type { EventDeps } from './events';
import { BUILDING_IDS, LAYOUT } from './sim/config';
import { addCrate } from './sim/crates';
import { initialState } from './sim/sim';
import type { Ev } from './sim/sim';
import { STATIONS, findTarget, interact, promptFor } from './interaction';
import { Rng } from './sim/rng';

function setup() {
  const calls: string[] = [];
  const toasts: string[] = [];
  const state = initialState();
  const fx = new Proxy({}, { get: (_t, name: string) => () => { calls.push(`fx.${name}`); } });
  const audio = {
    fx, onMuteChange: null,
    setRain: (v: number) => calls.push(`rain ${v}`),
    setStormWind: (v: number) => calls.push(`wind ${v}`),
    setFog: (v: number) => calls.push(`fog ${v}`),
    setTownState: (v: unknown) => calls.push(`town ${JSON.stringify(v)}`),
    noteSale: (n: number) => calls.push(`sale ${n}`),
    dawn: () => {}, dayReport: () => {},
  };
  const hud = {
    toast: (t: string) => toasts.push(t),
    banner: (t: string) => toasts.push(`banner ${t}`),
    goalDone: (r: number) => calls.push(`goalDone ${r}`),
  };
  const opened: string[] = [];
  const deps = {
    audio, hud, getState: () => state, popAt: () => {}, saveNow: () => calls.push('save'),
    showSummary: () => {}, openPanel: (k: string) => opened.push(k),
  } as unknown as EventDeps;
  return { router: new EventRouter(deps), calls, toasts, opened, state };
}

describe('return-feature events', () => {
  it('toasts the size and stars of a landed fish, and a golden one gets its own toast', () => {
    const t = setup();
    addCrate(t.state, 'cod', 'hand', 0, { size: 115 });
    t.router.handle([{ type: 'fishLanded', species: 'cod' }]);
    expect(t.toasts).toEqual(['You caught a Cod! 115 cm, 3 stars.']);
    const g = setup();
    addCrate(g.state, 'tuna', 'hand', 0, { golden: true });
    g.router.handle([{ type: 'fishLanded', species: 'tuna' }, { type: 'goldenCaught', species: 'tuna' }]);
    expect(g.toasts.filter((x) => x.startsWith('banner'))).toHaveLength(1);
    expect(g.toasts.some((x) => x.includes('golden Tuna'))).toBe(true);
    expect(g.toasts.some((x) => x.startsWith('You caught'))).toBe(false);
    expect(g.calls).toContain('fx.goalComplete');
  });

  it('plays a sound, toasts and saves for away money, book rewards and renames', () => {
    const t = setup();
    t.router.handle([
      { type: 'awayEarnings', seconds: 3600, earned: 250, perMinute: 8 },
      { type: 'bookReward', zone: 'reef', kind: 'stars', amount: 300 },
      { type: 'harbourRenamed', name: 'Seagull Bay' },
      { type: 'boatRenamed', boatId: 0, name: 'Spray' },
    ]);
    expect(t.toasts).toEqual([
      'Your harbour earned $250 while you were away.',
      '3 stars on every fish in Coral Reef! Reward +$300',
      'Your harbour is now called Seagull Bay.',
      'The boat is now called Spray.',
    ]);
    expect(t.calls).toContain('fx.coins');
    expect(t.calls).toContain('save');
  });
});

describe('weather sound', () => {
  it('turns on rain and wind for storms and fog for fog, and nothing for calm', () => {
    expect(weatherSound('storm')).toEqual({ rain: 1, wind: 1, fog: 0 });
    expect(weatherSound('fog')).toEqual({ rain: 0, wind: 0, fog: 1 });
    expect(weatherSound('calm')).toEqual({ rain: 0, wind: 0, fog: 0 });
    expect(weatherSound('wind').wind).toBeGreaterThan(0);
  });

  it('sets the layers when the weather changes and on load', () => {
    const t = setup();
    t.router.syncWeather('storm');
    expect(t.calls.slice(0, 3)).toEqual(['rain 1', 'wind 1', 'fog 0']);
    const t2 = setup();
    t2.router.handle([{ type: 'weatherChanged', weather: 'fog', special: null, tomorrowWeather: 'calm', tomorrowSpecial: null }]);
    expect(t2.calls).toContain('fog 1');
    expect(t2.calls).not.toContain('fx.stormWarning');
  });

  it('plays the storm warning when tomorrow is a storm, and the market day sound on market day', () => {
    const t = setup();
    t.router.handle([{ type: 'weatherChanged', weather: 'calm', special: { kind: 'market' }, tomorrowWeather: 'storm', tomorrowSpecial: null }]);
    expect(t.calls).toContain('fx.stormWarning');
    expect(t.calls).toContain('fx.marketDay');
    expect(t.toasts.some((x) => x.includes('storm'))).toBe(true);
  });
});

describe('town sounds', () => {
  it('cheers for a big catch, a golden fish and the King Fish, but not a small catch', () => {
    const t = setup();
    t.router.handle([{ type: 'boatReturned', boatId: 0, count: 2 }]);
    expect(t.calls).not.toContain('fx.cheer');
    t.router.handle([{ type: 'boatReturned', boatId: 0, count: 6, auto: true }]);
    expect(t.calls.filter((c) => c === 'fx.cheer')).toHaveLength(1);
    t.router.handle([{ type: 'goldenCaught', species: 'tuna' }, { type: 'kingFishFound', boatId: 0 }]);
    expect(t.calls.filter((c) => c === 'fx.cheer')).toHaveLength(3);
  });

  it('tells the audio about sales, rank and market day', () => {
    const t = setup();
    t.state.rank = 2;
    t.router.handle([{ type: 'rankUp', rank: 2 }, { type: 'crateSold', price: 5 } as unknown as Ev]);
    expect(t.calls).toContain('sale 1');
    expect(t.calls.some((c) => c.startsWith('town') && c.includes('"rank":2'))).toBe(true);
    const m = setup();
    m.state.special = { kind: 'market' } as typeof m.state.special;
    m.router.syncWeather('calm');
    expect(m.calls.some((c) => c.includes('"marketDay":true'))).toBe(true);
  });
});

describe('tycoon events', () => {
  const cases: [Ev, string][] = [
    [{ type: 'goalDone', index: 0, id: 'send', reward: 10 }, 'fx.goalComplete'],
    [{ type: 'buildingBuilt', id: 'smokehouse', level: 1 }, 'fx.buildingBuilt'],
    [{ type: 'buildingBuilt', id: 'smokehouse', level: 2 }, 'fx.buildingUpgraded'],
    [{ type: 'boatDamaged', boatId: 1 }, 'fx.boatDamaged'],
    [{ type: 'contractAccepted', contractId: 1 }, 'fx.contractAccepted'],
    [{ type: 'contractDone', contractId: 1, reward: 50 }, 'fx.contractDone'],
    [{ type: 'contractFailed', contractId: 1 }, 'fx.contractMissed'],
    [{ type: 'kingFishFound', boatId: 1 }, 'fx.kingFishCaught'],
    [{ type: 'endingReached', days: 9, earned: 1, fishCaught: 1, boats: 1 }, 'fx.ending'],
  ];
  for (const [ev, sound] of cases) {
    it(`${ev.type} plays ${sound} and shows a toast or window`, () => {
      const t = setup();
      t.router.handle([ev]);
      expect(t.calls).toContain(sound);
      expect(t.toasts.length + t.opened.length).toBeGreaterThan(0);
    });
  }

  it('shows the goal flourish and the reward, and opens the ending window', () => {
    const t = setup();
    t.router.handle([{ type: 'goalDone', index: 0, id: 'send', reward: 10 }]);
    expect(t.calls).toContain('goalDone 10');
    expect(t.toasts).toContain('Goal done! Reward +$10');
    const t2 = setup();
    t2.router.handle([{ type: 'endingReached', days: 9, earned: 1, fishCaught: 1, boats: 1 }]);
    expect(t2.opened).toEqual(['ending']);
  });

  it('gives toasts for smoking, restaurant, repairs and offers', () => {
    const t = setup();
    t.router.now = 10;
    t.router.handle([
      { type: 'crateSmoking', crateId: 1 }, { type: 'crateSmoked', crateId: 1 },
      { type: 'restaurantServed', species: 'cod', price: 100, staff: false },
      { type: 'boatRepairStarted', boatId: 1, cost: 35 }, { type: 'boatRepaired', boatId: 1 },
      { type: 'contractOffered' },
    ]);
    expect(t.toasts).toHaveLength(6);
  });

  it('does not repeat smoke toasts every few frames', () => {
    const t = setup();
    t.router.now = 10;
    t.router.handle([{ type: 'crateSmoking', crateId: 1 }]);
    t.router.now = 11;
    t.router.handle([{ type: 'crateSmoking', crateId: 2 }]);
    expect(t.toasts).toHaveLength(1);
  });
});

describe('plots and the King Fish at the inn', () => {
  it('finds a plot when standing at its door, and opens its window', () => {
    const s = initialState();
    BUILDING_IDS.forEach((id, i) => {
      const p = LAYOUT.plots[id];
      const target = findTarget(s, { x: p.doorX, z: p.doorZ });
      expect(target?.kind).toBe('plot');
      expect(target?.id).toBe(i);
      expect(interact(target, s, new Rng())).toEqual({ open: 'plot', arg: i });
    });
  });

  it('prompts to build on an empty plot and to open a built one', () => {
    const s = initialState();
    const p = LAYOUT.plots.smokehouse;
    const t = findTarget(s, { x: p.doorX, z: p.doorZ });
    expect(promptFor(s, t)?.text).toBe('Smokehouse: build here');
    s.buildings.smokehouse = 1;
    expect(promptFor(s, t)?.text).toBe('Smokehouse: open');
  });

  it('opens the boat spot window at an empty spot on the pier, and not where a boat is tied up', () => {
    const s = initialState();
    const b1 = LAYOUT.berths[1];
    const t = findTarget(s, { x: b1.edgeX, z: b1.edgeZ });
    expect(t?.kind).toBe('berth');
    expect(promptFor(s, t)?.text).toBeTruthy();
    const i = interact(t, s, new Rng(1));
    expect(i).toEqual({ open: 'berth', arg: 1 });
    const b0 = LAYOUT.berths[0];
    expect(findTarget(s, { x: b0.edgeX, z: b0.edgeZ })?.kind).toBe('boat');
  });

  it('delivers the King Fish at the inn instead of opening the hire window', () => {
    const s = initialState();
    const inn = { x: STATIONS.inn.x, z: STATIONS.inn.z };
    const t = findTarget(s, inn);
    expect(interact(t, s, new Rng())).toEqual({ open: 'hire' });
    const king = addCrate(s, 'sturgeon', 'hand');
    king.king = true;
    expect(promptFor(s, t)?.text).toBe('Show the King Fish to everyone');
    const r = interact(t, s, new Rng());
    expect(r && 'evs' in r ? r.evs.map((e) => e.type) : []).toEqual(['endingReached']);
  });
});
