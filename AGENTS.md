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
npm run package  # build, then zip dist/ into release/little-harbour-web.zip (scripts/package.mjs)
```

`npm run package` needs the system `zip` command and prints a plain message if it
is missing. `release/` is git-ignored. The build uses relative paths (`base: './'`
in `vite.config.ts`), so the zip works from any folder on a web server; keep asset
paths relative (no leading `/`). Nothing is ever uploaded by a script.

The game opens on the title screen with the world paused. Dev shortcut: add
`?play` to the address (`http://localhost:5173/?play`) to skip it, which is what
scripted checks that use `window.__debug` should do.

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
  there. The wording of the title screen, pause menu, settings, how-to-play page,
  the controls hint and the mute toast lives in `src/ui/menuText.ts`. The sim keeps only ids, numbers and person/boat names, and gives short
  plain "why not" reasons (plus a `needRank` number) that the UI words.
- `src/audio/` — sound and music made with Web Audio. No audio files. `GameAudio` in `index.ts` is the one door into it.
- `src/game.ts` — owns the state, steps the sim each frame, and wires view, UI
  and audio together. Event routing is in `src/events.ts`, targeting and the
  E-key action in `src/interaction.ts`, and the dev-only `__debug` hook in
  `src/debug.ts`.
- `src/main.ts` — start-up and the frame loop.

### Title screen and pause

`Game.mode` in `src/game.ts` is `'title'`, `'play'` or `'paused'` (rules in
`src/ui/menuFlow.ts`, unit tested). The game starts on `'title'`. While the mode is
not `'play'` the frame skips `step()` (so the sim and the clock stand still), stops
the autosave and holds the walkers, boats and crates in the view; water and light
keep their gentle motion. Esc with no window open pauses; Esc again resumes; Esc in
Settings or How to play goes back to the menu that opened it. Esc with an ordinary
window open just closes it. The music scheduler runs inside `audio.update()`, so
`game.ts` does not call it while paused (it does run on the title screen, where the
clock is still). Continue loads the save that `loadGame` already read. New game with a
save asks first, then uses the normal reset (`clearSave` and reload) and sets a
one-tab flag so the title is not shown again. Do not write a second save path.

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
   (Auto/High/Medium/Low) is on the Settings screen and saved in `localStorage`
   under its own key, apart from the game save. The HUD only rewrites the DOM
   when its text changes, and rebuilds its panels about 8 times a second.
4. Reuse the existing helpers (`view/kit.ts`, `view/figures.ts`,
   `view/textures.ts`, the panel code) before writing new ones.
5. Changing the saved-state shape needs a version bump and a migration in
   `src/sim/save.ts`, with a test that an old save still loads. (Now at
   version 8; version 8 added town projects, captain trips and the boat-care line; version 7 removed the ice box and cold store; version 3 added the day report's trip-cost line; version 4 the
   tycoon stage (buildings, weather, contracts, goals, King Fish); version 5
   fish sizes, golden fish, names and earnings while away; version 6 the
   starting guide; version 7 removed the ice box and the cold store: stored crates go back
   on the dock, the money spent is refunded.)
5b. `src/sim/` must not import from `view`, `ui`, Three.js or the DOM; a test
   (`src/sim/purity.test.ts`) scans the import lines and fails if it does.
6. When prices, costs or timings change, run the pacing test. It drives the
   rules with a scripted player (`src/sim/bot.ts`) and checks how long each
   harbour rank takes. Retune until it passes rather than loosening it.
7. Commit small, working steps with clear messages. Do not push unless the
   owner asks.

## Several agents work in this folder at once

(The gameplay chat coordinates rules, text, sound and large layout changes,
often through parallel sub-agents; a graphics chat works on looks and the
interface styling. Either may run sub-agents. Everyone commits only their own
paths, and announces large changes to shared files such as `LAYOUT` before
starting.)


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

- Storm damage shown on a boat (`damaged` on the boat).
- The King Fish hanging on the inn wall once `state.king.delivered` is set.
- A distinct look for golden crates and the King Fish crate.
- Rougher water in good wind and storms.
- The world's cartoon restyle (in progress).
- Town projects (`state.town`): each finished one should show in the town — a
  mended road, a new fish-hall roof, painted houses, bunting on a fair ground, a
  rebuilt sea wall, a sailing school sign, a bandstand, a statue. Rules work
  without it.
- A small level badge for experienced captains (`captainLevel` in `sim/captains.ts`).
- Dock crates in bins (`DOCK_BIN_SIZE` in `config.ts`): the gameplay agent drew a plain version in
  `view/cratesView.ts` (one crate per dock spot, stretched for 2, a grey steel box for 3-4). A nicer
  double crate and metal crate are welcome.

