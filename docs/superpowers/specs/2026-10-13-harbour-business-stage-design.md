# Little Harbour — Business Stage Design

Date: 2026-10-13. Builds on the MVP spec in this folder. Where the two
disagree, this one wins.

## Goal

Put the player in the owner's seat. The harbour is a production chain:

    boats catch → dock unloads → crates are hauled → market sells

The player starts by doing every step by hand (the MVP), then spends profit
on removing whichever step is the bottleneck: better boats, more boats,
captains to sail them, dockhands to haul. The fun is spotting the
bottleneck, choosing what to buy next from two or three competing options,
and watching the harbour get visibly bigger and busier.

Success: at every point in a 60–70 minute playthrough there are at least two
affordable-soon purchases competing for the player's money, and each
purchase changes what is seen on screen.

## Fleet

- Up to 4 berths along the pier (2 exist; add 2 further out). The player
  buys each new boat as a rowboat.
- Every boat is upgraded on its own. The old global Hold and Hull upgrades
  are removed; saved games migrate their levels onto every owned boat.

| Track | Levels | Effect | Seen on the boat |
|---|---|---|---|
| Hull | Rowboat, Sloop, Cutter, Trawler | Unlocks Shallows, Reef, Open Sea, Deep | A different, larger model each tier: oars; one mast and sail; two sails; cabin, mast and winch |
| Hold | 4, 6, 8, 12 crates | Catch per trip | Crates stacked on deck |
| Gear | 0, 1, 2 | Rare-fish weights ×1, ×1.5, ×2.2 | Nets and floats on the gunwale |
| Sails | 0, 1, 2 | Trip time ×1, ×0.85, ×0.7 | Bigger or extra sail, pennant |

Hold, Gear and Sails cost more on a higher hull tier.

## Zones and fish

| Zone | Trip | Needs hull | Fish (base price, weight) |
|---|---|---|---|
| Shallows | 25 s | Rowboat | as MVP |
| Reef | 50 s | Sloop | as MVP |
| Open Sea | 80 s | Cutter | Cod 60 (50), Tuna 110 (35), Swordfish 220 (15) |
| Deep | 120 s | Trawler | Anglerfish 160 (50), Giant squid 260 (35), Golden sturgeon 800 (15) |

"Rare" for the Gear multiplier means the lowest-weight species in a zone.
Orders may ask for any species the player's fleet can reach.

## Staff

Hired from a new Hire panel at the inn. Wages are paid at 06:00. If the
player cannot pay everyone, unpaid staff do not work that day; there is no
debt.

- **Captain** (one per boat, base wage 40 a day). A captained boat sails to
  its assigned zone by itself, unloads its catch onto the dock on return,
  and sails again, during daylight only. Three candidates are on offer and
  change each day. Each has one trait: Swift (trip time −15%), Lucky (rare
  weights +25%), Careful (hold +1), Thrifty (wage −30%). The captain is seen
  standing in the boat.
- **Dockhand** (up to 4, wage 25 a day). Dockhands carry crates from the
  dock, 2 at a time (4 with the Handcart upgrade, which now applies to them
  and shows a cart). A harbour-wide haul policy, set in the Hire panel,
  sends crates either to the market to be sold at the current price or to
  the ice box until it is full. They pick the freshest valuable crates
  first. They are seen walking the pier and quay carrying crates.

The player can still do every job by hand and can fire staff at any time.

## The boat panel

Interacting with a docked boat opens one panel for that boat: its name,
hull tier and stats, the zone it is assigned to (with the fish there and the
trip time), its four upgrade tracks with cost and a short "what changes"
line, and its captain. Without a captain, a Send button dispatches it once,
as now.

## Market stall upgrade

Two levels, bought at the shipyard. The demand drop per crate sold goes from
0.06 to 0.04 to 0.025. The stall gets visibly wider with more trays.

## Harbour rank

Rank comes from lifetime earnings and is shown in the HUD with a progress
bar. A rank-up shows a banner.

