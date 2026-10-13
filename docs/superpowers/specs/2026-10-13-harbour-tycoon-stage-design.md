# Little Harbour — Tycoon Stage Design

Date: 2026-10-13. Builds on the MVP and business-stage specs in this
folder. Where they disagree, this one wins.

## Goal

Make the game play like a tycoon game: the player always has a clear next
goal, the harbour grows building by building, each day is a little
different, and there is an ending to work toward.

All player-facing words follow the simple-English rule and live in
`src/ui/text.ts`. Numbers below are starting points; the scripted player
decides the final values, which are written back into this file.

Build in the order of the numbered sections. Each section is complete and
playable on its own.

## 1. Goals

A chain of about 25 goals, shown one at a time in the HUD with a short line
of text and a reward. Finishing a goal pays its reward, plays a sound, and
shows the next one.

- The first six are the guided start, and each has a bouncing arrow over
  the place to go: send the boat out, unload it, sell at the market, catch a
  fish from the pier end, buy more crate space, fill an order.
- Later goals follow the growth of the business: reach each rank, hire a
  worker, buy a second boat, hire a captain, reach the Coral Reef, build
  each building, survive a storm trip, finish a contract, sell 100 crates,
  catch every fish in a zone, light the lighthouse, catch the King Fish.
- Goals already met when they come up complete at once (old saves).
- Rewards are small early (10–50) and scale to about 5% of the cost of the
  thing the goal asks for.

## 2. Buildings

Four empty plots on the quay, each with a "For sale" sign. Walking up and
pressing E opens a panel to build and later upgrade. Each building has
three levels.

| Building | Needs rank | What it does | Level 1 / 2 / 3 |
|---|---|---|---|
| Cold store | Boat Owner | Holds crates that spoil very slowly (100 freshness over 20 minutes). Replaces nothing; the ice box stays. | 12 / 24 / 40 crates |
| Smokehouse | Boat Owner | Turns a fresh crate into a smoked crate after a wait. Smoked fish sells for 1.6× the base price, ignores freshness and never spoils. | 2 / 4 / 6 racks; 45 / 35 / 25 s per crate |
| Restaurant | Small Company | Buys crates that are at least 80% fresh for 2× the base price, without lowering the market price level. Pays 10% more for each different fish it has been served that day. | 6 / 12 / 20 crates a day |
| Lighthouse | Fleet Boss | Lets boats sail at night. Needed for the King Fish. One level only. | — |

Final costs (tuned, see "Final numbers"): Cold store 600 / 2,000 / 6,000;
Smokehouse 900 / 3,000 / 8,000; Restaurant 3,000 / 9,000 / 22,000;
Lighthouse 12,000.

Smoked crates share the price level of their fish. A crate cannot be smoked
twice.

**Workers** follow simple rules, in this order, set up in the Hire panel:

1. Restaurant, if it is built, still buying today, and the crate is fresh
   enough. Most valuable first.
2. Smokehouse, if a rack is free and the fish is ticked on the "Smoke
   these" list (the player ticks fish; herring and mackerel are ticked to
   start).
3. Otherwise the market or the storage, as the player has chosen (storage
   now means the cold store first, then the ice box).

Workers also carry finished smoked crates to the market. The player can do
all of this by hand.

## 3. Weather and special days

The next day's weather is rolled each evening and shown in the day report
and in the HUD.

| Weather | Chance | Effect |
|---|---|---|
| Calm | 45% | none |
| Good wind | 20% | trips 20% shorter |
| Fog | 20% | trips 25% longer |
| Storm | 15% | Open Sea and Deep Sea trips bring 50% more crates, but each has a 25% chance to come back damaged with no catch. A damaged boat cannot sail until it is fixed at the shipyard: 60 s and 5% of its boat-size cost. Shallow Water and Coral Reef are safe. No storms before day 4. |

Captains ask nothing; the player decides per boat whether it sails in a
storm with a "Stay home in storms" tick in the boat panel (ticked by
default).

Special days, told one day ahead: **Market day** (about one day in six, all
market prices 1.5×) and **Big catch** (about one day in five, one named
zone gives 2 extra crates per trip).

The sim exposes the weather and special day in the state so the graphics
agent can draw them later. This stage only adds the HUD icon and text.

## 4. Contracts

A second tab on the notice board. One contract at a time, offered from a
choice of two: deliver a large number of crates of one fish (fresh or
smoked) within two or three days, counted automatically as they are sold at
the market. Reward: 1.5× the base value of the crates (smoked crates count at the
smoked price), paid at the end on top of what the crates sold for.
Missing the deadline pays nothing and the board is empty for one day.
Sizes scale with what the fleet can catch in the time.

## 5. HUD additions

Money earned per minute (averaged over the last two minutes), the current
goal, and the weather with tomorrow's weather.

## 6. The ending

