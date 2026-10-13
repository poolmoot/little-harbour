/** Keyboard state. Held keys are cleared when the window loses focus. */
export class Input {
  private down = new Set<string>();
  onPress: (code: string) => void = () => {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
