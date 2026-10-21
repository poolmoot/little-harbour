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

## Layout: done (redone as one small square)

The round horseshoe (59 wide, walks of 30 to 36) was too big, so the town is now one small paved square with a row of buildings on its sea side and one down each side. The size limits are hard and enforced by `layout.test.ts`. All positions are in `LAYOUT` (`src/sim/config.ts`, with `FOOT`); every solid thing, the walkable ground and every lane that must stay clear is in `src/sim/layoutBoxes.ts`, and the view builds its walking collision from that same data (`World` reads `BOXES`, `ROUNDS`, `WALK_RECTS`).

- **The square** (`LAYOUT.square`): x from -12.4 to 12.4, z from 0 to 16 (24.8 wide, 16 deep), paved. The sea is at -z; the pier runs out of the middle of its top edge (x -2 to 2, z 0 to -18) and the camera looks from +z. In front of every door is a frontage 3.5 deep (`square.front`: stations, the market queue, the restaurant terrace, the pier crowd); beside it a walking lane 4.5 wide (`square.lane`) runs along all three rows as a U round the open middle (`LANES`, `MIDDLE` in `layoutBoxes.ts`).
- **Sea row** (doors towards the camera, rotation 0, front wall on z = 0, water right behind), west to east: market (centre x -7, stall reach -11 to -3), the gap where the pier leaves the square, notice board (4.9; the ice box was removed on 2026-10-21), clock tower (9.5; `LAYOUT.bellTower`, the landmark).
- **West row** (rotation exactly +90 degrees, door towards +x, front wall on x = -12.4), from the water: shipyard (centre z 0.8, its slipway runs north into the water with the upturned hull on it), smokehouse (9.2; the cold store was removed on 2026-10-21).
- **East row** (rotation exactly -90 degrees, door towards -x, front wall on x = 12.4), from the water: inn (4.5), restaurant (11.9) with its three-table terrace in the frontage south of its door.
- **Camera side** is open: a low wall at z about 16.2 with a gap for the steps up to the low, soft-coloured hillside houses (two terraces, windows and no doors, decoration only). Lawns with a tree each lie outside the wall.
- **Lighthouse** at (13.6, -8) on a paved breakwater (`LAYOUT.breakwater`, x 11.4 to 15.8, z -10.2 to 1) that leaves the square's top-right corner between the clock tower and the inn and runs out over the water. The water also comes up behind the sea row (the shore is `LAYOUT.shoreZ`, a little further out behind the shipyard).
- **Size.** x from -16.6 to 17.6 including the shipyard and the inn: 34 wide (limit 40, x -20 to 20). Buildings are never turned except by exactly 90 degrees on the two side rows; their signboards (and the floating name plates) always face the camera, hanging out from the wall on an arm on the side rows.
- **Open walking.** The lanes are clear of every solid; the approach to every door (3.5 wide) runs straight from the door to a lane; the path from the pier into the square is 3.2 wide; nothing at all stands in the lanes or the middle. No fountain, well, bench or tub in the square. Decoration only outside the square: lamp posts in the gaps between side buildings and along the low wall, trees on the lawns. A compass rose is let into the middle (`worldPaving.ts`).
- **Walk length** from the pier mouth (0, 1.6), by a search on the 0.1 grid that allows diagonal steps (a diagonal costs 1.414): market 8, ice box 3, notice board 6, shipyard 11, inn 11, cold store 13, restaurant 14, smokehouse 15 (the furthest door), lighthouse 18; the fishing spot and the outer boat spot at the pier end 18. Limits in the test: 20 to every door and interaction point, 26 to the lighthouse. Counted in whole blocks (no diagonals) the furthest is still under 21.
- **Where life stands.** Market queue `LAYOUT.queueZone` (market frame, east half of the stall); restaurant terrace `LAYOUT.terrace` (restaurant frame); pier crowd `LAYOUT.crowdZone` / `CROWD_SPOTS` (west of the pier mouth and on the pier). The cat, strollers and gulls pick places inside the square.
- **Workers** (`walkPath` in `staff.ts`) go out of the pier lane, across the frontage to the nearest point on the lane's centre line, along the U as far as needed, then across to the door; the lighthouse leaves the lane at its east end and goes through the top-right corner onto the breakwater. Player speed 5.2 and worker speed 2.8 are unchanged; pacing passes unchanged.
- **Boats.** Berths are `LAYOUT.berths`, unchanged: boats lie along the pier with the side a hand from the piles (the boat's x follows its beam, `boatsView.ts`), inner berths at z -9 and outer at -16.8, and the unload point is level with the boat's middle.
- **Draw calls.** At the square on High at midday with all four buildings built, the default camera showed about 525 to 545 calls (the round layout about 490 from its own square, but only part of that town was in view; the compact town is all in view at once). The ground is flat boxes (one draw per material), flat-coloured parts share one vertex-coloured material when baked (`bake` in `kit.ts`), signboards are one material, and background people (strollers, the cat, the named townspeople) leave out the shadow pass. The default camera distance is 23.
- `layout.test.ts` rasterises the ground (0.1 grid, solids grown by the player's radius, turned boxes handled) and checks: rotations, the sea row's front wall on the square's edge, the side rows' front walls on its sides, room between neighbours, width within -20 to 20, no decoration inside the square, workers' routes between every pair of doors cross nothing, every door, interaction point, boat spot and the fishing spot is reachable, the walking distances above, three clear lanes at least 4 wide that meet, every approach clear and reaching a lane, the open middle, and the queue, terrace tables and crowd beside the lanes.
- Usable buildings (`src/view/buildingMarks.ts`): hanging icon signboard lit at night (always facing the camera), doormat and lantern in the building's own turned frame, a ground glow and a floating name plate when the player is near, and bubbles (ready, up arrow, new) worked out from the state. Wording in `MARK_TEXT` in `src/ui/screenText.ts`.
- Collision (`src/view/collide.ts`) pushes the walker out of boxes and discs and back onto the ground (rectangles). Fade: `src/view/occlusion.ts` thins out anything between the camera and the player, in the shader.
- Old saves: unchanged (the layout is not in the save); a player left inside a building is stepped out (`World.stepOut`).

## Town life: done

Sections 1 and 2 (drawing side) and the sound wiring. Item 6 was dropped (the layout is being redone); every position is read from `LAYOUT` (`queueZone`, `terrace`, `crowdZone`, plot doors, `market`), so crowds follow the buildings.

- `src/view/townLife.ts` ties it together; pure rules and caps are in `townRules.ts` (tested). Caps by quality (high/medium/low): queue 4/3/2, diners 6/4/2, pier crowd 8/5/3, extra strollers 4/2/0.
- Queue by day (none at night or in storms), length from stall level, recent sales, prices and market day; the front customer buys a parcel when a crate sells. Terrace: one table (two seats) per restaurant level, lanterns lit at night, diners in proportion to `restaurant.served`, new sitting pose and eat/talk gestures on the shared rig (`pose.sit`, `pose.clap`). Pier crowd for 5+ crates, bigger and clapping or waving for golden fish and the King Fish. Extra strollers grow with rank, some carry a basket or parcel.
- Reactions: ground gulls take off when walked into and settle later; wet cobbles (shared stone materials darken) and puddles after rain, drying over time, splashing; the cat comes to the player near the market and rubs their legs; passers-by look and sometimes wave; signs, nets and the flag sway when brushed; dust on dry stone.
- Sounds wired: `gullsTakeOff`, `catPurr`, `wave`, `splash`, `tableChatter`. Wetness uses the audio's `wetnessStep` with the shared `weatherRain` table.
- Background people do not cast shadows (saves draw calls). Dev hook: `window.__town`.
