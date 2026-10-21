/** The HUD and windows were laid out for a 1100 x 650 window; larger windows scale them up so text stays readable. */
const BASE_W = 1100, BASE_H = 650;
const MAX_HUD = 1.8, MAX_WINDOW = 1.6;

export function uiZoom(width: number, height: number, max = MAX_HUD): number {
  return Math.min(max, Math.max(1, Math.min(width / BASE_W, height / BASE_H)));
}

/** Keep the CSS scale factors in step with the window size. */
export function trackUiScale(): void {
  const apply = () => {
    const s = document.documentElement.style;
    s.setProperty('--ui-zoom', uiZoom(innerWidth, innerHeight).toFixed(3));
    s.setProperty('--win-zoom', uiZoom(innerWidth, innerHeight, MAX_WINDOW).toFixed(3));
  };
  apply();
  addEventListener('resize', apply);
}
