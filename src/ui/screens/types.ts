import type { DayStats, GameState } from '../../sim/state';

export interface TabDef { id: string; label: string }

/** Everything a screen may read to draw itself. Screens never mutate state; buttons carry action ids instead. */
export interface ScreenCtx {
  state: GameState;
  /** Screen argument, e.g. the boat id for the boat screen. */
  arg: number;
  /** Requested tab id ('' on open). */
  tab: string;
  confirmReset: boolean;
  summary: { day: number; stats: DayStats } | null;
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
}

export type Screen = (ctx: ScreenCtx) => ScreenView;

/** The requested tab if it exists, otherwise the first one. */
export const pickTab = (ctx: ScreenCtx, tabs: TabDef[]): string => (tabs.some((t) => t.id === ctx.tab) ? ctx.tab : tabs[0].id);
