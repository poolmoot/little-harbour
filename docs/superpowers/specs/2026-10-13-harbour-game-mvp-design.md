# Harbour Game MVP — Design

Date: 2026-10-13. Replaces the wave shooter spec.

## Goal

A cosy harbour management game in the browser. The player walks around a
small harbour, sends fishing boats out, hauls the catch to market before it
spoils, fills orders for the townsfolk, fishes from the pier while waiting,
and spends money on upgrades.

This MVP proves the loop is fun. Graphics are placeholders built in code. No
downloaded models or textures.

Success: the player can play for 20 minutes with something to decide or do at
every moment, buy every MVP upgrade, close the tab and resume later.

## Core loop contract

The player sends boats and hauls crates to earn money, while spoilage, order
deadlines and falling prices create pressure. Success gives money for
upgrades that open a new zone and more capacity. Failure costs income (spoiled
fish, missed orders), never progress.

A better player staggers boat returns, reads orders and prices before choosing
a zone, hauls the most valuable fresh crates first, and fishes while waiting.

## Stack

Three.js, Vite, TypeScript, Vitest. Desktop browser, keyboard and mouse,
single-player. HUD and panels are HTML over the canvas. Sound is synthesised
with Web Audio (no audio files).

## Controls

- WASD: walk (screen-relative; the camera never rotates).
- E: interact with the nearest thing in range (a prompt shows what).
- Mouse: click buttons in panels. Esc closes a panel.
- L: logbook.

## World

One small scene, all built from primitives with flat colours:

- Quay (land strip) with the fish market stall, shipyard shed, inn with a
  notice board outside, and an ice box by the pier.
- A wooden pier running out to sea with two berths and a fishing spot at the
  end.
- Sea: a large plane with gently animated colour and vertex waves.
- Angled camera: about 55° down, 20 m back, fixed yaw, smooth follow.
- Characters are code-built low-poly figures with a procedural walk (leg
  swing and bob). The player wears a straw hat.

## Systems and numbers

All numbers live in `src/sim/config.ts`.

### Time

- One day lasts 6 real minutes. The clock runs 06:00 to 06:00.
- Phases: dawn 06–08, day 08–18, dusk 18–20, night 20–06. Sun colour, light
  intensity and sky colour blend between phases. Lanterns light at night.
- Boats cannot be sent at night. Boats already out still return.
- At 06:00 a day summary shows: earned, crates sold, crates spoiled, orders
  filled and missed.

### Fish

| Species | Source | Base price | Weight | Note |
|---|---|---|---|---|
| Herring | Shallows, pier | 6 | 50 | |
| Mackerel | Shallows, pier | 10 | 30 | |
| Flounder | Shallows | 18 | 20 | weight ×3 at dawn and dusk |
| Sea bass | Reef | 28 | 50 | |
| Red snapper | Reef | 40 | 35 | |
| Lobster | Reef | 90 | 15 | |

Weights are relative chances within a source. Pier fishing uses herring 70,
mackerel 30.

### Boats and zones

- The player starts with one rowboat at berth 1.
- Interacting with a docked boat opens a dispatch panel: choose a zone, see
  trip time and what lives there.
- Shallows: 25 s trip. Reef: 50 s trip, needs the Hull upgrade.
- The boat is seen sailing out, disappearing past the horizon fog, and
  returning. A bell sound plays on return.
- On return the boat holds one crate per unit of hold (start 4). The player
  interacts with the boat to unload all crates onto the dock beside the
  berth. A boat cannot be sent again until unloaded.

### Crates and freshness

- A crate holds one fish species. Freshness starts at 100 when unloaded.
- On the dock it loses 100 over 150 s. In the ice box it loses 100 over
  600 s. Carried crates decay at the dock rate.
- Price multiplier from freshness: 1.0 at 100, falling linearly to 0.3 at 0.
  At 0 the crate is spoiled, worth nothing, and is discarded when picked up
  or at the next 06:00.
- The player carries 2 crates (4 with the Handcart). E near a crate picks it
  up; E at the ice box stores or retrieves; E at the market opens the sell
  panel.
- The ice box holds 6 crates and must be bought.

### Market

- Sell panel lists carried crates with their current price and a Sell all
  button, plus a price board for all known species.
- Price = base price × freshness multiplier × demand multiplier.
- Demand starts at 1.0 per species. Each crate sold lowers that species by
  0.06 (minimum 0.5). Demand recovers 0.02 every 10 s up to 1.0.

### Orders

- The notice board holds up to 2 open orders. A new one appears 20 s after a
  slot frees, and both slots are filled at the start.
- An order asks for 2–5 crates of one species the player can currently reach,
  with a deadline 2–4 in-game hours away, from a named townsperson.
