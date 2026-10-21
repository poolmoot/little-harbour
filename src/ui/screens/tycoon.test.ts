import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../audio/settings';
import { BUILDING_IDS, HOUR_SECONDS, REPAIR_SECONDS } from '../../sim/config';
import { addCrate } from '../../sim/crates';
import { grantKingFish } from '../../sim/ending';
import { initialState } from '../../sim/sim';
import type { GameState } from '../../sim/state';
import { boatScreen } from './boat';
import { coldstoreView } from './coldstore';
import { crewScreen } from './crew';
import { endingScreen } from './ending';
import { forecast, ledgerScreen } from './ledger';
import { lighthouseView, kingLine } from './lighthouse';
import { noticesScreen } from './notices';
import { plotScreen } from './plot';
import { restaurantRefusal, restaurantView } from './restaurant';
import { shipyardScreen } from './shipyard';
import { smokehouseView } from './smokehouse';
import type { ScreenCtx } from './types';

const ctx = (state: GameState, over: Partial<ScreenCtx> = {}): ScreenCtx => ({
  state, arg: 0, tab: '', confirmReset: false, quality: 'auto', summary: null, hasSave: false, confirmNew: false, audio: { ...DEFAULT_SETTINGS }, ...over,
});
const acts = (html: string) => [...html.matchAll(/data-act="([a-z]+)"/g)].map((m) => m[1]);
const rich = (): GameState => {
  const s = initialState();
  s.lifetime = 1_000_000;
  s.money = 1_000_000;
  return s;
};
const plot = (s: GameState, id: (typeof BUILDING_IDS)[number]) => plotScreen(ctx(s, { arg: BUILDING_IDS.indexOf(id) }));

describe('plot windows', () => {
  it('shows an empty plot as for sale, with the price, the rank and a Build button', () => {
    const v = plot(rich(), 'smokehouse');
    expect(v.title).toBe('For sale: Smokehouse');
    expect(v.body).toContain('$900');
    expect(v.body).toContain('Boat Owner');
    expect(v.foot).toContain('data-act="build"');
    expect(v.foot).toContain('data-a="smokehouse"');
    expect(v.foot).not.toContain('off');
  });

  it('greys the Build button and names the rank when the rank is too low, and says when money is short', () => {
    const poor = initialState();
    poor.money = 5000;
    const v = plot(poor, 'restaurant');
    expect(v.foot).toContain('off');
    expect(v.body).toContain('Needs rank: Small Company (you are Beginner)');
    const broke = rich();
    broke.money = 10;
    expect(plot(broke, 'coldstore').body).toMatch(/You need \$[\d,]+ more/);
  });

  it('opens the right window for a built building, and lists later levels on the for-sale window', () => {
    const s = rich();
    s.buildings.coldstore = 1;
    expect(plot(s, 'coldstore').title).toBe('Cold store');
    expect(plot(rich(), 'coldstore').body).toContain('Level 3');
  });
});

describe('cold store', () => {
  it('offers Put in for carried fish and Take out for stored fish, and Upgrade', () => {
    const s = rich();
    s.buildings.coldstore = 1;
    const a = addCrate(s, 'cod', 'hand');
    addCrate(s, 'tuna', 'cold');
    const html = coldstoreView(s).body;
    expect(acts(html)).toEqual(expect.arrayContaining(['coldin', 'coldout', 'build']));
    expect(html).toContain(`data-a="${a.id}"`);
    expect(html).toContain('1 of 12 crates');
  });

  it('shows Full and greys Put in when the store is full; leaves smoked fish out of the list', () => {
    const s = rich();
    s.buildings.coldstore = 1;
    for (let i = 0; i < 12; i++) addCrate(s, 'cod', 'cold');
    addCrate(s, 'cod', 'hand');
    const smoked = addCrate(s, 'cod', 'hand');
    smoked.smoked = true;
    const html = coldstoreView(s).body;
    expect(html).toContain('Full');
    expect(html.match(/data-act="coldin"/g)).toHaveLength(1);
  });
});

