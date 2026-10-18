# Little Harbour — Living Town Design

Date: 2026-10-18. Builds on the earlier specs in this folder.

## Goal

Make the harbour town feel alive, look well laid out, and feel smooth to
play. The owner asked for five things:

1. The town shows the player's business.
2. The world reacts to the player.
3. A better town layout.
4. Everything feels smooth and nice to play.
5. A walk that looks very good, with bending elbows.

No new game rules are needed for most of this: the drawing reads state and
events that already exist. Everything stays code-built (no downloaded art or
sound), light (instancing, no per-frame allocation, the quality levels keep
working), and the existing interactions, prompts, worker routes and tests
keep working.

## 1. The town shows your business

All derived from existing state and events; nothing new is saved.

- **Market queue.** Customers stand in a short queue at the market stall by
  day. The queue length follows how busy the market is: the stall level, how
  many crates were sold recently, and the price levels (high prices, longer
  queue). Customers walk up, wait, buy (a small parcel), and walk off into
  town. No queue at night.
- **Restaurant tables.** Outdoor tables in front of the restaurant, one set
  per restaurant level, filled with diners in proportion to how much it has
  served today. Diners sit, eat, chat, and leave. Lanterns on the tables at
  night.
- **Crowd on the pier.** When a boat comes back with a big catch, a few
  townsfolk gather at its spot and watch the unloading, then drift away. A
  golden fish or the King Fish draws a bigger crowd that cheers.
- **Busy town.** The number of strolling townsfolk grows with the harbour
  rank. Some carry a basket or a parcel of fish.

## 2. The world reacts to you

- Gulls on the ground take off when the player walks into them, and settle
  again later.
- After rain the cobbles look wet and puddles stay for a while; walking
  through a puddle splashes.
- The cat comes to the player, rubs against their legs at the market, and
  follows them while they carry fish.
- Townsfolk look at the player as they pass and sometimes wave.
- Hanging nets, flags and signs sway when the player brushes past.
- Small footstep dust on the quay in dry weather.

Sound for this section (owned by the audio side, see below): the hour bell,
the fish seller's calls, crowd murmur that follows how busy the town is,
cheers for a big or golden catch, splashing steps in puddles, gulls taking
off.

## 3. Town layout

The quay is one long, flat paved rectangle with a single row of shops 64
units wide. It reads as empty and the walks are long. Aims:

- **Compact and cosy.** No walk from the pier to any shop longer than about
  20 units. Fewer large empty paved areas.
- **A shape, not a strip.** For example a crescent or U of buildings around
  a small square at the head of the pier, with the shops whose doors face the
  camera along the far side and the arms of the U along the sides, angled so
  their fronts are visible. Nothing tall in the strip nearest the camera;
  anything that can come between the camera and the player fades out.
- **A landmark** seen from anywhere in town (a clock tower or harbour bell
  tower), a small square with a well or fountain, varied roof heights and
  pastel colours, flower boxes, steps up to a hillside of houses behind the
  town, and a rocky shore or breakwater at the ends, with the lighthouse out
  on its own point.
- The plots, shops, pier, fishing spot and worker routes all keep working.
  Positions live in `LAYOUT` in `src/sim/config.ts`; the layout tests and
  the pacing test (which uses walking distances) must keep passing without
  being loosened.

## 4. Smooth and nice to play

- Player movement eases in and out (a short acceleration and stop, no
  sliding), turns smoothly, and never snags on corners: sliding along walls
  and obstacles is smooth.
- The camera follows softly and never jerks, including when the pier view
  changes its tilt.
- No hitches: no frame spikes when buildings appear or upgrade, when many
  workers or customers are on screen, or when windows open.
- The quality levels and the slow-frame governor keep working with the new
  crowds; crowds thin out on lower quality levels.

## 5. A walk that looks very good

The player and every townsperson share one character rig. The walk should
have bending elbows and knees, arms swinging in opposition to the legs, a
slight body bob and sway, the head steadier than the body, a smooth blend
between standing, walking and running, and a carrying pose that holds the
crates naturally. Idle has gentle breathing and the occasional look around.

## Who builds what

- Sections 1, 2 (visuals), 3, 4 and 5 are drawing work in `src/view/`, with
  `LAYOUT` changes in `src/sim/config.ts` for the layout.
- The sounds in section 2 are audio work in `src/audio/` and `src/events.ts`.
- Build order: layout and the walk first (in parallel), sound in parallel,
  then the town life and reactions on top of the new layout.

## Town sounds: done

Built in `src/audio/` (`town.ts` pure maths with tests, `voices.ts` vowel-like
synthesis) and `src/events.ts`; nothing changed in `src/game.ts`. The event
router tells the audio the rank, market day and each crate sold
(`setTownState`, `noteSale`). Hour bell (day only, 1 to 4 strokes, quieter
far from `bellPos()` in `town.ts`, currently the inn until the layout has a
`bellTower`), seller's calls every 20 to 60 s near the market, crowd murmur
that follows rank, recent sales and market day, cheers for 5+ crate catches,
golden fish and the King Fish, wet cobbles after rain with splashes. Ready
but not wired for the town-life work: `fx.gullsTakeOff()`, `fx.catPurr()`,
`fx.wave()`, `fx.tableChatter(level)`. All unheard so far: levels are
conservative guesses to be tuned by ear.

## Walk and feel: done

Sections 4 (movement and camera) and 5 (the walk).

