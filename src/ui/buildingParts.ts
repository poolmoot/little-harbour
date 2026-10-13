/** Pieces shared by the building windows. */
import { BUILDINGS } from '../sim/config';
import type { BuildingId } from '../sim/config';
import { buildingMaxLevel, canBuyBuilding, nextBuildingCost } from '../sim/buildings';
import { carryCapacity, handCrates, isSpoiled } from '../sim/crates';
import type { Crate, GameState } from '../sim/state';
import { button, item, priceLabel } from './components';
import { crateArt, crateTitle } from './fishParts';
import { icon } from './icons';
import { BUILDING_ICON, PLOT_TEXT } from './screenText';
import { BUILDING_LABEL, BUILDING_LEVELS, LABEL, denyText } from './text';

export const buildingIcon = (id: BuildingId, size = 28): string => icon(BUILDING_ICON[id], size);

/** The "Make it bigger" row at the bottom of a built building's window. */
export function upgradeRow(s: GameState, id: BuildingId): string {
  const lvl = s.buildings[id];
  const max = buildingMaxLevel(id);
  if (lvl >= max) {
    return item({ art: icon('star', 30), title: BUILDING_LABEL.level(lvl, max), sub: PLOT_TEXT.fullyBuilt, right: button({ label: LABEL.maxed, tone: 'gold', size: 'sm', off: true }) });
  }
  const chk = canBuyBuilding(s, id);
  const cost = nextBuildingCost(s, id)!;
  return item({
    art: icon('hammer', 30),
    title: `${PLOT_TEXT.upgradeTitle} · ${BUILDING_LABEL.level(lvl, max)}`,
    sub: PLOT_TEXT.upgradeNext(lvl + 1, BUILDING_LEVELS[id][lvl]),
    right: button({ label: chk.ok ? priceLabel(cost) : denyText(chk.reason, chk.needRank), act: 'build', a: id, off: !chk.ok }),
  });
}

/** Level text for the window note: "Level 1 of 3. Holds 12 crates." */
export const levelNote = (s: GameState, id: BuildingId): string => `${BUILDING_LABEL.level(s.buildings[id], buildingMaxLevel(id))}. ${BUILDING_LEVELS[id][s.buildings[id] - 1]}`;

/** A fish row with the crate's art and name. */
export const fishArt = (c: Crate, size = 26): string => crateArt(c, size);
export const fishName = (c: Crate): string => crateTitle(c);

/** Crates the player carries that can go into a store or the smokehouse: fresh or not, but not smoked fish and not the King Fish. */
export const storable = (s: GameState): Crate[] => handCrates(s).filter((c) => !c.smoked && !c.king);
/** Crates that can be smoked: also not gone bad. */
export const smokable = (s: GameState): Crate[] => storable(s).filter((c) => !isSpoiled(c));
export const handsFull = (s: GameState): boolean => handCrates(s).length >= carryCapacity(s);
export const rankOfBuilding = (id: BuildingId): number => BUILDINGS[id].rank;
