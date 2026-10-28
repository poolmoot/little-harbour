import { describe, expect, it } from 'vitest';
import {
  BOAT_UPKEEP, CAPTAIN_LEVEL_TRIPS, CARRY_BIGCART, CARRY_HANDCART, CARRY_WAGON, TRACK_MAX, UPGRADES, CAPTAIN_WAGE_BY_HULL, DEMAND_RECOVER, PROJECTS, PROJECT_IDS, ROAD_SPEED_MULT,
} from './config';
import { captainLevel, captainWage, noteCaptainTrip, tripsToNextLevel } from './captains';
import { carryCapacity } from './crates';
import { buyUpgrade, canBuy } from './upgrades';
import { canUpgradeBoat, rareMult, tripTimeFor } from './fleet';
import { recoverDemand, unitPrice } from './market';
import { netProfit } from './ledger';
import { Rng } from './rng';
import { loadGame } from './save';
import { dailyUpkeep, payWages, refreshCandidates } from './staff';
import { initialState } from './state';
import type { GameState } from './state';
import { buyProject, canBuyProject, workerSpeedMult } from './town';
import { restaurantPrice } from './buildings';

const ranked = (rank: number, money = 1e7): GameState => {
  const s = initialState();
  s.lifetime = [0, 500, 3300, 18000, 72000][rank];
  s.rank = rank;
  s.money = money;
  return s;
};

describe('captain experience and pay', () => {
  it('levels come from trips finished', () => {
    expect(captainLevel({ trips: 0 })).toBe(1);
    expect(captainLevel({ trips: CAPTAIN_LEVEL_TRIPS[1] - 1 })).toBe(1);
    expect(captainLevel({ trips: CAPTAIN_LEVEL_TRIPS[1] })).toBe(2);
    expect(captainLevel({ trips: 999 })).toBe(5);
    expect(tripsToNextLevel({ trips: 3 })).toBe(CAPTAIN_LEVEL_TRIPS[1] - 3);
    expect(tripsToNextLevel({ trips: 999 })).toBeNull();
  });

  it('pay rises with the boat and the level, and Thrifty asks less', () => {
    const rookie = { trips: 0, trait: 'swift' as const };
    expect(captainWage(rookie, 0)).toBe(CAPTAIN_WAGE_BY_HULL[0]);
    expect(captainWage(rookie, 3)).toBe(CAPTAIN_WAGE_BY_HULL[3]);
    expect(captainWage({ trips: 999, trait: 'swift' }, 3)).toBe(CAPTAIN_WAGE_BY_HULL[3] * 2);
    expect(captainWage({ trips: 0, trait: 'thrifty' }, 0)).toBe(42);
  });

  it('experience brings better fish and shorter trips', () => {
    const s = initialState();
    const b = s.boats[0];
    b.captain = { id: 9, name: 'A', trait: 'careful', trips: 0 };
    const [rare, time] = [rareMult(b), tripTimeFor(b, 'shallows')];
    b.captain.trips = 999;
    expect(rareMult(b)).toBeGreaterThan(rare);
    expect(tripTimeFor(b, 'shallows')).toBeLessThan(time);
  });

  it('a finished trip counts, and a new level is announced once', () => {
    const s = initialState();
    s.boats[0].captain = { id: 9, name: 'Ansel', trait: 'swift', trips: CAPTAIN_LEVEL_TRIPS[1] - 1 };
    expect(noteCaptainTrip(s, 1)).toEqual([{ type: 'captainLevelUp', boatId: 1, name: 'Ansel', level: 2 }]);
    expect(noteCaptainTrip(s, 1)).toEqual([]);
    s.boats[0].captain.unpaid = true; // not working today: no experience
    noteCaptainTrip(s, 1);
    expect(s.boats[0].captain.trips).toBe(CAPTAIN_LEVEL_TRIPS[1] + 1);
  });

  it('experienced captains only come to the inn from rank 2', () => {
    const low = ranked(1);
    for (let i = 0; i < 30; i++) {
      refreshCandidates(low, new Rng(i));
      expect(low.candidates.every((c) => (c.trips ?? 0) === 0)).toBe(true);
    }
    const high = ranked(2);
    let veterans = 0;
    for (let i = 0; i < 30; i++) {
      refreshCandidates(high, new Rng(i));
      veterans += high.candidates.filter((c) => captainLevel(c) > 1).length;
    }
    expect(veterans).toBeGreaterThan(0);
  });
});

describe('boat care', () => {
  it('is paid at 06:00 by hull, shown in the day report, and never makes debt', () => {
    const s = initialState();
    s.boats[0].hull = 3;
    s.money = 500;
    expect(dailyUpkeep(s)).toBe(BOAT_UPKEEP[3]);
    const ev = payWages(s, s.stats);
    expect(ev[0]).toMatchObject({ type: 'wagesPaid', upkeep: BOAT_UPKEEP[3] });
    expect(s.money).toBe(500 - BOAT_UPKEEP[3]);
    expect(s.stats.upkeep).toBe(BOAT_UPKEEP[3]);
    expect(netProfit(s.stats)).toBe(-BOAT_UPKEEP[3]);
    s.money = 30;
    payWages(s, s.stats);
    expect(s.money).toBe(0);
  });

  it('a new game has no care to pay', () => {
    const s = initialState();
    expect(payWages(s, s.stats)).toEqual([]);
    expect(s.money).toBe(10);
  });
});

