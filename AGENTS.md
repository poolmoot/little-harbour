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
- `src/ui/` — the HTML HUD and panels drawn over the canvas.
- `src/audio.ts` — sounds made with Web Audio. No audio files.
- `src/game.ts` — owns the state, steps the sim each frame, and passes
  events to view, UI and audio.
- `src/main.ts` — start-up and the frame loop.

See "Code map" at the bottom for a file-by-file list.

## Rules that keep the project healthy

1. New rules go in `src/sim/` with a unit test first. New numbers go in
   `config.ts`, not inline.
2. No downloaded art or sound. Every model is built from Three.js shapes in
   code, textures are drawn on a canvas, shaders are hand-written. This
   keeps the project small and licence-free. Ask the owner before changing
   this.
3. Keep it light: reuse geometry and materials, use instancing for repeated
   things, no allocation inside per-frame loops, and do the water and wind
   movement in shaders rather than JavaScript.
4. Reuse the existing helpers (`view/kit.ts`, `view/figures.ts`,
   `view/textures.ts`, the panel code) before writing new ones.
5. Changing the saved-state shape needs a version bump and a migration in
   `src/sim/save.ts`, with a test that an old save still loads.
6. When prices, costs or timings change, run the pacing test. It drives the
   rules with a scripted player (`src/sim/bot.ts`) and checks how long each
   harbour rank takes. Retune until it passes rather than loosening it.
7. Commit small, working steps with clear messages. Do not push unless the
   owner asks.

## Checking things without playing by hand

In development builds, `window.__debug` gives shortcuts from the browser
console: set the hour, move the player, add money, skip time, jump rank, add
boats, hire staff, open panels. It is defined in `src/game.ts`; read it there
for the current list. A hidden browser tab stops drawing, so use
`__debug.skip(seconds)` instead of waiting.

## Design documents

In `docs/superpowers/specs/`, oldest first:

1. `2026-10-13-harbour-game-mvp-design.md` — the first playable version:
   walking, one boat, crates that spoil, market, orders, pier fishing.
2. `2026-10-13-harbour-business-stage-design.md` — the business layer:
   per-boat upgrades, four boats, four sea zones, captains, workers, wages,
   ranks, the daily report, and the tuned cost tables.

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

_To be filled in by the next code change; until then, the folder summary
above is accurate._
