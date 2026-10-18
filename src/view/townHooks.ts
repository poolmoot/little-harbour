/**
 * What the town-life drawing code needs from the sound side. `game.ts` hands in the real thing (the audio object's effects);
 * the view only ever calls these, so nothing in `src/view/` depends on the audio code.
 */
export interface TownHooks {
  /** Ground gulls were startled. `level` 0.4 to 1 (louder when closer). */
  gullsTakeOff(level: number): void;
  catPurr(seconds: number): void;
  /** A passer-by waved. `level` is how near, `pan` -0.7 to 0.7 for left to right. */
  wave(level: number, pan: number): void;
  /** A step into a puddle. */
  splash(): void;
  /** Diners are chatting; call every second or two. `level` 0 to 1. */
  tableChatter(level: number): void;
}

export const NO_HOOKS: TownHooks = { gullsTakeOff() {}, catPurr() {}, wave() {}, splash() {}, tableChatter() {} };
