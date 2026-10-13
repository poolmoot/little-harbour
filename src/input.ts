/**
 * True when a key press belongs to the form control that has the keyboard and must not act on the game. A text field owns every
 * key (WASD, E, L, M, arrows, and Esc, which cancels the edit). A slider keeps its own arrow keys, but Esc still reaches the game.
 */
export function keyBelongsToField(el: { tagName?: string; type?: string; isContentEditable?: boolean } | null, code: string): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return true;
  if (el.tagName !== 'INPUT') return false;
  return el.type === 'text' || code !== 'Escape';
}

/** Keyboard state. Held keys are cleared when the window loses focus. */
export class Input {
  private down = new Set<string>();
  onPress: (code: string) => void = () => {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (keyBelongsToField(e.target as HTMLElement | null, e.code)) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyL', 'Escape', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.onPress(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    document.addEventListener('visibilitychange', () => this.down.clear());
  }

  clear(): void {
    this.down.clear();
  }

  /** Screen-relative move vector: W = up the screen (-z), D = right (+x). */
  moveVector(): { x: number; z: number } {
    const d = this.down;
    let x = 0, z = 0;
    if (d.has('KeyW') || d.has('ArrowUp')) z -= 1;
    if (d.has('KeyS') || d.has('ArrowDown')) z += 1;
    if (d.has('KeyA') || d.has('ArrowLeft')) x -= 1;
    if (d.has('KeyD') || d.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }
}
