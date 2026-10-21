// Development-only helpers: window.__debug. Loaded only in dev builds (see game.ts), never shipped.
import { BUILDING_IDS, FISH_SIZE, GOALS, HOUR_SECONDS, RANK_THRESHOLDS, SPECIES, START_HOUR } from './sim/config';
import type { BuildingId, Track, Trait, WeatherId, ZoneId } from './sim/config';
import { applyAway, awayEarnings } from './sim/away';
import { setHarbourName, renameBoat } from './sim/names';
import { acceptContract, buyBuilding, bestZone, buyBoat, currentGoal, deliverKingFish, hireDockhand, moneyPerMinute, repairBoat, step } from './sim/sim';
import type { Ev, GameState } from './sim/sim';
import { makeOffer } from './sim/contracts';
import { addCrate } from './sim/crates';
import { bookCompletion, crateStars } from './sim/fishbook';
import { grantKingFish } from './sim/ending';
import { earnReward } from './sim/ledger';
import { rollSpecial } from './sim/weather';
import { BUILDING_NAME, GOAL_TEXT, WEATHER, contractProgress, contractText, specialName } from './ui/text';
import type { Special } from './sim/state';
import type { Rng } from './sim/rng';
import type { Hud } from './ui/hud';
import type { PanelKind, Panels } from './ui/panels';
import type { CameraRig } from './view/cameraRig';
import type { Player } from './view/player';
import type { SceneRig } from './view/scene';

/** What the debug helpers may touch. */
export interface DebugHost {
  state: GameState;
  rng: Rng;
  hud: Hud;
  panels: Panels;
  player: Player;
  cameraRig: CameraRig;
  rig: SceneRig;
  dispatch(boatId: number, zone: ZoneId): void;
  handle(evs: Ev[]): void;
  frameMs(): number;
  setHoldHour(h: number | null): void;
}

