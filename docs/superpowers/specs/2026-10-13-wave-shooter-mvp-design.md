# Wave Shooter MVP — Design

Date: 2026-10-13

## Goal

A playable browser game that proves the core is fun: move, aim, shoot, dash,
survive growing waves. Graphics are deliberately plain in this stage. The
forest, stream, lighting polish, extra enemy types, upgrades and sound come in
later stages and are out of scope here.

Success means: the user can open the game in a desktop browser, play a full
run from wave 1 to death, see their score, and restart, with smooth movement
and a steady frame rate.

## Decisions already made

- Three.js, Vite, TypeScript. Runs in a desktop browser, single-player.
- Angled looking-down camera (not top-down, not behind the character).
- WASD to move, mouse to aim, hold left click to shoot, Space to dash.
- Game loop is wave survival in one arena.
- All assets are free and CC0.

## Scope

In:

- Angled follow camera.
- Player with an animated model: idle, run, death.
- One gun: hold to fire, visible bullets.
- Dash with a cooldown and brief invulnerability.
- One enemy type (swarmer) that chases the player and damages on contact.
- Waves that grow in size and speed, with a short break between them.
- Health, score, wave counter, game-over screen, restart.
- A flat arena with boulders that block movement and bullets.
- Minimal feedback: muzzle flash, hit particles, enemy flash on hit, small
  camera shake.

Out (later stages):

- Forest, stream, grass, lighting and post-processing polish.
- Brute and spitter enemies.
- Upgrade picks between waves.
- Sound and music.
- Mobile and gamepad support, saving, menus beyond game over.

## Game rules

All numbers live in one `config.ts` so they are easy to tune.

| Thing | Value |
|---|---|
| Arena | 60 × 60 m, player and enemies clamped inside |
| Boulders | 8, fixed positions, circular colliders, radius 1.5–3 m |
| Player speed | 6 m/s |
| Player health | 100 |
| Dash | 0.2 s at 3× speed, 1.5 s cooldown, invulnerable while dashing |
| Fire rate | 8 shots per second while the button is held |
| Bullet | 40 m/s, 1 damage, removed after 1.5 s or on hitting an enemy or boulder |
| Swarmer health | 2 |
| Swarmer speed | 3.5 m/s at wave 1, +0.15 m/s per wave, capped at 5.5 m/s |
| Swarmer contact damage | 10, at most once per 0.5 s per swarmer |
| Wave size | 6 + 4 × wave number |
| Spawning | at random points on the arena edge, at least 12 m from the player, spread over the first 60% of the wave |
| Wave end | all swarmers of the wave are dead |
| Break between waves | 3 s |
| Score | 10 per kill, 100 per wave cleared |

Movement is relative to the screen: W moves up the screen. The camera never
rotates, so this is a fixed world direction.

Aiming: a ray from the mouse through the camera hits the ground plane. The
player model turns to face that point and bullets travel toward it.

Death: at 0 health the player plays the death animation, input stops, and the
game-over screen shows the wave reached and the score. R or a click on the
button restarts without reloading the page.

## Camera

Perspective camera, pitched about 55° down from horizontal, placed about 18 m
from the player, with a fixed yaw. It follows the player with light smoothing
and shifts slightly toward the aim point so the player sees more of what they
are aiming at. Camera shake is a small decaying offset applied on top.

## Assets

- Player: `RobotExpressive.glb` from the Three.js examples (CC0), which has
  Idle, Running and Death clips. It is a placeholder; a wanderer-style
  character replaces it in a later stage. The gun is a simple mesh attached
  to the hand.
- Swarmers: built from primitive shapes in code, with a procedural hop while
  moving. No download needed.
- Arena: flat coloured ground, boulders as low-poly rock shapes generated in
  code.

The model file is copied into `public/models/` so the game does not depend on
a network request at run time.

## Architecture

Game logic that can be expressed without Three.js is kept in pure modules so
it can be unit tested. Rendering modules read that state and draw it.

| Module | Purpose | Depends on |
|---|---|---|
| `config.ts` | All tunable numbers | nothing |
| `waves.ts` | Pure: wave number → enemy count, speed, spawn schedule | config |
| `collision.ts` | Pure: circle vs circle, circle vs boulders, segment vs circle, arena clamp | nothing |
| `input.ts` | Keyboard and mouse state; mouse position to ground aim point | Three.js camera |
| `cameraRig.ts` | Angled follow camera, aim offset, shake | Three.js |
| `arena.ts` | Ground, boulders, their colliders | Three.js, config |
| `player.ts` | Movement, dash, health, model and animation blending | input, collision, config |
| `bullets.ts` | Pooled bullets: spawn, move, hit tests | collision, config |
| `enemies.ts` | Pooled swarmers: chase, separation, contact damage, hit flash | collision, config |
| `effects.ts` | Muzzle flash, hit particles | Three.js |
| `hud.ts` | HTML overlay: health bar, wave, score, game over | nothing |
| `game.ts` | State machine (playing, wave break, dead), owns all of the above, runs one update per frame | all |
| `main.ts` | Renderer, resize handling, the frame loop | game |

Per frame: `main` computes a clamped delta time and calls `game.update(dt)`,
which updates input, player, bullets, enemies, waves, effects, camera and HUD
in that order, then renders.

Bullets and swarmers come from fixed-size pools so nothing is allocated during
play.

Swarmers steer straight at the player, slide around boulders using the same
circle collision as the player, and push apart from each other so they do not
stack into one point. There is no pathfinding; the arena is open enough not
to need it.

## Error handling

- If the player model fails to load, the game shows a readable error on the
  page instead of a blank screen.
- Delta time is clamped to 50 ms so a paused or background tab does not make
  things teleport on return.
- When the window loses focus, held keys are cleared so the player does not
  keep running.

## Testing

- Unit tests (Vitest) for `waves.ts` and `collision.ts`, and for the pure
  parts of dash timing, fire-rate timing and contact-damage cooldown.
- A manual playtest in the browser against this checklist:
  - WASD moves in screen directions; the player cannot leave the arena or
    walk through boulders.
  - The player faces the cursor; bullets go where the cursor points and stop
    at boulders.
  - Dash moves fast, has a cooldown, and avoids damage.
  - Swarmers spawn at the edges, chase, deal damage, flash when hit and die
    after two hits.
  - Waves grow; the break between waves shows; score and wave counter are
    correct.
  - Death shows the game-over screen; restart gives a clean new run.
  - No console errors; the frame rate stays smooth at wave 10.

## How to run

`npm install`, then `npm run dev`, then open the local address Vite prints.