| Rank | Lifetime earnings | Unlocks |
|---|---|---|
| Beginner | 0 | MVP content |
| Boat Owner | 500 | Dockhands, second boat, Sloop hull |
| Small Company | 3,000 | Captains, third berth, Cutter hull, market stall I |
| Fleet Boss | 15,000 | Fourth berth, Trawler hull, market stall II |
| Harbour Boss | 60,000 | Title and a golden weathervane on the inn |

## End-of-day ledger

The 06:00 summary becomes a ledger: income by fish, bonus from orders,
wages, trip costs, money spent on upgrades, crates spoiled, net profit for the day, the
best single sale, and the rank progress.

## Pacing

Costs are tuned against a scripted player. A test drives the pure simulation
with a simple greedy bot (always buys the cheapest available thing that
raises income, keeps boats sailing, hauls or lets dockhands haul) and
reports the time to each rank. Targets for active play: Boat Owner about 5
minutes, Small Company about 15, Fleet Boss about 35, Harbour Boss about
70, each within 30%. Costs and prices are adjusted until the bot lands in
those windows, and the final numbers are written back into this section's
table by the builder.

### Costs (tuned)

Tuned against the scripted player (`src/sim/bot.ts`, run by `pacing.test.ts`).
Median time to rank over eight seeds: Boat Owner 3.8 min, Small Company 18.9,
Fleet Boss 39.1, Harbour Boss 69.4 (targets 5 / 15 / 35 / 70). Fish
prices are unchanged from the MVP except the Deep zone, which was too rich
(an average Deep fish paid about 5 times an Open Sea fish) and is now about
2.7 times. The Trawler was lowered from 10,000 to 4,500: at the old price the
scripted player never bought one before the top rank; now it buys three.

| Item | Cost |
|---|---|
| Hull: Sloop / Cutter / Trawler | 400 / 2,500 / 4,500 |
| Hold II / III / IV (rowboat prices) | 110 / 450 / 1,200 |
| Gear I / II (rowboat prices) | 350 / 950 |
| Sails I / II (rowboat prices) | 350 / 800 |
| Hold, Gear, Sails multiplier by hull: Rowboat / Sloop / Cutter / Trawler | ×1 / ×1.6 / ×2.6 / ×4 |
| Boat 2 / 3 / 4 (bought as a rowboat) | 700 / 2,200 / 6,000 |
| Ice box / Handcart | 120 / 200 |
| Market stall I / II | 2,000 / 9,000 |
| Captain wage (Thrifty) / dockhand wage, per day | 40 (28) / 25 |
| Hiring fee | none |
| Trip cost (food and supplies, paid when a boat leaves): Shallows / Reef / Open Sea / Deep | 3 / 10 / 30 / 80 |
| Money in a new game | 10 |

Trip costs are paid by the player when a boat leaves. If there is not enough
money the boat stays in harbour and the player is told so. A captained boat
pays automatically and simply waits at its spot until it can pay. Pier
fishing is free, so the player can never get stuck. The scripted player
sends each boat to the best zone it can afford and keeps enough money back
to pay the next trips before it shops.

Per-boat upgrades can be bought while the boat is at sea or in harbour, so a
captained boat, which is almost never idle at the berth, can still be upgraded.

## Out of scope

Processing buildings (smokehouse, warehouse), contracts and reputation,
storms, captain levelling, sailing the boat by hand, music.

## Architecture notes

- All rules stay in `src/sim/`, pure and unit tested. New modules: `fleet`
  (per-boat upgrades), `staff` (captains, dockhands, wages, haul policy),
  `rank`, `ledger`. Dockhand movement is simulated in the sim as timed jobs
  (walk time derived from distances in `LAYOUT`), and the view animates
  figures to match.
- The save format gets a version bump with a migration from the MVP save.
- `window.__debug` gains `skip(seconds)`, which steps the simulation
  forward, because a hidden browser tab pauses animation frames.
