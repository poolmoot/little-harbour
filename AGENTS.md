# Little Harbour — guide for AI coding agents

Read this first. It is written so that any agent (Claude Code, Cursor,
Codex, or another) can pick the project up cold and keep building it.
`CLAUDE.md` just points here, so this file is the single place to update.

## What this is

A cosy harbour business game that runs in a desktop browser. The player owns
a small fishing harbour: boats go out and catch fish, crates are carried to
the market before they spoil, and profit is spent on better boats, more
boats, captains and workers. The player walks around the harbour with an
angled, looking-down camera.

Stack: Three.js, Vite, TypeScript (strict), Vitest. One dependency (`three`).
No backend. Progress saves to the browser's `localStorage`.

## The owner

- Not a programmer. Explain things in plain words, say what changed and how
  to try it, and do not assume they will read code.
- Watches AI usage costs closely. Batch changes, avoid needless screenshots
  and re-reading, and prefer cheap checks (type check, unit tests, the
  scripted player) over manual playtesting.
- Wants the game to look and move very well, stay light and smooth, and the
  code to stay healthy.
- Wants all in-game text in simple, everyday English. No sailing jargon.

## Run, test, build

```bash
npm install
npm run dev      # game at http://localhost:5173 (see .claude/launch.json)
npm test         # unit tests, including the pacing test
npm run build    # type check, then production build into dist/
npm run check    # type check + tests, the quick pre-commit check
npm run tune     # scripted player on several seeds: prints minutes to each rank (scripts/tune.mjs)
```

Tests and the build must pass before any commit.

## How the code is organised

The most important rule: **game rules and drawing are separate.**

- `src/sim/` — the rules. Pure TypeScript. It must never import Three.js or
  touch the DOM. Everything here is unit tested. All tunable numbers and
  tables live in `src/sim/config.ts`. All randomness goes through the seeded
  generator in `src/sim/rng.ts`. Actions (send a boat, sell, buy, hire)
  return events; they are the only way state changes.
- `src/view/` — Three.js drawing. Reads state and reacts to events. Never
  changes game state directly.
- `src/ui/` — the HTML HUD and panels drawn over the canvas. **All names and
  repeated wording live in `src/ui/text.ts`** (fish, zones, ranks, boat sizes,
  upgrade tracks, traits, townspeople lines, toasts, prompts). Edit wording
  there. The sim keeps only ids, numbers and person/boat names, and gives short
  plain "why not" reasons (plus a `needRank` number) that the UI words.
- `src/audio.ts` — sounds made with Web Audio. No audio files.
- `src/game.ts` — owns the state, steps the sim each frame, and wires view, UI
  and audio together. Event routing is in `src/events.ts`, targeting and the
  E-key action in `src/interaction.ts`, and the dev-only `__debug` hook in
  `src/debug.ts`.
- `src/main.ts` — start-up and the frame loop.

See "Code map" at the bottom for a file-by-file list.

## Rules that keep the project healthy

0. Sending a boat costs money (trip cost by zone, in `config.ts`); a new game
   starts with 10 money and pier fishing is free, so the player cannot get
   stuck. Captained boats pay automatically and wait if they cannot.
1. New rules go in `src/sim/` with a unit test first. New numbers go in
   `config.ts`, not inline.
2. No downloaded art or sound. Every model is built from Three.js shapes in
   code, textures are drawn on a canvas, shaders are hand-written. This
   keeps the project small and licence-free. Ask the owner before changing
   this.
3. Keep it light: reuse geometry and materials, use instancing for repeated
   things, no allocation inside per-frame loops, and do the water and wind
   movement in shaders rather than JavaScript. Picture quality has three levels
   (High, Medium, Low; `src/view/quality.ts`): pixel ratio cap, shadow size or
   off, anti-aliasing samples, bloom. Auto mode starts on High and steps down
   (never up) when frames average over 22 ms for 3 seconds. The setting
   (Auto/High/Medium/Low) is in the fish book panel and saved in `localStorage`
   under its own key, apart from the game save. The HUD only rewrites the DOM
   when its text changes, and rebuilds its panels about 8 times a second.
