# Money depth: costs that grow, captains who learn, town projects

Date: 2026-10-21. Builds on the business and tycoon specs. Where they disagree, this one wins.

## Why

The scripted player showed that money stops mattering after the middle hours:

- Trip costs were 3 to 8 in 100 of what a trip earns. A captain cost 40 a day while one Deep Sea trip earns about 1,100.
- Nothing big is left to buy after the lighthouse, so the last half hour before the King Fish is waiting.

Three changes fix this. All rules live in `src/sim/`, all numbers in `config.ts`.

## D. Trip costs grow with the boat

A trip now costs a fixed part plus a part for each crate the boat can carry
(food and ice for the catch): `tripCost + crateCost × hold size`, rounded.

| Zone | Fixed | Per crate | Rowboat hold 4 | Hold 12 |
|---|---|---|---|---|
| Shallow Water | 1 | 0.5 | 3 | 7 |
| Coral Reef | 4 | 4 | 20 | 52 |
| Open Sea | 10 | 12 | 58 | 154 |
| Deep Sea | 30 | 60 | 270 | 750 |

The first trip still costs 3, so a new game cannot get stuck. Trips cost about
10 to 15 in 100 of what they earn.

## A. Captains who get better, and boats that need care

**Experience.** A captain counts the trips they finish. Levels 1 to 5 come at
0, 8, 20, 40 and 70 trips. Each level above 1 gives the boat 8 in 100 better
fish (the same lever as Nets) and makes trips 3 in 100 shorter.

**Pay.** Pay depends on the boat and the captain's level, not a fixed 40:
`wage by hull (40, 120, 500, 1500) × (1 + 0.25 per level above 1)`, times 0.7 for
a Thrifty captain. A level 5 captain on a Trawler asks 3,000 a day, roughly 5 to
10 in 100 of what that boat earns once the lighthouse is lit. Moving a captain to
a bigger boat raises the pay.

**Experienced people at the inn.** From rank 2, some candidates already have
experience: 3 in 10 are level 2, 1 in 10 is level 3. They cost more from the
first day. This gives a real choice between a cheap beginner and a costly
expert.

**Boat care.** At 06:00 each boat costs a little care by hull size:
0, 25, 120, 500. It is paid with the wages and shown on its own line in the day
report. If there is not enough money, what there is gets paid and the rest is
forgiven, so it can never cause debt.

## C. Town projects

The town is a little worn. On the notice board a third tab, **Town**, lists
projects the player pays for once. Each gives a lasting bonus. They are the big
money goals after the buildings are done. Two to four of them fit before the King
Fish; the rest are goals for after the ending, when 4 Trawlers with the lighthouse
earn 15,000 to 25,000 a minute.

| Project | Rank | Cost | Lasting bonus |
|---|---|---|---|
| Fix the harbour road | 2 | 3,000 | Workers walk 20 in 100 faster |
| New roof for the fish hall | 2 | 8,000 | Market prices recover twice as fast |
| Paint the old houses | 3 | 25,000 | More visitors: the restaurant pays 25 in 100 more |
| Clear the fair ground | 3 | 50,000 | Market days come twice as often |
| Rebuild the sea wall | 3 | 80,000 | Storms break boats half as often |
| Open the sailing school | 4 | 150,000 | Captains learn twice as fast |
| Build a bandstand | 4 | 300,000 | Golden fish are twice as common |
| Raise the harbour statue | 4 | 600,000 | Every sale pays 5 in 100 more |

Any project open at the player's rank can be bought, in any order. They are
saved in `state.town`.

**Looks.** Each finished project should change the town (a fixed road, a new
roof, painted houses, bunting on the fair ground, a bandstand, a statue). That is
the graphics agent's job and is listed in AGENTS.md under "Waiting for the
graphics agent". The rules do not depend on it.

## Save

Version 7. Older saves load with no projects done, every captain at 0 trips
(level 1), and a zero care line in the day report. The stored `wage` on a
captain is no longer used; pay is worked out each day.

