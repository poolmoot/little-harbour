import { handCrates } from '../../sim/crates';
import type { GameState } from '../../sim/state';
import { buildingIcon } from '../buildingParts';
import { section } from '../components';
import { LIGHTHOUSE_TEXT } from '../screenText';
import { BUILDING_NAME } from '../text';
import type { ScreenView } from './types';

/** The one line about the King Fish, by how far the player has got. */
export function kingLine(s: GameState): string {
  if (s.king.delivered) return LIGHTHOUSE_TEXT.kingDone;
  if (handCrates(s).some((c) => c.king)) return LIGHTHOUSE_TEXT.kingCarrying;
  if (s.king.found || s.boats.some((b) => b.king)) return LIGHTHOUSE_TEXT.kingOnBoat;
  return LIGHTHOUSE_TEXT.kingHunting;
}

export function lighthouseView(s: GameState): ScreenView {
  return {
    title: BUILDING_NAME.lighthouse,
    icon: buildingIcon('lighthouse'),
    note: LIGHTHOUSE_TEXT.lit,
    body: section(LIGHTHOUSE_TEXT.nightTitle) + `<p>${LIGHTHOUSE_TEXT.night}</p>` + section(LIGHTHOUSE_TEXT.kingTitle) + `<p>${kingLine(s)}</p>`,
  };
}
