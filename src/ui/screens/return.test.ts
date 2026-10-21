import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../audio/settings';
import { BOOK_REWARD_CAUGHT, BOOK_REWARD_STARS, FISH_SIZE, GOLDEN_MULT, SPECIES, ZONE_IDS } from '../../sim/config';
import { addCrate } from '../../sim/crates';
import { zoneFish } from '../../sim/fishbook';
import { initialState } from '../../sim/sim';
import type { GameState } from '../../sim/state';
import { logbookScreen } from './logbook';
import { marketScreen } from './market';
import { restaurantRefusal, restaurantView } from './restaurant';
import { smokehouseView } from './smokehouse';
import type { ScreenCtx } from './types';
import { slotHtml } from '../hud';
import { boatScreen } from './boat';
import { settingsScreen } from './settings';
import { titleScreen } from './title';
import { crateFacts, priceEffect } from '../fishParts';

const ctx = (state: GameState, over: Partial<ScreenCtx> = {}): ScreenCtx => ({
  state, arg: 0, tab: '', confirmReset: false, quality: 'auto', summary: null, hasSave: false, confirmNew: false, audio: { ...DEFAULT_SETTINGS }, ...over,
});
const rich = (): GameState => {
  const s = initialState();
  s.lifetime = 1_000_000;
  s.money = 1_000_000;
  s.buildings.smokehouse = 1;
  s.buildings.restaurant = 1;
  return s;
};

describe('fish book', () => {
  it('shows unseen fish as silhouettes and seen fish with all their numbers', () => {
    const s = initialState();
    s.book.herring = { caught: 7, biggest: 28.4, bestStars: 2, golden: 1, bestSale: 31 };
    const v = logbookScreen(ctx(s));
    expect(v.body).toContain('Herring');
    expect(v.body).toContain('Caught 7');
    expect(v.body).toContain('Biggest 28 cm');
    expect(v.body).toContain('Golden ones 1');
    expect(v.body).toContain('Best price $31');
    expect(v.body).toContain('???');
    expect(v.body).toContain('card gold');
  });

  it('has one section per sea with all its fish, and nothing outside the game text', () => {
    const v = logbookScreen(ctx(initialState()));
    for (const z of ZONE_IDS) for (const f of zoneFish(z)) expect(SPECIES).toContain(f);
    expect((v.body.match(/class="section/g) ?? []).length).toBe(1 + ZONE_IDS.length);
    expect((v.body.match(/class="card /g) ?? []).length).toBe(SPECIES.length);
  });

  it('shows each zone reward as still to earn with its amount, then as earned', () => {
    const s = initialState();
    let v = logbookScreen(ctx(s));
    expect(v.body).toContain(`+${BOOK_REWARD_CAUGHT.shallows}`);
    expect(v.body).toContain(`+${BOOK_REWARD_STARS.deep.toLocaleString('en')}`);
    expect(v.body).not.toContain('Earned');
    s.bookClaims.shallows.caught = true;
    v = logbookScreen(ctx(s));
    expect(v.body.match(/Earned/g)).toHaveLength(1);
    expect(v.body).not.toContain(`+${BOOK_REWARD_CAUGHT.shallows}<`);
  });

  it('shows the three completion meters', () => {
    const s = initialState();
    s.book.herring.caught = 1;
    s.book.herring.bestStars = 3;
    const v = logbookScreen(ctx(s));
    expect(v.body).toContain('Fish found: 1 of 12');
    expect(v.body).toContain('Fish with 3 stars: 1 of 12');
    expect(v.body).toContain('Golden fish found: 0 of 12');
  });
});

describe('sizes, stars and golden fish in crate windows', () => {
  it('shows size, stars and the price effect on the market row', () => {
    const s = rich();
    const c = addCrate(s, 'cod', 'hand', 0, { size: FISH_SIZE.cod[1] });
    const v = marketScreen(ctx(s));
    expect(v.body).toContain('120 cm');
    expect(v.body).toContain('20% more for its size');
    expect(crateFacts(c)).toContain('120 cm');
    const small = addCrate(s, 'cod', 'hand', 0, { size: FISH_SIZE.cod[0] });
    expect(priceEffect(small)).toContain('10% less');
  });

  it('gives a golden fish a gold row, a Golden name and a five-times line', () => {
    const s = rich();
    addCrate(s, 'tuna', 'hand', 0, { golden: true });
    const body = marketScreen(ctx(s)).body;
    expect(body).toContain('mk-row gold');
    expect(body).toContain('Golden Tuna');
    expect(body).toContain(`pays ${GOLDEN_MULT} times as much`);
    expect(body).toContain('gold-tag');
  });

  it('refuses a golden fish in the smokehouse and says why', () => {
    const s = rich();
    addCrate(s, 'cod', 'hand', 0, { golden: true });
    const body = smokehouseView(s).body;
    expect(body).toContain('too special to smoke');
    expect(body).toMatch(/class="btn[^"]*off[^"]*"[^>]*data-act="smokein"/);
  });

  it('refuses a golden fish at the restaurant and says the market pays more', () => {
    const s = rich();
    const c = addCrate(s, 'cod', 'hand', 0, { golden: true });
    expect(restaurantRefusal(s, c)).toContain('market pays much more');
    const body = restaurantView(s).body;
    expect(body).toContain('market pays much more');
    expect(body).toMatch(/class="btn[^"]*off[^"]*"[^>]*data-act="restsell"/);
  });

  it('still lets the restaurant take an ordinary big fish', () => {
    const s = rich();
    const c = addCrate(s, 'cod', 'hand', 0, { size: 118 });
    expect(restaurantRefusal(s, c)).toBeNull();
  });
});

describe('carry slots in the HUD', () => {
  it('shows stars and size in the slot and a golden look for golden fish', () => {
    const s = rich();
    const c = addCrate(s, 'tuna', 'hand', 0, { golden: true, size: 240 });
    const html = slotHtml(c);
    expect(html).toContain('slot full ol golden');
    expect(html).toContain('240 cm');
    expect(html).toContain('Golden Tuna');
    expect(html).toContain('3 stars');
    expect(slotHtml(addCrate(s, 'cod', 'hand', 0, { size: 80 }))).not.toContain('golden');
  });
});

describe('names', () => {
  it('has a rename field and Save button in the boat window', () => {
    const s = initialState();
    s.boats[0].name = 'Spray';
    const v = boatScreen(ctx(s, { arg: s.boats[0].id }));
    expect(v.body).toContain('data-field="boatname"');
    expect(v.body).toContain('value="Spray"');
    expect(v.body).toContain('data-act="renameboat"');
    expect(v.title).toBe('Spray');
  });

  it('has a harbour name field in settings', () => {
    const s = initialState();
    s.harbourName = 'Seagull Bay';
    const v = settingsScreen(ctx(s));
    expect(v.body).toContain('data-field="harbourname"');
    expect(v.body).toContain('value="Seagull Bay"');
    expect(v.body).toContain('data-act="renameharbour"');
    expect(v.body).toContain('Harbour name');
  });

  it('shows the harbour name on the title screen when there is a saved game, and keeps the saved money', () => {
    const s = initialState();
    s.harbourName = 'Seagull Bay';
    s.money = 321;
    const v = titleScreen(ctx(s, { hasSave: true }));
    expect(v.body).toContain('Seagull Bay');
    expect(v.body).toContain('$321');
  });
});