- The rig already had elbow and knee joints; what changed is how they are driven. `src/view/gait.ts` builds the walk from the
  feet backwards: each boot follows a path that stays planted while the body moves over it, then swings forward and lands moving
  at ground speed. A two-bone solver finds the hip and knee angles, so knees bend on the swing and give on landing, and the
  hips ride a bob (two per stride; rising over the planted leg when walking, sinking onto it when running). Step length and
  cadence come from the real speed, so boots do not slide (`gait.test.ts` measures this on the real figure at several speeds
  and scales).
- Arms swing opposite the legs a beat late; the forearm trails and folds more on the back swing. Hips twist one way and
  shoulders the other, the head stays level, and the body leans in more with speed. Idle breathes, shifts weight now and then
  and glances about. Idle, walk, run, carry, fishing and wave blend with weights, not snaps. Each person gets small random
  differences in cadence, arm swing and sway. `pose.load` (crates held) makes a carrying gait shorter, lower and heavier.
- The rig used to stand with its boots about 0.21 below the ground. It is now lifted so boots rest on the ground; carried
  crates, the portrait framing and the speech-bubble height were adjusted to match. Boat captains now stand on the deck.
- Player: speeds up in about 0.17 s and stops in about 0.11 s (`ACCEL`/`DECEL` in `player.ts`), turns at most 15 rad/s with a
  soft arrival, diagonals are no faster, walls stop the player cleanly (speed is what was really achieved) and a footstep
  sounds on each landed boot (at most 5 per second).
- Camera: critically damped follow (0.2 s), a small look-ahead in the direction of movement (up to 0.9 m), a softer pitch
  change on the pier, and a straight cut instead of a swoop when the player is moved more than 3.5 m in a frame.

## Layout: done

The town is a crescent round a small square at the head of the pier (all positions in `LAYOUT`, `src/sim/config.ts`; rotations in radians; `toWorld` turns a point in a building's own frame into world coordinates).

- Quay is 48 wide (x -24 to 24) and 13.4 deep. Far row, doors facing the camera: shipyard (-18.2, 4.3, turned 0.25), market (-8.8, 2.6), ice box (-3, 2.4), clock tower (4.6, 1.8, the landmark and the harbour bell), inn (10.2, 2.8), smokehouse (16.6, 3.2). Arms turned towards the square: cold store (-12.6, 8.8, turned 0.5) and restaurant (13.4, 8.7, turned -0.5).
- The lighthouse stands on its own rocky point at the east end (door at about 20.2, -1.3; point rectangle `LAYOUT.point`). A breakwater of boulders runs out from the west end.
- Square: a flagstone disc at (0, 8.7) with a fountain (5, 8.7) and a well (-5, 8.7); the middle stays open for the workers' lanes. Notice board (2.9, 5.6). Lawns with trees at the corners.
- Behind the town: stairs up to two terraces of pastel houses (decorative, doors towards the town).
- Workers: lane up from the pier, corridor at z 12.2, then straight down to each door; all of it is checked clear of buildings by `layout.test.ts`. The market and ice drops keep their short routes at z 6.4.
- Longest straight walk from the pier head (0, 1) to a door: shipyard about 18.6, lighthouse about 20.7. The pacing test passes unchanged.
- Space kept clear for the town-life work: market queue `LAYOUT.queueZone` (x -12.8 to -4.8, z 4.4 to 5.5, in front of the stall); restaurant terrace `LAYOUT.terrace` in the restaurant's own frame (x -3 to 3, z 2.2 to 3.6, room for three tables; use `toWorld(LAYOUT.plots.restaurant, ...)`); pier-head crowd `LAYOUT.crowdZone` (x -3.2 to 3.2, z 0.8 to 4.6) plus the pier itself.
- Collision (`src/view/collide.ts`) pushes the walker out of turned boxes and discs and back onto the ground, so walls and corners slide and never snag. Anything solid is a box or disc in `World.solids`.
- Fade: `src/view/occlusion.ts` thins out (never fully) anything between the camera and the player, in the shader, for all town materials, the ink outlines and the trees.

## Town life: done

Sections 1 and 2 (drawing side) and the sound wiring. Item 6 was dropped (the layout is being redone); every position is read from `LAYOUT` (`queueZone`, `terrace`, `crowdZone`, plot doors, `market`), so crowds follow the buildings.

- `src/view/townLife.ts` ties it together; pure rules and caps are in `townRules.ts` (tested). Caps by quality (high/medium/low): queue 4/3/2, diners 6/4/2, pier crowd 8/5/3, extra strollers 4/2/0.
- Queue by day (none at night or in storms), length from stall level, recent sales, prices and market day; the front customer buys a parcel when a crate sells. Terrace: one table (two seats) per restaurant level, lanterns lit at night, diners in proportion to `restaurant.served`, new sitting pose and eat/talk gestures on the shared rig (`pose.sit`, `pose.clap`). Pier crowd for 5+ crates, bigger and clapping or waving for golden fish and the King Fish. Extra strollers grow with rank, some carry a basket or parcel.
- Reactions: ground gulls take off when walked into and settle later; wet cobbles (shared stone materials darken) and puddles after rain, drying over time, splashing; the cat comes to the player near the market and rubs their legs; passers-by look and sometimes wave; signs, nets and the flag sway when brushed; dust on dry stone.
- Sounds wired: `gullsTakeOff`, `catPurr`, `wave`, `splash`, `tableChatter`. Wetness uses the audio's `wetnessStep` with the shared `weatherRain` table.
- Background people do not cast shadows (saves draw calls). Dev hook: `window.__town`.