Measured by the graphics agent on High at the market: about 630–690 draw
calls and 410k triangles, holding 60 fps with some dropped frames; shadows
roughly double the draw calls. After the small-square layout: about 525–545 calls and 520k triangles standing in the middle of the square at midday on High with all four buildings built (default camera, distance 23). When adding things, keep flat-coloured parts on `flat()` (`bake` merges them into one vertex-coloured material), give signs and tiny props no shadow, and keep background people out of the shadow pass.

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
3. `2026-10-13-harbour-tycoon-stage-design.md` — goals, the four buildings
   (smokehouse, restaurant, lighthouse; the cold store was removed later), weather and special days,
   contracts, money per minute, the King Fish ending.
4. `2026-10-13-harbour-return-features-design.md` — earnings while away, fish
   sizes, stars and golden fish, zone rewards, harbour and boat names.
5. `2026-10-18-living-town-design.md` — the town: the small-square layout and
   its limits, the market queue, restaurant terrace and crowds, reactions to
   the player, town sounds, the walk and movement feel.
6. `2026-10-19-starting-guide-design.md` — the welcome, step cards, ground
   trail, unlock cards and the gentle first minutes.
7. `2026-10-21-money-depth-design.md` — trip costs that grow with the hold,
   captains who level up and ask more pay, boat care, and the town projects; then more boat
   upgrade levels, prices shown in money, the easier start and the bigger dock crates.

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

A reputation score for contracts,
surprise finds in the catch (bottles, chests), seasons, decorating the
harbour, named regulars with small stories, and a town that starts run-down
and is restored as the player grows (the suggested selling hook).

## Code map

<!-- Keep this list current when files are added, split or removed. -->

Root: `index.html` page shell; `vite.config.ts` base path (`./`) and test settings;
`scripts/tune.mjs` tuning run and `scripts/package.mjs` zip maker (neither is in the
game bundle); `docs/superpowers/specs/` design notes.