export function installDebug(g: DebugHost): void {
  const dbg = {
    /** Freeze the clock at an hour (0-24); setHour(null) resumes time. */
    setHour: (h: number | null) => {
      g.setHoldHour(h);
      if (h !== null) g.state.dayTime = (((h - START_HOUR) % 24) + 24) % 24 * HOUR_SECONDS;
    },
    teleport: (x: number, z: number) => {
      g.player.pos.set(x, 0, z);
      g.cameraRig.focus.set(x, 0, z);
    },
    money: (n: number) => { g.state.money += n; },
    /** Harbour upgrade (handcart, stall1, stall2) or a boat track: upgrade('hull', 2, boatIndex) sets that track level. */
    upgrade: (id: keyof GameState['upgrades'] | Track, level = 1, boat = 0) => {
      if (id in g.state.upgrades) { g.state.upgrades[id as keyof GameState['upgrades']] = true; return; }
      const b = g.state.boats[boat];
      if (b) b[id as Track] = level;
    },
    send: (boat = 0, zone?: ZoneId) => g.dispatch(g.state.boats[boat]?.id ?? 0, zone ?? g.state.boats[boat]?.target ?? 'shallows'),
    /** Step the simulation forward (a hidden tab pauses animation frames). */
    skip: (seconds: number) => {
      const n = Math.ceil(seconds / 0.25);
      for (let i = 0; i < n; i++) g.handle(step(g.state, 0.25, g.rng));
      g.panels.refresh();
    },
    /** Jump to a rank (0-4) by setting lifetime earnings. */
    rank: (r: number) => { g.state.lifetime = Math.max(g.state.lifetime, RANK_THRESHOLDS[r] ?? 0); },
    /** Add boats (as rowboats) until there are n. */
    fleet: (n: number) => { g.state.lifetime = Math.max(g.state.lifetime, 15000); g.state.money += 20000; while (g.state.boats.length < n) buyBoat(g.state); },
    hireDockhands: (n = 1) => { g.state.lifetime = Math.max(g.state.lifetime, 500); for (let i = 0; i < n; i++) hireDockhand(g.state, g.rng); },
    captain: (boat = 0, trait: Trait = 'swift') => {
      const b = g.state.boats[boat];
      if (!b) return;
      b.captain = { id: g.state.nextId++, name: 'Debug', trait, wage: 40 };
      b.target = bestZone(b);
    },
    /** Open a window. For boat windows the second argument is the boat's place in the fleet; for 'plot' it is the building ('smokehouse') or its place in the list (0-3). */
    panel: (kind: PanelKind, which: number | BuildingId = 0) => {
      if (kind === 'plot') g.panels.open('plot', typeof which === 'string' ? Math.max(0, BUILDING_IDS.indexOf(which)) : which);
      else g.panels.open(kind, g.state.boats[which as number]?.id ?? 0);
    },
    /** Override the camera: cam(pitchDeg, distance); cam() clears. */
    cam: (pitch?: number, dist = 20) => { g.cameraRig.override = pitch === undefined ? null : { pitch, dist }; },
    popup: (text = '+$12') => g.hud.floatText(text, window.innerWidth / 2, window.innerHeight / 2),
    toast: (t: string) => g.hud.toast(t, 'good'),
    stats: () => ({ ms: +g.frameMs().toFixed(2), calls: g.rig.renderer.info.render.calls, tris: g.rig.renderer.info.render.triangles, geometries: g.rig.renderer.info.memory.geometries }),
    state: () => g.state,

    // ---- tycoon stage (rules only; the screens come later)
    /** Build or upgrade a building to a level for free: build('smokehouse', 2). Level 0 removes it. */
    build: (id: BuildingId, level = 1) => {
      const max = BUILDING_IDS.includes(id) ? (id === 'lighthouse' ? 1 : 3) : 0;
      if (!max) return;
      g.state.buildings[id] = Math.max(0, Math.min(max, level));
      g.handle([{ type: 'buildingBuilt', id, level: g.state.buildings[id] }]);
    },
    /** Buy the next level the proper way (rank and money checked). */
    buy: (id: BuildingId) => g.handle(buyBuilding(g.state, id)),
    /** Set today's weather and special day, and optionally tomorrow's: weather('storm', 'market', 'fog'). Specials: 'market', a zone name for a big catch day, or null. */
    weather: (w: WeatherId, special: 'market' | ZoneId | null = null, tomorrow?: WeatherId, tomorrowSpecial?: 'market' | ZoneId | null) => {
      const sp = (x: 'market' | ZoneId | null | undefined): Special => (x === 'market' ? { kind: 'market' } : x ? { kind: 'bigcatch', zone: x } : null);
      g.state.weather = w;
      g.state.special = sp(special);
      if (tomorrow) { g.state.nextWeather = tomorrow; g.state.nextSpecial = sp(tomorrowSpecial); }
    },
    /** Roll tomorrow's special day again. */
    rerollSpecial: () => { g.state.nextSpecial = rollSpecial(g.rng); },
    /** Finish the current goal and pay its reward. */
    completeGoal: () => {
      const st = g.state;
      const goal = GOALS[st.goal];
      if (!goal) return;
      earnReward(st, goal.reward);
      g.handle([{ type: 'goalDone', index: st.goal, id: goal.id, reward: goal.reward }]);
      st.goal += 1;
    },
    /** Put two new contract offers on the board (ignores rank and cool-down). */
    offerContract: () => {
      const c = g.state.contracts;
      c.offers = [];
      const avoid: import('./sim/config').Species[] = [];
      for (let i = 0; i < 2; i++) { const o = makeOffer(g.state, g.rng, avoid); if (o) { avoid.push(o.species); c.offers.push(o); } }
      g.handle([{ type: 'contractOffered' }]);
    },
    acceptContract: (index = 0) => { const o = g.state.contracts.offers[index]; if (o) g.handle(acceptContract(g.state, o.id)); },
    /** Put the King Fish in your hands (carry it to the inn), or deliverKing() to end the story at once. */
    kingFish: () => grantKingFish(g.state),
    deliverKing: () => { grantKingFish(g.state); g.handle(deliverKingFish(g.state)); },
    /** Break a boat as if a storm hurt it, then pay to fix it with repair(). */
    breakBoat: (boat = 0) => { const b = g.state.boats[boat]; if (b) { b.damaged = true; b.repairLeft = undefined; } },
    repair: (boat = 0) => g.handle(repairBoat(g.state, g.state.boats[boat]?.id ?? 0)),
    /** Pretend you were away for N seconds: prints what the harbour would earn. away(seconds, true) also pays it. */
    away: (seconds: number, pay = false): string => {
      const r = pay ? applyAway(g.state, seconds, g.rng) : { result: awayEarnings(g.state, seconds, g.rng), events: [] };
      if (pay) g.handle(r.events);
      const x = r.result;
      return x ? `Away ${Math.round(x.seconds)} s: earned $${x.earned} at $${x.perMinute.toFixed(1)} a minute${pay ? ' (paid)' : ' (not paid)'}` : 'Too short to count (under 60 seconds).';
    },
    /** Put a golden crate of a fish in your hands (or on the dock if your hands are full). */
    golden: (species: import('./sim/config').Species = 'tuna') => {
      const full = g.state.crates.filter((c) => c.loc === 'hand').length >= 2;
      addCrate(g.state, species, full ? 'dock' : 'hand', 0, { golden: true });
    },
    /** Set the size (cm) of the first crate you carry, or of crate number `index` in the list of all crates. */
    setSize: (cm: number, index?: number) => {
      const c = index === undefined ? g.state.crates.find((k) => k.loc === 'hand') : g.state.crates[index];
      if (c) c.size = cm;
      return c ? `${c.species}: ${cm} cm, ${crateStars(c)} stars` : 'No crate found.';
    },
    /** Rename the harbour, or a boat: rename('Seagull Bay') or rename('Spray', 0). */
    rename: (name: string, boat?: number) => {
      const evs = boat === undefined ? setHarbourName(g.state, name) : renameBoat(g.state, g.state.boats[boat]?.id ?? 0, name);
      g.handle(evs);
      return evs[0]?.type === 'denied' ? (evs[0] as { reason: string }).reason : 'ok';
    },
    /** Print the fish book as text. */
    fishBook: (): string => {
      const c = bookCompletion(g.state);
      const rows = SPECIES.map((s) => {
        const b = g.state.book[s];
        return `${s.padEnd(11)} caught ${String(b.caught).padStart(3)}  biggest ${b.biggest ? b.biggest + ' cm' : '-'} (range ${FISH_SIZE[s].join('-')})  stars ${b.bestStars}  golden ${b.golden}  best sale $${b.bestSale}`;
      });
      return `Seen ${c.seen}/${c.total}, 3-star ${c.threeStar}/${c.total}, golden ${c.golden}/${c.total}\n` + rows.join('\n');
    },
    /** A short text summary of goals, buildings, weather, contracts, and money per minute. */
    summary: (): string => {
      const st = g.state;
      const lines: string[] = [];
      const goal = currentGoal(st);
      lines.push(goal ? `Goal ${goal.index + 1}/${goal.total} [${goal.id}] ${GOAL_TEXT[goal.id]} (${goal.have}/${goal.need}, reward $${goal.reward}${goal.arrow ? `, arrow: ${goal.arrow}` : ''})` : 'All goals done.');
      lines.push('Buildings: ' + BUILDING_IDS.map((b) => `${BUILDING_NAME[b]} ${st.buildings[b] || '-'}`).join(', '));
      lines.push(`Smoke list: ${st.smokeList.join(', ') || '(none)'}; racks used ${st.crates.filter((c) => c.loc === 'smoke').length}; restaurant served ${st.restaurant.served}`);
      lines.push(`Day ${st.day}: ${WEATHER[st.weather].name} / ${specialName(st.special)}. Tomorrow: ${WEATHER[st.nextWeather].name} / ${specialName(st.nextSpecial)}.`);
      lines.push('Boats: ' + st.boats.map((b) => `${b.name}${b.damaged ? ' (broken)' : ''}${b.stayInStorms ? '' : ' (sails in storms)'}`).join(', '));
      const c = st.contracts;
      lines.push(c.active ? `Contract: ${contractText(c.active)} ${contractProgress(c.active)}` : c.offers.length ? `Offers: ${c.offers.map((o) => contractText(o)).join(' | ')}` : 'Contract: none');
      lines.push(`King Fish: ${st.king.delivered ? 'delivered' : st.king.found ? 'found' : 'not found'}. Money per minute: ${Math.round(moneyPerMinute(st))}.`);
      return lines.join('\n');
    },
  };
  (window as unknown as { __debug: typeof dbg }).__debug = dbg;
}