With the lighthouse lit, each Deep Sea trip made at night has a small
chance (4% at best: a base 2% times the boat's rare-fish multiplier, so Nets and a Lucky captain raise it) to bring back
the King Fish as a special crate. Carrying it to the inn ends the story: a
screen shows days played, money earned, fish caught and boats owned, with a
button to keep playing. The King Fish then hangs on the inn wall.

## Pacing

Extend the scripted player to use buildings, weather choices and contracts.
Targets for active play: Harbour Boss at about 75 minutes, the King Fish at
about 90–100 minutes, and at no point more than about 4 minutes with nothing
affordable to work toward. Keep the earlier rank windows.

## Saving

Save version bump with a migration; an old save must load with money, boats,
staff, rank and fish book intact.

## Drawing

Placeholders only, built from the helpers in `src/view/kit.ts`: the plots
and signs, a simple model per building that changes a little per level, the
goal arrow, the King Fish on the inn wall. Each is listed in `AGENTS.md`
under "Waiting for the graphics agent". No weather visuals in this stage.

## Build order across agents

The HUD and panels are being rebuilt by the graphics agent on a separate
branch. So this stage lands in two steps:

1. **Rules first (now):** everything above in `src/sim/` with tests, the
   wording in `src/ui/text.ts`, the scripted player and pacing, and the save
   migration. No changes to `src/ui/hud.ts`, `src/ui/panels.ts` or
   `src/ui/styles.ts`. The new features are reachable through `__debug`
   helpers only.
2. **Screens second (after the new UI is merged):** the goal tracker,
   weather and money-per-minute in the HUD, the building panel, the
   contracts tab, the "Smoke these" list and storm tick, the ending screen,
   and the placeholder models and plots.

## Out of scope

Sound and music (next stage), captains who improve with experience,
multiple save slots, anything online.

## Final numbers (step 1, tuned with the scripted player)

All of these live in `src/sim/config.ts`.

| Thing | Value |
|---|---|
| Building costs | Cold store 600 / 2,000 / 6,000. Smokehouse 900 / 3,000 / 8,000. Restaurant 3,000 / 9,000 / 22,000. Lighthouse 12,000. |
| Building ranks | Cold store and Smokehouse: Boat Owner (1). Restaurant: Small Company (2). Lighthouse: Fleet Boss (3). |
| Cold store | 12 / 24 / 40 crates; 100 freshness lost in 1,200 s (20 minutes). |
| Smokehouse | 2 / 4 / 6 racks; 45 / 35 / 25 s a crate; sells at 1.6×; a rack stays taken until the crate is collected. |
| Restaurant | 6 / 12 / 20 crates a day; 2× base price; fresh 80% or more; +10% per other fish served that day. |
| Contracts | Open at Boat Owner. Two offers; 2 or 3 days; reward 1.5× base value; size = 35% of what the fleet could catch of that fish in the time (4 to 60 crates); a missed deadline pays nothing and the board stays empty for one day. |
| King Fish | Base chance 2% per night Deep Sea trip, times the boat's rare-fish multiplier (Nets 1.5 / 2.2, Lucky captain 1.25): 4.4% for a fully netted boat. Found once only. |
| Goal rewards | 10 to 50 for the first nine, then 40 to 150 mid game, 250 to 600 late, 1,000 for the King Fish. Paid on top of earnings and counted for rank. |
| Weather, special days, repair | As in the tables above. Repair costs 5% of the boat's size value (rowboat price plus the hull steps bought): 35 / 55 / 180 / 405. |

Scripted player (active play, 14 seeds): Beginner to Boat Owner about 3.6
minutes, Small Company 14.3, Fleet Boss 37, Harbour Boss 74 (range 57 to 80).
King Fish at the inn: median 96 minutes (range 66 to 126; about one run in
fifteen takes over 140). The scripted player saves for the restaurant, builds
the lighthouse as soon as it has a Trawler, and sails in storms once it has $400.
Longest stretch with nothing bought, hired or finished: usually 3.5 to 5
minutes, up to 8 minutes while it saves for the restaurant or the lighthouse
(there is always a goal on screen then).

## Choices made where this spec was silent (step 1)

- The sim keeps one new crate kind: the King Fish is a crate with a `king`
  flag (species Golden sturgeon in the data), never sold, never spoils, not
  carried by workers. Smoked crates have a `smoked` flag and never spoil.
- Crates in the cold store and the smokehouse have the new places `cold` and
  `smoke`; the current drawing code shows an unknown place like hands, so the
  screens step must draw these.
- Weather is rolled when a day begins (06:00): tomorrow's forecast becomes
  today's, and a new forecast is rolled. The day report carries both. Day 1 is
  calm; the forecast for day 2 is rolled at the start of a new game. Storms
  need day 4 or later.
- "Stay home in storms" only blocks the Open Sea and Deep Sea. A broken boat
  comes home with no catch, must be unloaded, then repaired at the shipyard
  (`repairBoat`: pay, 60 s). Captains do not repair; the player does.
- The trip's weather, big-catch bonus and night start are fixed when the boat
  leaves. Big catch gives +2 crates in its zone. Storm crates: hold times 1.5,
  rounded.
- Boats may sail at night once the lighthouse is built (captains too). Only a
  Deep Sea trip that left at night can bring the King Fish.
- Goals are finished one after another and paid when met. Old saves skip
  goals they already meet without a reward. Goal rewards have their own line
  in the day's ledger (`stats.rewards`) so `earned` stays sales and bonuses.
- Contract sales count only at the market (smoked contracts need smoked crates).
- Restaurant sales also count for the "sell 100 crates" goal.
- Worker order is restaurant, then collecting finished smoked crates (frees a
  rack), then the smokehouse for ticked fish, then the cold store and the ice
  box if the player chose "storage", otherwise the market.
- Plots (`LAYOUT.plots`): Cold store (-15, 10.5), Smokehouse (15.5, 9.5),
  Restaurant (18.5, 3.5), Lighthouse (19.5, 11.5). Workers stop at the door,
  2 to 2.4 in front. Workers walk along the east-west line z = 7.4.
- The storm goal can wait several days for a storm (storms are 15% of days).
