# Restaurant business, bigger ships, dearer carts

Date: 2026-10-28. Builds on `2026-10-21-money-depth-design.md`.

## Why

Players reached the top carts and ships too fast, and the late game needs a strong
money engine to pay for the new ships. The restaurant becomes that engine, with its
own upgrades and a live 3D room in its window.

## Prices

| Thing | Before | Now |
|---|---|---|
| Big Cart (6) | $2,500 | $8,000 |
| Horse Wagon (8) | $12,000 | $35,000 |
| Steam Wagon (10) | $40,000 | $120,000 |
| Big Trawler | $30,000 | $60,000 |
| Fishing Ship | $90,000 | $200,000 |
| Flagship | $250,000 | $500,000 |

## Three more boat sizes (Boat size 7-9)

| Size | Price | Extra crates per trip |
|---|---|---|
| Ocean Ship | $1,200,000 | +20 |
| Factory Ship | $3,000,000 | +28 |
| Royal Ship | $7,500,000 | +36 |

Top rank only, same fishing places as the Trawler. Captain pay and boat care grow with
them. Each has its own model (the `ship()` builder in `view/boatModels.ts`).

## Restaurant upgrades

Once the restaurant is built, its window has an Upgrade tab with four upgrades, five
levels each. Each needs the one before it on the same row.

| Upgrade | What it does | Levels 1-5 |
|---|---|---|
| Tables | More fish bought each day | +6, +12, +20, +30, +45 crates |
| Kitchen | Pays more for each fish | ×1.15, ×1.3, ×1.5, ×1.75, ×2 |
| Waiters | Takes fish that are less fresh | 70%, 60%, 50%, 40%, 30% fresh (was 80%) |
| Decoration | Guests buy drinks: money every morning | $300, $800, $2,000, $5,000, $12,000 a day |

Costs (per level): Tables 4k, 10k, 25k, 60k, 150k; Kitchen 5k, 12k, 30k, 75k, 180k;
Waiters 3k, 8k, 20k, 50k, 120k; Decoration 6k, 15k, 40k, 100k, 250k. Drinks money counts
as earnings (rank) and has its own line in the day report. Save version 10 adds
`restaurantUp` and the drinks line; older saves start at level 0.

## The 3D room

The restaurant window shows a small isometric room (like a doll's house with two walls),
drawn by its own small renderer while the window is open. While it shows, the harbour is
not redrawn, so the computer does no extra work. The room follows the upgrades: more
tables with Tables, a bigger counter and a cook with Kitchen, more waiters walking
between counter and tables with Waiters, and paintings, lanterns, a bottle shelf and
plants with Decoration. Guests sit at tables; how many depends on how much of today's
fish has been served. Simple flat-coloured boxes, the shared people figures, no shadows.