- Selling a matching crate at the market counts toward the order
  automatically and pays double for that crate.
- A completed order pays a bonus of 50% of the order's base value. A missed
  order just disappears and is counted in the day summary.

### Pier fishing

- At the pier end, E casts. After a random 2–6 s a bite shows ("!" over the
  float plus a splash sound).
- E within 0.7 s lands the fish as a crate in hand at freshness 100. Too
  early or too late loses it. Needs a free carry slot.

### Upgrades (shipyard panel)

| Upgrade | Cost | Effect |
|---|---|---|
| Ice box | 120 | Enables the ice box |
| Handcart | 200 | Carry 4 crates |
| Hold I | 150 | Hold 6 |
| Hold II | 400 | Hold 8 |
| Hull | 500 | Unlocks the Reef; boat model gets a mast and is larger |
| Second boat | 800 | A second rowboat at berth 2 |

Hold and Hull apply to all boats. Starting money is 0; pier fishing and the
first Shallows trips provide the first income.

### Life around the harbour

- Three named townspeople stand at their spots: the fishmonger (market), the
  shipwright (shipyard) and the innkeeper (notice board). Each shows a short
  line in a speech bubble when the player comes near, picked from a small
  list that reacts to state (time of day, a fresh rare fish in hand, an order
  just filled or missed).
- A harbour cat wanders the quay, follows the player while they carry fish,
  and sits by the market stall otherwise.
- Gulls circle over the pier; one lands near crates left on the dock.
- Sounds: bell (boat returns), coin (sale), splash (bite), soft step ticks,
  a low chime at dawn.

### Logbook

L opens it. Each species shows as a silhouette until first caught, then its
name, total caught and best sale price.

### Saving

State saves to `localStorage` every 10 s and after every sale or purchase.
On load, boats that were out are placed back at their berths with their catch
ready to unload, and all crate freshness is kept as saved (no decay while the
tab was closed). A "Reset game" button sits in the logbook panel behind a
confirm step.

## Out of scope (later stages)

Storms and forecasts, the lighthouse and town restoration, surprise catches,
Open Sea and Deep zones, more boat types, real models, the stylised water
shader, post-processing, music, mobile and gamepad support.

## Architecture

The simulation is pure TypeScript with no Three.js or DOM imports, so it is
unit tested and the view can be replaced later without touching the rules.

```
src/
  sim/            pure rules, no rendering
    config.ts     all numbers and tables
    rng.ts        seedable random
    state.ts      GameState type, initial state
    time.ts       clock, phases, day rollover
    catch.ts      zone + time → crates
    boats.ts      dispatch, trip progress, return, unload
    crates.ts     freshness decay, carry, ice box
    market.ts     prices, demand, selling
    orders.ts     generation, progress, deadlines
    fishing.ts    cast / bite / hook state machine
    upgrades.ts   costs, purchase, effects
    save.ts       serialise, load, migrate
    sim.ts        step(state, dt, rng) and action functions; emits events
  view/           Three.js, reads state and events
    scene.ts      renderer, lights, sky, day-night blending
    world.ts      quay, pier, buildings, sea
    figures.ts    code-built characters and walk animation
    player.ts     movement, collision with simple boxes, interaction range
    boatsView.ts  boat models and sailing motion
    cratesView.ts crate meshes on dock, in hand, in ice box
    life.ts       townspeople, cat, gulls
    cameraRig.ts  angled follow
  ui/
    hud.ts        money, clock, carried crates, prompt, toasts
    panels.ts     dispatch, market, shipyard, notice board, logbook, summary
  audio.ts        Web Audio synthesised sounds
  game.ts         owns state, calls sim.step, routes events to view/ui/audio
  main.ts         bootstrap and frame loop
```

The sim exposes actions (`dispatchBoat`, `unloadBoat`, `pickUp`, `sellAll`,
`buyUpgrade`, `castLine`, `hook`, …) that return events
(`boatReturned`, `crateSold`, `orderFilled`, `biteStarted`, …). View, UI and
audio react to events and never change state directly.

Delta time is clamped to 100 ms per frame. Held keys clear when the window
loses focus.

## Testing

- Vitest unit tests for every `sim/` module: freshness and price maths,
  demand drop and recovery, order progress and deadlines, catch tables
  including the flounder time bonus, boat trip lifecycle, upgrade effects,
  fishing timing window, save round-trip.
- `npm run build` must pass with no TypeScript errors.
- One manual playtest in the browser: no console errors, and each item under
  "Systems and numbers" behaves as written.

## How to run

`npm install`, `npm run dev`, open the address Vite prints.
