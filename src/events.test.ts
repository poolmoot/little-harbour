import { describe, expect, it } from 'vitest';
import { EventRouter, weatherSound } from './events';
import type { EventDeps } from './events';
import { BUILDING_IDS, LAYOUT } from './sim/config';
import { addCrate } from './sim/crates';
import { initialState } from './sim/sim';
import type { Ev } from './sim/sim';
import { findTarget, interact, promptFor } from './interaction';
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
    expect(t.calls).toEqual(['rain 1', 'wind 1', 'fog 0']);
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

describe('tycoon events', () => {
  const cases: [Ev, string][] = [
    [{ type: 'goalDone', index: 0, id: 'send', reward: 10 }, 'fx.goalComplete'],
    [{ type: 'buildingBuilt', id: 'coldstore', level: 1 }, 'fx.buildingBuilt'],
    [{ type: 'buildingBuilt', id: 'coldstore', level: 2 }, 'fx.buildingUpgraded'],
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
    const p = LAYOUT.plots.coldstore;
    const t = findTarget(s, { x: p.doorX, z: p.doorZ });
    expect(promptFor(s, t)?.text).toBe('Cold store: build here');
    s.buildings.coldstore = 1;
    expect(promptFor(s, t)?.text).toBe('Cold store: open');
  });

  it('delivers the King Fish at the inn instead of opening the hire window', () => {
    const s = initialState();
    const inn = { x: LAYOUT.inn.x + 0.8, z: LAYOUT.inn.z + 3.6 };
    const t = findTarget(s, inn);
    expect(interact(t, s, new Rng())).toEqual({ open: 'hire' });
    const king = addCrate(s, 'sturgeon', 'hand');
    king.king = true;
    expect(promptFor(s, t)?.text).toBe('Show the King Fish to everyone');
    const r = interact(t, s, new Rng());
    expect(r && 'evs' in r ? r.evs.map((e) => e.type) : []).toEqual(['endingReached']);
  });
});