## Pacing

The scripted player buys town projects only after everything else it wants, so
they fill the late game. The pacing test windows do not change.

Tuned result (`npm run tune`, 8 seeds, medians): ranks at 2.7, 13.8, 32.3 and 69.5
minutes (before: 2.7, 13.7, 36.6, 69.3); King Fish at the inn at 91 minutes (before:
101; experienced captains also raise the King Fish chance, which uses the rare-fish
multiplier). Lifetime earnings at the ending fell by about half, so costs now bite.
The first late numbers were far too low: the late game earns much more than a
simple per-trip sum suggests, because captains sail all night once the lighthouse
is lit.

## Second round (same day): more upgrades, plain money, easier start, bigger crates

**More boat upgrades.** Crate space goes to 25 crates (levels 4, 6, 8, 12, 16, 20, 25),
Nets to 4 levels (1.5×, 2.2×, 3×, 4× expensive fish), Speed to 4 levels (trips 85%,
70%, 60%, 50% of the time). The new levels need a bigger boat (`TRACK_LEVEL_HULL`:
Crate space 16 needs the Cutter, 20 and 25 the Trawler; Nets and Speed level 3 need
the Cutter, level 4 the Trawler). Prices in `TRACK_COST`, times the usual boat-size
multiplier. A greyed-out level says which Boat size it needs.

**Prices in money, not percentages.** The market writes each crate's price as lines:
normal price, then each plus or minus in dollars (not fully fresh, big or small fish,
golden, "you sold a lot of it today", market day, statue, order), then "You get". The
lines always add up to the real price (`priceParts` in `sim/market.ts`). Today's prices
show the normal price and how many dollars it is down. The stall upgrades say how many
dollars a $100 fish drops per crate ($6, $4, $2.50) instead of percentages. Upgrade rows
say what you get in plain words: crates brought home, seconds a trip takes, how many
times as many expensive fish.

**Easier start.** Before the first sale, as soon as a fish is in the player's hands
(from the pier or a crate) the guide shows "Sell your fish" and leads to the market
(`shownStep` in `sim/guide.ts`). After that sale it carries on (unload the boat, and
so on). Until the first sale the market window opens with a big gold message, "Here
you sell your fish!".

**Bigger crates on the dock.** Crates share a dock spot, up to 4 (`DOCK_BIN_SIZE`).
Spots use the two outer columns so big crates have room. One crate is drawn a little
bigger than before, 2 as a long double crate, 3 or 4 as one big metal crate. E on a spot
picks up as many as the hands hold, freshest first. Each fish still keeps its own
freshness and price.

Pacing after this round (8 seeds, medians): ranks at 2.7, 13.4, 33.1 and 68.3 minutes;
King Fish at the inn at about 90 minutes.

## Merged with night sailing (2026-10-22)

`main` had meanwhile added night sailing, removed the ice box and cold store (save version 7)
and raised trip times and captain pay. This work sits on top of that: save version 8 (town
projects, captain trips, boat care), captain pay by hull starts at 60, trip times are the
longer night-sailing ones. Because the new Nets and Speed levels and experienced captains gave
more chances at the King Fish, its chance boost is capped at the old best (`KING_MULT_MAX`
2.75) and the base chance is 1.8%. Medians on 8 seeds: ranks at 2.5, 10.0, 27.5 and 50.7
minutes; King Fish at the inn at about 113 minutes.

## Boat sizes up to 6, boat window tabs, short help at the bottom (2026-10-22)

Boat size now has 6 upgrades: after the Trawler come the Big Trawler (30,000), the Fishing
Ship (90,000) and the Flagship (250,000). They need the top rank, fish the same places and
bring home 4, 8 and 14 more crates each trip (`HULL_EXTRA_CRATES`). Captain pay and boat care
grow with them. The boat window has three tabs: Upgrade, Captain, Where to fish. Every window
shows its help line below the content, and help lines are one short sentence.