describe('smokehouse', () => {
  it('shows free racks, a rack with time left, and a ready crate to take', () => {
    const s = rich();
    s.buildings.smokehouse = 1;
    const c = addCrate(s, 'herring', 'smoke');
    c.smokeLeft = 20;
    const r = addCrate(s, 'cod', 'smoke');
    r.smoked = true;
    r.smokeLeft = 0;
    s.buildings.smokehouse = 2; // 4 racks
    const html = smokehouseView(s).body;
    expect(html).toContain('Smoking… 20s left');
    expect(html).toContain('Ready!');
    expect(html).toContain('data-act="smokeout"');
    expect(html.match(/Free rack/g)).toHaveLength(2);
  });

  it('lets the player smoke a carried crate, but not when all racks are full', () => {
    const s = rich();
    s.buildings.smokehouse = 1;
    const hand = addCrate(s, 'mackerel', 'hand');
    expect(smokehouseView(s).body).toContain(`data-act="smokein" data-a="${hand.id}"`);
    addCrate(s, 'cod', 'smoke');
    addCrate(s, 'cod', 'smoke');
    const full = smokehouseView(s).body;
    expect(full).toContain('All racks are full.');
    expect(full).toMatch(/btn ol info sm off" data-act="smokein"/);
  });
});

describe('restaurant', () => {
  it('names the reason a crate is refused', () => {
    const s = rich();
    s.buildings.restaurant = 1;
    const fresh = addCrate(s, 'cod', 'hand');
    const old = addCrate(s, 'cod', 'hand');
    old.freshness = 50;
    const smoked = addCrate(s, 'cod', 'hand');
    smoked.smoked = true;
    expect(restaurantRefusal(s, fresh)).toBeNull();
    expect(restaurantRefusal(s, old)).toContain('80%');
    expect(restaurantRefusal(s, smoked)).toContain('smoked');
    s.restaurant.served = 6;
    expect(restaurantRefusal(s, fresh)).toContain('all it wants today');
  });

  it('shows the price, the crates left today, the fish it has had and the bonus', () => {
    const s = rich();
    s.buildings.restaurant = 1;
    addCrate(s, 'cod', 'hand');
    s.restaurant = { served: 2, kinds: ['cod', 'tuna'] };
    const html = restaurantView(s).body;
    expect(html).toContain('It will buy 4 more crates today.');
    expect(html).toContain('Cod');
    expect(html).toContain('Tuna');
    expect(html).toContain('Bonus: 20% more');
    expect(html).toContain('Pays $');
    expect(html).toContain('data-act="restsell"');
  });
});

describe('lighthouse', () => {
  it('says what it does and where the King Fish stands', () => {
    const s = rich();
    s.buildings.lighthouse = 1;
    const v = lighthouseView(s);
    expect(v.note).toContain('night');
    expect(v.body).toContain('King Fish');
    expect(kingLine(s)).toContain('Deep Sea');
    grantKingFish(s);
    expect(kingLine(s)).toContain('inn');
    s.king.delivered = true;
    expect(kingLine(s)).toContain('wall');
  });
});

describe('notice board', () => {
  it('keeps orders on the first tab and adds a Contracts tab', () => {
    const v = noticesScreen(ctx(rich()));
    expect(v.tabs?.map((t) => t.id)).toEqual(['orders', 'contracts']);
    expect(v.tab).toBe('orders');
  });

  it('shows the order pay accurately', () => {
    expect(noticesScreen(ctx(rich())).note).toBe('Each crate for an order sells for double the price. Finish the whole order and you get 50% extra on top.');
  });

  it('shows two offers with Accept buttons', () => {
    const s = rich();
    s.contracts.offers = [
      { id: 7, species: 'cod', smoked: false, qty: 8, filled: 0, days: 2, deadline: 0, reward: 900, baseValue: 600 },
      { id: 8, species: 'tuna', smoked: true, qty: 5, filled: 0, days: 3, deadline: 0, reward: 1200, baseValue: 800 },
    ];
    const html = noticesScreen(ctx(s, { tab: 'contracts' })).body;
    expect(html.match(/data-act="accept"/g)).toHaveLength(2);
    expect(html).toContain('data-a="7"');
    expect(html).toContain('Tuna (smoked)');
  });

  it('shows the active contract with progress and time left, with no Accept buttons', () => {
    const s = rich();
    s.clock = 100;
    s.contracts.active = { id: 7, species: 'cod', smoked: false, qty: 8, filled: 3, days: 2, deadline: 100 + HOUR_SECONDS * 12, reward: 900, baseValue: 600 };
    const html = noticesScreen(ctx(s, { tab: 'contracts' })).body;
    expect(html).toContain('3 of 8 sold');
    expect(html).toContain('Less than a day left');
    expect(html).not.toContain('data-act="accept"');
  });

  it('says to come back tomorrow when there are no offers, and that contracts are locked at rank 0', () => {
    expect(noticesScreen(ctx(rich(), { tab: 'contracts' })).body).toContain('Come back tomorrow');
    expect(noticesScreen(ctx(initialState(), { tab: 'contracts' })).body).toContain('Boat Owner');
  });
});

describe('workers', () => {
  const crewRoster = (s: GameState) => crewScreen(ctx(s, { tab: 'crew' })).body;

  it('shows no smoke list or storage choice before the buildings exist', () => {
    const body = crewRoster(rich());
    expect(body).not.toContain('Smoke these');
    expect(body).not.toContain('Spare crates go to');
  });

  it('shows the Smoke these ticks only for fish the player has caught, with the current choice ticked', () => {
    const s = rich();
    s.buildings.smokehouse = 1;
    s.book.herring.caught = 3;
    s.book.cod.caught = 1;
    s.smokeList = ['herring'];
    const body = crewRoster(s);
    expect(body).toContain('Smoke these');
    expect(body).toContain('Herring');
    expect(body).toContain('Cod');
    expect(body).not.toContain('Tuna');
    expect(body).toContain('data-act="smokelist" data-a="herring" data-b="0"'); // ticked: pressing it turns it off
    expect(body).toContain('data-act="smokelist" data-a="cod" data-b="1"');
  });

  it('shows the storage choice once a cold store or ice box exists', () => {
    const s = rich();
    s.buildings.coldstore = 1;
    expect(crewRoster(s)).toContain('Spare crates go to');
    expect(acts(crewRoster(s))).toContain('policy');
  });
});

describe('boats and the shipyard', () => {
  it('has a Stay home in storms tick on the fishing grounds tab', () => {
    const s = rich();
    const html = boatScreen(ctx(s, { arg: s.boats[0].id, tab: 'grounds' })).body;
    expect(html).toContain('Stay home in storms');
    expect(html).toContain('data-act="stayhome"');
    expect(html).toContain('aria-checked="true"');
  });

  it('shows a broken boat clearly and stops it being sent', () => {
    const s = rich();
    s.boats[0].damaged = true;
    const v = boatScreen(ctx(s, { arg: s.boats[0].id }));
    expect(v.note).toContain('Broken');
    expect(v.foot).toContain('off');
    expect(v.foot).not.toContain('data-act="send"');
  });

  it('shows the countdown while it is being fixed', () => {
    const s = rich();
    s.boats[0].damaged = true;
    s.boats[0].repairLeft = 30;
    expect(boatScreen(ctx(s, { arg: s.boats[0].id })).note).toContain('Being fixed · 30s left');
    const yard = shipyardScreen(ctx(s, { tab: 'fleet' })).body;
    expect(yard).toContain('Being fixed · 30s left');
    expect(yard).not.toContain('data-act="repair"');
  });

  it('offers a Fix button with cost and time in the shipyard', () => {
    const s = rich();
    s.boats[0].damaged = true;
    const v = shipyardScreen(ctx(s, { tab: 'fleet' }));
    expect(v.body).toContain('data-act="repair"');
    expect(v.body).toContain('Cost $35');
    expect(v.body).toContain(`Takes ${REPAIR_SECONDS} seconds`);
    expect(v.tabs).toBeUndefined();
  });

  it('greys the Fix button when the boat is still out or the money is short', () => {
    const s = rich();
    s.boats[0].damaged = true;
    s.money = 1;
    expect(shipyardScreen(ctx(s, { tab: 'fleet' })).body).toMatch(/off" data-act="repair"/);
  });
});

describe('day report', () => {
  it('shows tomorrow and the goal-rewards line', () => {
    const s = rich();
    s.nextWeather = 'storm';
    s.nextSpecial = { kind: 'market' };
    const stats = { ...s.stats, rewards: 150 };
    const v = ledgerScreen(ctx(s, { summary: { day: 3, stats } }));
    expect(v.body).toContain('Tomorrow');
    expect(v.body).toContain('Storm');
    expect(v.body).toContain('Market day');
    expect(v.body).toContain('Goal rewards');
    expect(v.body).toContain('+$150');
    expect(forecast(s)).toContain('A storm is coming');
  });

  it('leaves out the rewards line when there were none', () => {
    const s = rich();
    expect(ledgerScreen(ctx(s, { summary: { day: 3, stats: s.stats } })).body).not.toContain('Goal rewards');
  });
});

describe('ending screen', () => {
  it('shows the summary and a Keep playing button', () => {
    const s = rich();
    s.day = 14;
    s.boats.push({ ...s.boats[0], id: 99 });
    s.book.cod.caught = 12;
    const v = endingScreen(ctx(s));
    expect(v.title).toBe('The King Fish!');
    expect(v.body).toContain('Days played');
    expect(v.body).toContain('14');
    expect(v.body).toContain('Boats owned');
    expect(v.body).toContain('12');
    expect(v.foot).toContain('Keep playing');
    expect(v.foot).toContain('data-act="close"');
  });
});

describe('day report: money earned while away', () => {
  const summary = (away: number) => ({ day: 3, stats: { ...initialState().stats, away } });
  it('shows a line only when there was some', () => {
    const s = initialState();
    expect(ledgerScreen(ctx(s, { summary: summary(0) })).body).not.toContain('While you were away');
    const v = ledgerScreen(ctx(s, { summary: summary(480) }));
    expect(v.body).toContain('While you were away');
    expect(v.body).toContain('+$480');
  });
});
