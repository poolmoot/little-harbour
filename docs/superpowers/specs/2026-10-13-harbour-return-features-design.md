# Harbour return features (rules only)

Three reasons to come back: the harbour earns while you are away, a deeper fish book (sizes, stars, golden fish), and names. This note covers the rules in `src/sim/`; screens come separately. Save version is now 5. Numbers are in `src/sim/config.ts`; wording is in `src/ui/text.ts` (`AWAY`, `FISH_BOOK`, `NAME_PROBLEM`, `NAME_LABEL`, `starText`, `sizeText`).

## 1. Earnings while away

- The save holds `savedAt` (wall-clock milliseconds). The caller gives it: `saveGame(state, storage, Date.now())`. The sim never reads the clock. No stamp (0) means no away earnings.
- `loadGameWithAway(storage, rng, now)` loads, then works out seconds away = (now - savedAt) / 1000.
- Under 60 s is ignored (result null). Time counts up to 8 hours.
- Rate: if no boat has a captain, the rate is 0. Otherwise a copy of the state (with a copy of the seeded random generator, `Rng.clone()`) runs through the real `step()` for one in-game day (360 s) with the player doing nothing. Crates on the quay and boat catches waiting to unload are cleared first so one-off stock does not inflate the rate. Net = sales and bonuses minus wages minus trip costs, summed over the day (including the day roll), never below 0. Rate per second = net / 360.
- Credit = floor(rate x seconds away x 0.5). It goes into money, lifetime earnings (so it counts toward rank; a `rankUp` event can follow) and its own line `stats.away` (not part of `stats.earned`; `netProfit` includes it).
- The live state keeps its clock, crates, boats and random stream.

| Name | Value |
| --- | --- |
| AWAY_MIN_SECONDS | 60 |
| AWAY_MAX_SECONDS | 28800 (8 h) |
| AWAY_SHARE | 0.5 |
| AWAY_SIM_SECONDS | 360 |

## 2. Fish book

- Every crate has a size in cm (`crate.size`). Sizes per species are in `FISH_SIZE` (herring 15-30, mackerel 20-45, flounder 25-50, seabass 30-80, snapper 30-90, lobster 20-50, cod 40-120, tuna 80-250, swordfish 150-450, anglerfish 30-100, squid 30-120, sturgeon 100-300). Roll: three random numbers added (bell-ish), stretched a little and clamped, so middle sizes are common.
- Price: smallest fish -10%, middle size normal, biggest +20% (linear each side). Applies to fresh and smoked crates.
- Stars: 1 star below 60% of the range, 2 from 60%, 3 from 90% (about 6% of crates).
- Golden: `crate.golden`. Chance 2% per crate x the same multiplier that raises rare fish (Nets level and Lucky captain), capped at 20%. Pier fish use the plain 2%. Golden sells for 5x (on top of size). Workers never send a golden crate to the smokehouse; `smokeCrate` also refuses it. Golden crates are not served at the restaurant either (the market pays more).
- Smoked and King Fish crates work as before (the King Fish still sells for nothing and is not rolled for size).
- Book entry per species: `caught`, `biggest` (cm, 0 = none), `bestStars` (0-3), `golden` (count), `bestSale`. `bookCompletion(state)` gives species seen, 3-star species and golden species out of 12.
- Zone rewards, paid once each as goal-style rewards (count toward money and rank, line `rewards`): every fish of a zone caught: 25 / 75 / 200 / 500 (shallows, reef, open sea, deep sea). 3 stars on every fish of a zone: 100 / 300 / 800 / 2000. `state.bookClaims[zone]` remembers what was paid.
- Old saves: crates without a size get the middle of the range and are never golden; zones already complete are marked paid without paying.

## 3. Names

- `state.harbourName` (default "Little Harbour"), `boat.name`. Actions `setHarbourName(state, name)` and `renameBoat(state, boatId, name)`; `checkName(raw)` for live checks.
- Rules: trimmed, 1 to 16 characters, letters (any language), digits, spaces and the marks `' . , ! & -`.

## Pacing

The 5x golden fish raised income about 15 to 20 percent, so rank thresholds went from 0 / 500 / 3000 / 15000 / 60000 to 0 / 500 / 3300 / 18000 / 72000. Scripted player, median of 8 seeds: ranks at 3.1 / 13.6 / 35.1 / 68.0 minutes, King Fish at the inn at 89.9 minutes (before the change: 3.3 / 14.3 / 37.1 / 74.4 and 96.2). Existing rank tests had their literal numbers moved to the new thresholds.

## For the screens agent

New state fields: `state.savedAt`, `state.harbourName`, `state.bookClaims`, `state.stats.away`, `state.book[species].{biggest, bestStars, golden}`, `crate.size`, `crate.golden`, `boat.catchInfo` (sim use).

Read-only: `awayEarnings(state, secondsAway, rng)` (preview, changes nothing), `bookCompletion(state)`, `crateSize(c)`, `crateStars(c)`, `starsFor(species, size)`, `sizeMult(species, size)`, `zoneFish(zone)`, `checkName(raw)` (`{ok, name?, problem?: 'empty'|'long'|'chars'}`), `crateValue` (already includes size and golden), `FISH_SIZE`, `BOOK_REWARD_CAUGHT`, `BOOK_REWARD_STARS`, `NAME_MAX`.

Actions: `setHarbourName(state, name)`, `renameBoat(state, boatId, name)`, `applyAway(state, secondsAway, rng)` and `loadGameWithAway(storage, rng, now)` (returns `{ state, away, events }`; `away` is `{ seconds, earned, perMinute }` or null).

Events: `awayEarnings {seconds, earned, perMinute}`, `goldenCaught {species}`, `bookReward {zone, kind: 'caught'|'stars', amount}`, `harbourRenamed {name}`, `boatRenamed {boatId, name}`.

To switch on earnings while away, in `src/game.ts`: pass `Date.now()` as the third argument of `saveGame(...)`, and load with `loadGameWithAway(storage, rng, Date.now())` instead of `loadGame(storage, rng)`, then send its `events` through the event handler and show `away` on a welcome-back screen when `away.earned > 0`.
