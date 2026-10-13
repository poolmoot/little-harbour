/** Pure rules for the title / playing / paused states and what Esc does in each. */
import type { PanelKind } from './panels';

export type Mode = 'title' | 'play' | 'paused';
export type EscAction = 'pause' | 'resume' | 'close' | 'back' | 'none';

/** Screens that belong to the menus (as opposed to in-game windows). */
export const MENU_KINDS: readonly PanelKind[] = ['title', 'pause', 'settings', 'howto'];
export const isMenuKind = (k: PanelKind | null): boolean => k !== null && MENU_KINDS.includes(k);

/** While halted the simulation, the clock and the music do not move. */
export const isHalted = (mode: Mode): boolean => mode !== 'play';

/** What Esc should do, given the mode and the screen that is open (null when none). */
export function escapeAction(mode: Mode, open: PanelKind | null): EscAction {
  if (open === 'settings' || open === 'howto') return 'back';
  if (mode === 'title') return 'none';
  if (mode === 'paused') return open === 'pause' ? 'resume' : 'none';
  return open === null ? 'pause' : 'close';
}
