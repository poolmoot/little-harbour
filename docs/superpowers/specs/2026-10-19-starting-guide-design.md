# Starting guide

## Why
A new player only had a small goal tracker and an arrow. The guide tells them where to go and how things work, one step at a time, and then introduces each later system the first time it opens up.

## One guide, one source of truth
The rules are in `src/sim/guide.ts` (saved in `state.guide`, save version 6). The goal chain in `goals.ts` is unchanged and keeps paying rewards. Both read the same counters (`state.tally`), so they cannot disagree. While a guide card is on screen it takes the place of the goal panel in the HUD. The old 3D bouncing goal arrow is retired; the ground trail is the only pointer. The earlier separate "coach" tutorial is merged in: `src/ui/coach.ts` now only draws the button ring and the edge arrow, driven by the guide's step.

Choice: the guide reads the existing goal counters instead of replacing the first six goals. That is the smaller change, keeps the pacing test and rewards as they were, and means older saves need no goal changes.

## Steps (each ends from real state, never a timer)
1. Walk (about 6 metres walked, or a boat already sent) 2. Send the boat (`tally.dispatched`) 3. Fish at the pier (a pier fish, or the boat is already back) 4. Unload (`tally.unloaded`) 5. Pick up crates (crates in hand) 6. Sell (`tally.sold`) 7. Crate space at the shipyard (any hold level 1) 8. Read the notice board (window opened, or an order filled).
Steps that are already true are skipped over.

## Gentle rule
Until the first sale of a new game, crates do not lose freshness (`isGentle`). Nothing else changes.

## Never point at what cannot be done
`guideAdvice` (sim) checks the step: if the trip (step 2) or crate space (step 7) costs more than the player has, or it is night, the card shows "$have / $cost" and the next way to earn: unload a waiting boat, carry crates to the market, pick up crates, send the boat again if affordable, otherwise fish from the pier. The first crate-space level costs $110 (was $300) so it is reachable after two or three trips.

## Unlock cards
Workers (rank 1), captains (rank 2), the four buildings (their rank), contracts, weather (first non-calm day today or tomorrow), fish book (3 fish caught), and earnings while away. They wait until after the first sale, come one at a time at least 45 game seconds apart, show the trail once, and are remembered in `guide.seen`.

## Help any time
A "?" tile in the HUD opens the list of every guide and card seen so far, each with Show me (card and trail again). The same list is in the title and pause menus ("Guide tips"). Settings has "Show guide tips" (saved apart from the game save); when off, no cards, trail, rings or welcome appear.

## Old saves
Version 5 and older: a save with a sale or any lifetime earnings has the opening marked done, is not welcomed again and keeps normal freshness; cards for systems it already uses are marked seen, the rest may still arrive. A save with no progress starts the guide at step 1.

## Trail
`src/view/guideTrail.ts`: one instanced mesh of glowing dots along a walkable route (grid search, straightened), fading out as the player arrives. Targets come from `LAYOUT` and the interaction points in `src/guideTargets.ts`.
