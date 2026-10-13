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

Starting costs: Cold store 600 / 2,000 / 6,000; Smokehouse 900 / 3,000 /
8,000; Restaurant 2,500 / 7,000 / 16,000; Lighthouse 12,000.

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
the market. Reward: 2.5× the base value of the crates, paid at the end.
Missing the deadline pays nothing and the board is empty for one day.
Sizes scale with what the fleet can catch in the time.

## 5. HUD additions

Money earned per minute (averaged over the last two minutes), the current
goal, and the weather with tomorrow's weather.

## 6. The ending

With the lighthouse lit, each Deep Sea trip made at night has a small
chance (start at 4%, raised by Nets and by a Lucky captain) to bring back
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
