/** The "Show guide tips" switch. Saved on its own, apart from the game save, like picture quality and sound. */
export const GUIDE_TIPS_KEY = 'harbour-guide-tips';

export function loadGuideTips(storage: Pick<Storage, 'getItem'> | null): boolean {
  try { return storage?.getItem(GUIDE_TIPS_KEY) !== 'off'; } catch { return true; }
}

export function saveGuideTips(storage: Pick<Storage, 'setItem'> | null, on: boolean): void {
  try { storage?.setItem(GUIDE_TIPS_KEY, on ? 'on' : 'off'); } catch { /* the choice is kept for this visit only */ }
}
