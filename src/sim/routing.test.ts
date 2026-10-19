import { describe, expect, it } from 'vitest';
import { addCrate } from './crates';
import { buyBuilding, setSmokeList, smokeCrate, stepSmokehouse } from './buildings';
import { stepDockhands, walkPath } from './staff';
import { initialState } from './state';
import type { GameState } from './state';
import { BUILDING_IDS, LAYOUT } from './config';
import { BOXES, overlap } from './layoutBoxes';

function setup(): GameState {
  const s = initialState();
  s.lifetime = 70000;
  s.money = 100000;
  s.upgrades.icebox = true;
  s.dockhands.push({ id: 90, name: 'Pip', slot: 0, job: null });
  return s;
}
function dockCrate(s: GameState, sp: 'herring' | 'cod' | 'tuna' | 'mackerel', fresh = 100) {
  const c = addCrate(s, sp, 'dock', 0);
  c.freshness = fresh;
  return c;
}
function run(s: GameState, secs: number) {
  for (let t = 0; t < secs; t += 0.25) stepDockhands(s, 0.25);
}

describe('worker routing', () => {
  it('goes to the market when nothing else applies', () => {
    const s = setup();
    dockCrate(s, 'cod');
    stepDockhands(s, 0.1);
    expect(s.dockhands[0].job!.dest).toBe('market');
  });
  it('takes fresh fish to the restaurant first, most valuable first', () => {
    const s = setup();
    buyBuilding(s, 'restaurant');
    buyBuilding(s, 'smokehouse');
    dockCrate(s, 'herring');
    dockCrate(s, 'tuna');
    dockCrate(s, 'cod', 70); // too stale for the restaurant
    stepDockhands(s, 0.1);
    const job = s.dockhands[0].job!;
    expect(job.dest).toBe('restaurant');
    expect(s.crates.find((c) => c.id === job.crateIds[0])!.species).toBe('tuna');
    run(s, 120);
    expect(s.restaurant.served).toBeGreaterThanOrEqual(2);
  });
  it('uses the smokehouse for ticked fish when the restaurant is full or absent, and not for others', () => {
    const s = setup();
    buyBuilding(s, 'smokehouse');
    dockCrate(s, 'cod');
    stepDockhands(s, 0.1);
    expect(s.dockhands[0].job!.dest).toBe('market');
    s.dockhands[0].job = null;
    s.crates = [];
    const h = dockCrate(s, 'herring');
    run(s, 0.25);
    expect(s.dockhands[0].job!.dest).toBe('smoke');
    run(s, 60);
    expect(s.crates.find((c) => c.id === h.id)!.loc).toBe('smoke');
    setSmokeList(s, 'cod', true);
    expect(s.smokeList).toContain('cod');
  });
  it('carries finished smoked crates to the market, as timed jobs', () => {
    const s = setup();
    buyBuilding(s, 'smokehouse');
    const c = addCrate(s, 'tuna', 'hand');
    smokeCrate(s, c.id);
    stepSmokehouse(s, 100);
    const before = s.money;
    stepDockhands(s, 0.1);
    const job = s.dockhands[0].job!;
    expect(job.src).toBe('smoke');
    expect(job.dest).toBe('market');
    expect(job.len).toBeGreaterThan(10); // a real walk to the plot
    const door = LAYOUT.plots.smokehouse;
    expect(job.path[job.path.length - 1]).toEqual({ x: door.doorX, z: door.doorZ });
    run(s, 5);
    expect(s.money).toBe(before); // still walking
    run(s, 80);
    expect(s.money - before).toBe(Math.round(110 * 1.6));
    expect(s.crates.some((k) => k.id === c.id)).toBe(false);
  });
  it('storage means the cold store first, then the ice box', () => {
    const s = setup();
    s.haulPolicy = 'ice';
    buyBuilding(s, 'coldstore');
    dockCrate(s, 'cod');
    stepDockhands(s, 0.1);
    expect(s.dockhands[0].job!.dest).toBe('cold');
    run(s, 80);
    expect(s.crates[0].loc).toBe('cold');
    s.buildings.coldstore = 0;
    dockCrate(s, 'tuna');
    s.dockhands[0].job = null;
    stepDockhands(s, 0.1);
    expect(s.dockhands[0].job!.dest).toBe('ice');
  });
  it('walk paths stay on the quay and have a length', () => {
    const p = walkPath({ x: 1.2, z: 1.6 }, { x: 18.5, z: 5.9 });
    for (const pt of p) expect(pt.x).toBeGreaterThanOrEqual(LAYOUT.quayMinX);
    for (const pt of p) expect(pt.z).toBeLessThanOrEqual(LAYOUT.quayMaxZ);
    expect(p.length).toBeGreaterThanOrEqual(3);
  });
  it('plots stand inside the town and do not overlap each other or the other buildings', () => {
    const plots = BUILDING_IDS.filter((id) => id !== 'lighthouse');
    const mine = BOXES.filter((b) => (plots as string[]).includes(b.name));
    expect(mine).toHaveLength(3);
    for (const b of mine) {
      expect(b.cx - b.hx).toBeGreaterThanOrEqual(LAYOUT.quayMinX);
      expect(b.cx + b.hx).toBeLessThanOrEqual(LAYOUT.quayMaxX);
      for (const o of BOXES) if (o !== b) expect(overlap(b, o), `${b.name} overlaps ${o.name}`).toBe(false);
    }
  });
});