**src/**
- `main.ts` — start-up: finds the page elements and starts the game.
- `game.ts` — the Game class: owns state, builds the view/UI, runs the frame loop, saves.
- `events.ts` — turns sim events into sounds, toasts, pop-ups and saves; also sets the rain, storm-wind and fog sound layers from the weather.
- `interaction.ts` — what is near the player, the prompt text, and what E does (including the three plot doors and the empty boat spots on the pier, which open the `berth` window, and delivering the King Fish at the inn).
- `debug.ts` — dev-only `window.__debug` helpers (never in production builds).
- `input.ts` — keyboard state (a text field owns every key; sliders keep their own arrow keys; `keyBelongsToField` is tested).
- `palette.ts` — fish colours shared by view and UI.

**src/sim/** (pure rules, all unit tested)
- `config.ts` — every tunable number and table, plus the layout of the harbour.
- `state.ts` — the saved-state shape, events, start state.
- `sim.ts` — `step()` that advances everything, plus the public exports.
- `time.ts` — day clock and phases (morning, day, evening, night). The night runs 2.5 times faster (`NIGHT_SPEED`), so a day is 270 real seconds; `realSecondsFor` and `gameSecondsFor` convert between in-game and real seconds.
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
- `upgrades.ts` — harbour-wide purchases (handcart, stalls).
- `staff.ts` — captains, workers, wages and boat care, and the workers' carrying jobs.
- `captains.ts` — captain levels from trips, pay by boat and level, the level bonuses.
- `town.ts` — town projects: buying them and the lasting bonus each gives.
- `save.ts` — save/load and migrations between save versions.
- `bot.ts` — the scripted player used by the pacing test and `npm run tune`.
- `goals.ts` — the goal chain (rules in `config.ts` GOALS), progress, rewards, old-save catch-up.
- `buildings.ts` — the three buildings: build/upgrade, smokehouse, restaurant (and the lighthouse).
- `routing.ts` — where an idle worker takes crates (restaurant, smoked pickup, smokehouse, market).
- `weather.ts` — weather and special days, the forecast, their effects on trips and prices.
- `storm.ts` — broken boats, repair, the "stay home in storms" choice.
- `contracts.ts` — contract offers, accepting, counting sales, reward and failure.
- `ending.ts` — delivering the King Fish and the ending summary.
- `income.ts` — money earned per minute.
- `away.ts` — earnings while the player is away (measures a rate on a copy, credits half of it).
- `fishbook.ts` — fish sizes, stars, golden fish, the fish book figures and zone rewards.
- `names.ts` — harbour and boat names and their checks.
- `guide.ts` — the starting guide: steps, unlock cards, the gentle first minutes (saved in `state.guide`). `guideAdvice.ts` — what to do instead while a step costs too much (boats sail at night too).
- `layoutBoxes.ts` — every solid footprint in the harbour (buildings turned exactly 0 or +-90 degrees, plots, lamps, trees, terrace tables), the walkable ground (the square, the pier and the lighthouse breakwater) and the lanes that must stay clear (three walking lanes making a U round the open middle, the approach to every door, the path from the pier). One small square: sea row on top (market, pier gap, ice box, notice board, clock tower), shipyard / cold store / smokehouse down the west side, inn / restaurant down the east side, camera side open (`LAYOUT.square` in `config.ts`). The view builds its collision from it and the layout tests walk it with hard size and walking-distance limits (`layout.test.ts`, `../layoutStations.test.ts`, `../view/townLayout.test.ts`).

**src/ui/** (HTML over the canvas; windows are pure functions `ScreenCtx -> ScreenView`)
- `text.ts` — all names and wording the player reads in the game.
- `screenText.ts` — wording for the tycoon screens (goal tracker, weather chip, building windows, contracts tab, workers' rules, repairs, day report, ending, new toasts).
- `menuText.ts` — wording for the title screen, pause menu, settings, how to play, the controls hint and the mute toast.
- `hud.ts` — money (with money per minute), clock, weather chip, goal tracker, carrying, orders, boats, rank bar, prompt, controls hint, toasts.
- `hudParts.ts` — pure builders for the goal tracker, weather chip and money-per-minute text (tested).
- `buildingParts.ts` — shared pieces of the building windows (upgrade row, which carried crates fit).
- `panels.ts` — the window manager: opens a screen, draws it, routes button and slider events to game actions (`PanelKind`, `SCREENS`, `Panels.act`).
- `menuFlow.ts` — pure rules for title / play / paused and what Esc does in each.
- `components.ts` — reusable HTML builders (button, meter, slider, card, item, chip, section, stat, tick, `textField` for names with live `nameFeedback`, `esc` for typed text).
- `icons.ts` — the chunky SVG icon set and fish icons.
- `screens/types.ts` — `ScreenCtx` and `ScreenView`.
- `boatOffer.ts` — the boat you would get from "Buy a new boat" (price, what it can do, padlock note), shared by `screens/shipyard.ts` (one page: your boats, buy a boat, harbour upgrades) and `screens/berth.ts` (the empty boat spot window). `components.ts` also holds `lockNote` / `lockInfo` (padlock, price, one plain line on what is missing, money bar), `buyLabel` and `levelDots`; use them for anything locked. Tests: `screens/yard.test.ts`.
- `screens/boat.ts`, `crew.ts`, `market.ts`, `shipyard.ts`, `notices.ts` — the in-game windows. `notices.ts` has the Orders, Contracts and Town tabs; `crew.ts` holds the "Smoke these" ticks; `boat.ts` has the "Stay home in storms" tick and the broken state; `shipyard.ts` has the Fix buttons.
- `screens/plot.ts` — the window for a plot (For sale, or the right building window); `smokehouse.ts`, `restaurant.ts`, `lighthouse.ts` — the building windows. `screens/ending.ts` — the King Fish ending.
- `screens/logbook.ts` — the fish book (completion meters, sea zones with their rewards, one card per fish). `screens/ledger.ts` — the day report (with the away-earnings line).
- `screens/title.ts` — the title screen (shows the harbour name). `screens/pause.ts` — the pause menu. `screens/away.ts` — the welcome-back window (money counting up) and the one-time captain tip.
- `guideText.ts` — wording for the welcome, step cards, unlock cards and advice. `guideParts.ts` (card and help-list builders), `guideCards.ts` (the sliding cards), `guideSetting.ts` (the Show guide tips switch), `coach.ts` (button ring and edge arrow), `screens/guide.ts` (welcome, "?" help list, menu tips list). `src/guideTargets.ts` turns guide targets into world positions.
- `awayFlow.ts` — pure rules for what the player sees on coming back (welcome, tip or nothing) and the counter easing (tested). `fishParts.ts` — shared crate pieces: golden art and name, size and stars, what the size does to the price.
- `screens/settings.ts` — volumes, mute, picture quality, reset game.
- `screens/howto.ts` — the how-to-play page.
- `styles/index.css` — pulls in the other style files. `tokens.css` — every colour, size and timing. `base.css` — base text and animations.
- `styles/components.css` — buttons, meters, sliders, cards, rows. `hud.css` — the HUD. `window.css` — windows. `menu.css` — title, pause, settings, how-to-play.
- Tests: `components.test.ts`, `menus.test.ts` (menu screens), `menuFlow.test.ts`, `textTycoon.test.ts`, `hudParts.test.ts`, `screens/tycoon.test.ts` (the tycoon windows); `return.test.ts` and `awayFlow.test.ts` (fish book, crate windows, names, welcome-back); `src/input.test.ts` (keys and text fields); `src/events.test.ts` covers the event sounds, weather layers and plot targets.

**src/audio/** (all through `GameAudio` in `index.ts`: `getSettings`, `setVolume`, `setMuted`, `toggleMute`, `settings.subscribe`)
- `index.ts` — `GameAudio`, the one entry point; per-frame `update`, the M key, sound-effect calls.
- `engine.ts` — the Web Audio context and the shared mixing buses.
- `settings.ts` — volumes and mute, saved under their own `localStorage` key.
- `effects.ts` — sound effects. `ambience.ts` — sea, wind, gulls, weather beds.
- `music.ts` — plays the music with look-ahead scheduling. `musicPlan.ts` — chooses the chords and melody.
- `mix.ts` — pure maths for how sound follows position, clock and weather. `town.ts` — pure maths for the town sounds (hour bell, seller's calls, crowd level and murmur, wet cobbles, cheers; the bell's position is `bellPos()`). `voices.ts` — formant (vowel-like) call, cheer and chatter synthesis. `random.ts` — small seeded random numbers.
- Tests: `mix.test.ts`, `town.test.ts`, `musicPlan.test.ts`, `settings.test.ts`.

**src/view/** (Three.js drawing)
- `scene.ts` — renderer, sky, sun, post-processing, quality settings applied.
- `quality.ts` — quality levels and the slow-frame governor.
- `cameraRig.ts` — the angled follow camera.
- `world.ts` — the harbour: builds it from the area files, animates lamps and flags, walkable test and sliding movement (`resolve`).
- `collide.ts` — walking collision maths: a circle against turned boxes and discs, kept on the ground (rectangles); slides along walls and corners (tested).
- `occlusion.ts` — the see-through fade for anything between the camera and the player (shader patch, two shared uniforms, `updateOcclusion` called once a frame from `game.ts`).
- `worldTown.ts` — the clock tower (landmark), the low decorative hillside houses and stairs, shore boulders and the breakwater's stone lip.
- `buildingMarks.ts` — signboards (always facing the camera, even on the side rows), doormats, lanterns, glow, name plate and status bubbles for usable buildings; `markIcons.ts` draws the sign icons on a canvas.
- `worldParts.ts` — shared types for the area builders.
- `worldGround.ts` — the square's paving (flat boxes), the grass behind the side rows, the link and breakwater to the lighthouse, the low wall on the camera side, lawns, the pier, quay details.
- `worldMarket.ts` — market stall, stall wings, weathervane.
- `worldBuildings.ts` — shipyard, inn, notice board. `berthMarks.ts` — the "boat for sale" signs on posts at empty boat spots on the pier.
- `worldLamps.ts` — lanterns.
- `nature.ts` — hills, trees, grass, flowers.
- `water.ts` — water shader, wakes.
- `waves.ts` — the wave field shared by shader and boats.
- `boatsView.ts` — the four boat models and their upgrades.
- `hull.ts` — hull shape geometry.
- `cratesView.ts` — crates on the dock, in hands, on ice.
- `staffView.ts` — workers and captains.
- `figures.ts` — people models and their walk, idle, carry, fishing and wave animation (one shared rig).
- `gait.ts` — pure walk maths: foot paths (planted, then swung), two-bone leg solver, hip bob, run blend. `gait.test.ts` also checks that a real figure's boots do not slide.
- `motion.ts` — pure easing helpers: speed ramps, smooth turning, damped follower (used by the player and the camera). Tested in `motion.test.ts`.
- `player.ts` — the player, fishing line and target marker.
- `life.ts` — townspeople, speech bubbles, cat, gulls.
- `kit.ts` — shared materials, geometry helpers and props.
- `textures.ts` — canvas-drawn textures.
- `guideTrail.ts` — the glowing dotted trail on the ground for the starting guide.
- `fx.ts` — smoke, fireflies, wind, light halos.
- `townLife.ts` — `TownLife`: reads state and events (`EventDeps.watch`), runs the queue, terrace, pier crowd, wet cobbles, dust and sway; sounds go out through `townHooks.ts` (wired in `game.ts`). `townRules.ts` — pure rules and quality caps (tested). `townPlaces.ts` — gates, queue slots, tables, crowd spots, all derived from `LAYOUT`. `townFolk.ts` — pooled fading citizens. `townQueue.ts`, `townTerrace.ts`, `townCrowd.ts` — the three crowds. `townReact.ts` — particles, wetness and puddles, sway springs.

Tests sit next to the file they test (`*.test.ts`); `pacing.test.ts` checks
times to each rank and that a Trawler is bought.
