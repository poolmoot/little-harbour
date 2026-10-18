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
