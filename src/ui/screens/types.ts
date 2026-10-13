import type { AudioSettings } from '../../audio/settings';
import type { DayStats, GameState } from '../../sim/state';
import type { QualityMode } from '../../view/quality';

export interface TabDef { id: string; label: string }

/** Everything a screen may read to draw itself. Screens never mutate state; buttons carry action ids instead. */
export interface ScreenCtx {
  state: GameState;
  /** Screen argument, e.g. the boat id for the boat screen. */
  arg: number;
  /** Requested tab id ('' on open). */
  tab: string;
  confirmReset: boolean;
  /** Current picture-quality setting (shown in settings). */
  quality: QualityMode;
  summary: { day: number; stats: DayStats } | null;
  /** True when a saved game exists (title screen). */
  hasSave: boolean;
  /** The title screen is asking whether to delete the save for a new game. */
  confirmNew: boolean;
  /** Current volumes and mute switch (settings screen). */
  audio: Readonly<AudioSettings>;
}

export interface ScreenView {
  title: string;
  /** Icon HTML shown beside the title. */
  icon: string;
  tabs?: TabDef[];
  /** Id of the tab being shown. */
  tab?: string;
  /** One line of context under the header. */
  note?: string;
  body: string;
  foot?: string;
  /** A menu screen (title, pause, settings, how to play): no close button, stronger dim, narrower window. */
  menu?: boolean;
  /** Leave out the header bar (the title screen draws its own name). */
  bare?: boolean;
}

export type Screen = (ctx: ScreenCtx) => ScreenView;

/** The requested tab if it exists, otherwise the first one. */
export const pickTab = (ctx: ScreenCtx, tabs: TabDef[]): string => (tabs.some((t) => t.id === ctx.tab) ? ctx.tab : tabs[0].id);