describe('town projects', () => {
  it('need the rank and the money, are paid once, and say so', () => {
    const s = ranked(1, 1e6);
    expect(canBuyProject(s, 'road')).toMatchObject({ ok: false, needRank: PROJECTS.road.rank });
    s.lifetime = 3300;
    s.money = PROJECTS.road.cost - 1;
    expect(canBuyProject(s, 'road').reason).toBe('Not enough money');
    s.money = PROJECTS.road.cost;
    expect(buyProject(s, 'road')).toEqual([{ type: 'projectDone', id: 'road' }]);
    expect(s.money).toBe(0);
    expect(s.stats.spent).toBe(PROJECTS.road.cost);
    s.money = 1e6;
    expect(buyProject(s, 'road')[0].type).toBe('denied');
  });

  it('costs rise down the list', () => {
    const costs = PROJECT_IDS.map((id) => PROJECTS[id].cost);
    expect(costs.every((c, i) => i === 0 || c > costs[i - 1])).toBe(true);
  });

  it('each gives its lasting bonus', () => {
    const s = ranked(4);
    s.buildings.restaurant = 1;
    const crate = { id: 1, species: 'cod' as const, freshness: 100, loc: 'hand' as const };
    const before = { price: unitPrice(s, 'cod', 100), rest: restaurantPrice(s, crate) };
    expect(workerSpeedMult(s)).toBe(1);
    for (const id of PROJECT_IDS) buyProject(s, id);
    expect(workerSpeedMult(s)).toBe(ROAD_SPEED_MULT);
    expect(unitPrice(s, 'cod', 100)).toBeCloseTo(before.price * 1.05);
    expect(restaurantPrice(s, crate)).toBeGreaterThan(before.rest * 1.25);
    s.demand.cod = 0.5;
    recoverDemand(s, 10);
    expect(s.demand.cod).toBeCloseTo(0.5 + DEMAND_RECOVER * 2);
    s.boats[0].captain = { id: 9, name: 'A', trait: 'swift', trips: 0 };
    noteCaptainTrip(s, 1);
    expect(s.boats[0].captain.trips).toBe(2);
  });
});

describe('version 8 save', () => {
  it('an older save loads with no projects, captains at level 1 and no old stored pay', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    old.version = 6;
    delete old.town;
    delete old.stats.upkeep;
    old.boats[0].captain = { id: 4, name: 'Ansel', trait: 'lucky', wage: 40 };
    old.candidates = [{ id: 5, name: 'Brigid', trait: 'swift', wage: 40 }];
    const mem = new Map<string, string>([['harbour-game-save', JSON.stringify(old)]]);
    const l = loadGame({ getItem: (k) => mem.get(k) ?? null, setItem: () => {}, removeItem: () => {} }, new Rng(1))!;
    expect(l.version).toBe(10);
    expect(PROJECT_IDS.every((id) => l.town[id] === false)).toBe(true);
    expect(l.stats.upkeep).toBe(0);
    expect(l.boats[0].captain).toEqual({ id: 4, name: 'Ansel', trait: 'lucky', trips: 0 });
    expect(l.candidates[0]).toEqual({ id: 5, name: 'Brigid', trait: 'swift', trips: 0 });
  });
});

describe('more boat upgrades', () => {
  it('the later levels need a bigger boat, then cost money as usual', () => {
    const s = initialState();
    s.money = 1e7;
    const b = s.boats[0];
    b.hold = 3;
    expect(canUpgradeBoat(s, b.id, 'hold')).toMatchObject({ ok: false, needHull: 2 });
    b.hull = 2;
    expect(canUpgradeBoat(s, b.id, 'hold').ok).toBe(true);
    expect(TRACK_MAX.hold).toBeGreaterThan(3);
    expect(TRACK_MAX.gear).toBeGreaterThan(2);
    expect(TRACK_MAX.sails).toBeGreaterThan(2);
  });
});

describe('bigger carts', () => {
  it('the Big Cart and the Horse Wagon let you and your workers carry more, in order', () => {
    const s = ranked(3);
    expect(canBuy(s, 'bigcart').ok).toBe(false); // the Handcart comes first
    buyUpgrade(s, 'handcart');
    expect(carryCapacity(s)).toBe(CARRY_HANDCART);
    expect(canBuy(s, 'wagon').ok).toBe(false); // then the Big Cart
    buyUpgrade(s, 'bigcart');
    expect(carryCapacity(s)).toBe(CARRY_BIGCART);
    buyUpgrade(s, 'wagon');
    expect(carryCapacity(s)).toBe(CARRY_WAGON);
    expect(canBuy(s, 'steamwagon')).toMatchObject({ ok: false, needRank: UPGRADES.steamwagon.rank });
    s.lifetime = 72000;
    buyUpgrade(s, 'steamwagon');
    expect(carryCapacity(s)).toBe(10);
  });

  it('need a higher rank', () => {
    const s = ranked(1);
    s.upgrades.handcart = true;
    expect(canBuy(s, 'bigcart')).toMatchObject({ ok: false, needRank: UPGRADES.bigcart.rank });
  });

  it('an older save loads without them', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    old.version = 8;
    old.upgrades = { handcart: true, stall1: false, stall2: false };
    const mem = new Map<string, string>([['harbour-game-save', JSON.stringify(old)]]);
    const l = loadGame({ getItem: (k) => mem.get(k) ?? null, setItem: () => {}, removeItem: () => {} }, new Rng(1))!;
    expect(l.upgrades).toEqual({ handcart: true, bigcart: false, wagon: false, steamwagon: false, stall1: false, stall2: false });
    expect(carryCapacity(l)).toBe(CARRY_HANDCART);
  });
});