4. Reuse the existing helpers (`view/kit.ts`, `view/figures.ts`,
   `view/textures.ts`, the panel code) before writing new ones.
5. Changing the saved-state shape needs a version bump and a migration in
   `src/sim/save.ts`, with a test that an old save still loads. (Now at
   version 3: version 3 added the day report's trip-cost line.)
5b. `src/sim/` must not import from `view`, `ui`, Three.js or the DOM; a test
   (`src/sim/purity.test.ts`) scans the import lines and fails if it does.
6. When prices, costs or timings change, run the pacing test. It drives the
   rules with a scripted player (`src/sim/bot.ts`) and checks how long each
   harbour rank takes. Retune until it passes rather than loosening it.
7. Commit small, working steps with clear messages. Do not push unless the
   owner asks.

## Several agents work in this folder at once

The owner runs more than one agent session on this project. To avoid
stepping on each other:

- **Graphics agent** owns how things look: `src/view/` (models, materials,
  shaders, lighting, water, animation, effects) and `src/palette.ts`.
- **Gameplay agent** owns the rules, text and sound: `src/sim/`, `src/ui/`,
  `src/audio*`, `src/events.ts`, `src/interaction.ts`, `src/game.ts`, the
  specs and the tests. When a new feature needs something drawn, the
  gameplay agent adds a plain placeholder in `src/view/` built from the
  existing helpers and lists it under "Waiting for the graphics agent"
  below; the graphics agent then makes it look good.
- Commit only the files you changed (`git add <paths>`, never `git add -A`),
  so one agent never commits another's half-finished work. Pull in the
  other's commits by simply working on the current files; there is one
  branch.
- If you must change a file the other agent owns, keep the change small and
  say so in the commit message.

### Waiting for the graphics agent

- Close-up look of the business-stage boat parts (nets, sails, crates on
  deck, captain figures), the worker figures and cart, the wider market
  stall and the weathervane: built without being looked at closely.
- The grass in the two quay beds can look dark and spiky in some light.
- An odd white-and-grey shape was seen near the pier end in screenshots
  (possibly a gull close to the camera, possibly a broken model).
- The foam band around the pier is still a little wide and bright at night.
- Real frame rate on the owner's machine has never been measured, and the
  automatic quality step-down has not been seen working in a browser.
- `__debug.stats()` reports 1 draw call and 1 triangle because the last
  post-processing pass overwrites the renderer's counters.

## Checking things without playing by hand

In development builds, `window.__debug` gives shortcuts from the browser
console: set the hour, move the player, add money, skip time, jump rank, add
boats, hire staff, open panels. It is defined in `src/debug.ts` (loaded only in
dev builds); read it there for the current list. `__debug.stats()` gives frame
time, draw calls and triangles. A hidden browser tab stops drawing, so use
`__debug.skip(seconds)` instead of waiting.

## Design documents

In `docs/superpowers/specs/`, oldest first:

1. `2026-10-13-harbour-game-mvp-design.md` — the first playable version:
   walking, one boat, crates that spoil, market, orders, pier fishing.
2. `2026-10-13-harbour-business-stage-design.md` — the business layer:
   per-boat upgrades, four boats, four sea zones, captains, workers, wages,
   trip costs, ranks, the day report, and the tuned cost tables. (Some words
   in that spec are the old jargon; the in-game words are in `src/ui/text.ts`.)

Where they disagree, the newer one wins. Write a short spec like these
before building any large new feature, and keep the cost tables in the spec
in step with `config.ts`.

## History and decisions so far

- Started as a top-down shooter idea, then became this harbour game. The
  shooter was never built.
- Unity was considered and rejected: the owner wants everything done by the
  agent, and plain code in the browser is easier for an agent to build and
  test.
- A "sail the boat yourself" direction was offered and declined. The owner
  wants to sit in the business seat: upgrade boats, hire people, grow.
- Open-source water was researched (the built-in Three.js `Water`,
  jbouny/ocean, the Evan Wallace WebGL Water port). None fits a stylised
  harbour, so the water is a custom shader in `src/view/water.ts`.
- Skills for agents are installed under `.claude/skills/` (Three.js
  reference guides and Three.js game-building guides). They are optional
  reading, not project code.

## Ideas not built yet

Processing buildings (a smokehouse and a warehouse), bigger contracts with a
reputation score, storms and a weather forecast, captains who get better
with experience, a lighthouse that allows night trips, surprise finds in the
catch, a legendary fish as the end goal, music.

## Code map

<!-- Keep this list current when files are added, split or removed. -->

Root: `index.html` page shell; `vite.config.ts` test settings; `scripts/tune.mjs`
tuning run (not in the game bundle); `docs/superpowers/specs/` design notes.

**src/**
- `main.ts` — start-up: finds the page elements and starts the game.
- `game.ts` — the Game class: owns state, builds the view/UI, runs the frame loop, saves.
- `events.ts` — turns sim events into sounds, toasts, pop-ups and saves.
- `interaction.ts` — what is near the player, the prompt text, and what E does.
- `debug.ts` — dev-only `window.__debug` helpers (never in production builds).
- `audio.ts` — sound effects made with Web Audio.
- `input.ts` — keyboard state.
- `palette.ts` — fish colours shared by view and UI.

**src/sim/** (pure rules, all unit tested)
- `config.ts` — every tunable number and table, plus the layout of the harbour.
- `state.ts` — the saved-state shape, events, start state.
- `sim.ts` — `step()` that advances everything, plus the public exports.
- `time.ts` — day clock and phases (morning, day, evening, night).
- `rng.ts` — seeded random numbers.
- `catch.ts` — which fish a trip or the pier catches.
- `boats.ts` — send a boat out (pays the trip cost), trips, unloading.
- `fleet.ts` — per-boat upgrade tracks, boat prices, trip time and cost.
- `fishing.ts` — pier fishing: cast, bite, hook.
- `crates.ts` — crates on the dock, in hands and on ice; freshness.
- `market.ts` — prices, price level (demand), selling.
- `orders.ts` — notice-board orders and bonuses.
- `rank.ts` — rank from lifetime earnings and what each rank allows.
- `ledger.ts` — money in and out, kept for the day report.
- `upgrades.ts` — harbour-wide purchases (ice box, handcart, stalls).
- `staff.ts` — captains, workers, wages, and the workers' carrying jobs.
- `save.ts` — save/load and migrations between save versions.
- `bot.ts` — the scripted player used by the pacing test and `npm run tune`.

**src/ui/**
- `text.ts` — all names and wording the player reads.
- `hud.ts` — money, clock, carrying, orders, boats, rank bar, prompt, toasts.
- `panels.ts` — the panels: boat, hire, market, shipyard, notices, fish book, ice box, day report.
- `styles.ts` — the CSS for the HUD and panels.

**src/view/** (Three.js drawing)
- `scene.ts` — renderer, sky, sun, post-processing, quality settings applied.
- `quality.ts` — quality levels and the slow-frame governor.
- `cameraRig.ts` — the angled follow camera.
- `world.ts` — the harbour: builds it from the area files, animates lamps and flags, walkable test.
- `worldParts.ts` — shared types for the area builders.
- `worldGround.ts` — quay, pier, quay details.
- `worldMarket.ts` — market stall, stall wings, weathervane.
- `worldBuildings.ts` — shipyard, inn, notice board, ice box.
- `worldLamps.ts` — lanterns.
- `nature.ts` — hills, trees, grass, flowers.
- `water.ts` — water shader, wakes.
- `waves.ts` — the wave field shared by shader and boats.
- `boatsView.ts` — the four boat models and their upgrades.
- `hull.ts` — hull shape geometry.
- `cratesView.ts` — crates on the dock, in hands, on ice.
- `staffView.ts` — workers and captains.
- `figures.ts` — people models.
- `player.ts` — the player, fishing line and target marker.
- `life.ts` — townspeople, speech bubbles, cat, gulls.
- `kit.ts` — shared materials, geometry helpers and props.
- `textures.ts` — canvas-drawn textures.
- `fx.ts` — smoke, fireflies, wind, light halos.

Tests sit next to the file they test (`*.test.ts`); `pacing.test.ts` checks
times to each rank and that a Trawler is bought.
