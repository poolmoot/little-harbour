import { GAME_NAME, GAME_TAGLINE } from './menuText';

/** How long the opening stays on screen before it is removed (its CSS lift ends just before this). */
const INTRO_MS = 3200;

/** The game's badge: a sailboat bobbing on the waves in front of a turning sun. Drawn in code like every other icon. */
export function emblem(size: number): string {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<path d="M${(100 + Math.cos(a) * 52).toFixed(1)} ${(78 + Math.sin(a) * 52).toFixed(1)}L${(100 + Math.cos(a + 0.13) * 74).toFixed(1)} ${(78 + Math.sin(a + 0.13) * 74).toFixed(1)}L${(100 + Math.cos(a - 0.13) * 74).toFixed(1)} ${(78 + Math.sin(a - 0.13) * 74).toFixed(1)}Z"/>`;
  }).join('');
  return `<svg class="emblem" width="${size}" height="${size * 0.8}" viewBox="0 0 200 160" aria-hidden="true">
    <g class="emblem-rays" fill="#ffd83a" stroke="#0b1a44" stroke-width="4" stroke-linejoin="round">${rays}</g>
    <circle cx="100" cy="78" r="44" fill="#ffb11a" stroke="#0b1a44" stroke-width="5"/>
    <g class="emblem-boat" stroke="#0b1a44" stroke-width="5" stroke-linejoin="round">
      <path d="M100 30V108" fill="none"/>
      <path d="M104 34L146 100H104Z" fill="#fff"/><path d="M96 46V100H62Z" fill="#cfe3ff"/>
      <path d="M48 106H152L138 128H62Z" fill="#f08a3c"/><path d="M58 114H142" stroke="#fff3d6" stroke-width="4"/>
    </g>
    <path class="emblem-wave" d="M6 132Q28 118 50 132T94 132T138 132T182 132T226 132V160H6Z" fill="#39d3ff" stroke="#0b1a44" stroke-width="5"/>
    <path class="emblem-wave two" d="M-26 146Q-4 134 18 146T62 146T106 146T150 146T194 146V164H-26Z" fill="#1f8be6" stroke="#0b1a44" stroke-width="5"/>
  </svg>`;
}

/** A short opening when the game starts: the name drops in, then lifts away onto the harbour and the title menu. */
export function playIntro(root: HTMLElement): void {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = `${emblem(260)}<div class="intro-name ol">${GAME_NAME}</div><div class="intro-wave"></div><div class="intro-tag ol">${GAME_TAGLINE}</div>`;
  root.appendChild(el);
  setTimeout(() => el.remove(), INTRO_MS);
}
