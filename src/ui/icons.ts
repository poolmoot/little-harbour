/** The UI's illustrated icon set: chunky two-tone SVG drawn on a 32-unit grid. Outlines come from the .ic class. */
const STAR = '16,3 20,12 30,12.5 22,19 25,29 16,23.5 7,29 10,19 2,12.5 12,12';
const HULL = 'M3 20H29L25 28H7Z';

const person = (hat: string, shirt: string) =>
  `<path d="M5 29Q16 15 27 29Z" fill="${shirt}"/><circle cx="16" cy="13" r="6.5" fill="#ffd2a3"/><path d="M8.5 11Q16 1 23.5 11Z" fill="${hat}"/>`;

const ICONS = {
  coin: '<circle cx="16" cy="16" r="12" fill="#ffc21f"/><circle cx="16" cy="15" r="7.5" fill="#ffe36e" stroke="#e08e0b"/>',
  star: `<polygon points="${STAR}" fill="#ffd83a"/>`,
  starOff: `<polygon points="${STAR}" fill="#16306f"/>`,
  shield: '<path d="M16 2L29 7V17Q29 26 16 30Q3 26 3 17V7Z" fill="#2c8cf0"/><path d="M16 5L26 9V13H6V9Z" fill="#6cc0ff" stroke="none"/>',
  sun: '<path d="M16 2V6M16 26V30M2 16H6M26 16H30M6 6L9 9M23 23L26 26M26 6L23 9M9 23L6 26" fill="none" stroke="#ffb11a" stroke-width="3"/><circle cx="16" cy="16" r="8" fill="#ffd83a"/>',
  moon: '<path d="M21 4A12 12 0 1 0 28 21A10 10 0 0 1 21 4Z" fill="#dfe8ff"/>',
  rowboat: `<path d="M5 13L27 25M27 13L5 25" fill="none" stroke="#c98a4a" stroke-width="3"/><path d="M3 17H29L25 26H7Z" fill="#f08a3c"/>`,
  sloop: `<polygon points="17,4 28,18 17,18" fill="#fff"/><path d="${HULL}" fill="#4f9be8"/>`,
  cutter: `<polygon points="17,3 29,18 17,18" fill="#fff"/><polygon points="14,7 14,18 5,18" fill="#cfe3ff"/><path d="${HULL}" fill="#4fc978"/>`,
  trawler: `<rect x="19" y="5" width="4" height="7" fill="#ff8a2a"/><rect x="13" y="10" width="12" height="10" rx="1.5" fill="#fff3d6"/><rect x="16" y="13" width="6" height="4" fill="#45d0ff"/><path d="${HULL}" fill="#ef5a4a"/>`,
  sail: '<path d="M9 4Q26 14 9 27Z" fill="#fff"/><path d="M8 3V29" fill="none" stroke-width="3"/>',
  net: '<circle cx="16" cy="16" r="11" fill="#ff8a2a"/><path d="M6 12H26M6 20H26M12 6V26M20 6V26" stroke="#fff3d6" fill="none" stroke-width="1.5"/>',
  crate: '<rect x="4" y="7" width="24" height="20" rx="2.5" fill="#d9964e"/><path d="M4 14H28M4 20H28" fill="none" stroke="#a9692c"/><rect x="12" y="11" width="8" height="5" rx="1" fill="#ffe36e"/>',
  ice: '<rect x="5" y="9" width="22" height="18" rx="3" fill="#bfe9ff"/><path d="M5 9L10 4H27V22L27 9" fill="#e9f8ff"/><path d="M11 15L15 19M17 14L22 21" fill="none" stroke="#5cc8ff"/>',
  cart: '<rect x="5" y="8" width="20" height="13" rx="2" fill="#d9964e"/><circle cx="11" cy="25" r="4" fill="#5a6784"/><circle cx="21" cy="25" r="4" fill="#5a6784"/><path d="M25 10L30 5" fill="none" stroke-width="3"/>',
  stall: '<rect x="6" y="13" width="20" height="15" fill="#fff3d6"/><path d="M3 14L7 5H25L29 14Z" fill="#ff5a4a"/><rect x="13" y="19" width="6" height="9" fill="#2c8cf0"/>',
  hammer: '<rect x="14" y="11" width="4.5" height="18" rx="2" fill="#c98a4a"/><rect x="6" y="4" width="20" height="9" rx="2.5" fill="#cbd8ea"/>',
  note: '<rect x="7" y="5" width="18" height="23" rx="2.5" fill="#fff3d6"/><path d="M11 12H21M11 17H21M11 22H17" stroke="#c98a4a" fill="none"/>',
  book: '<rect x="6" y="4" width="20" height="24" rx="3" fill="#a55cff"/><polygon points="17,10 18.8,14 23,14.3 19.8,17 20.9,21 17,18.8 13.1,21 14.2,17 11,14.3 15.2,14" fill="#ffd83a" stroke-width="1.4"/>',
  ledger: '<rect x="6" y="4" width="20" height="24" rx="3" fill="#4fc978"/><circle cx="16" cy="16" r="6" fill="#ffc21f"/>',
  lock: '<path d="M10 14V10A6 6 0 0 1 22 10V14" fill="none" stroke-width="3"/><rect x="7" y="14" width="18" height="14" rx="3" fill="#cbd8ea"/>',
  anchor: '<circle cx="16" cy="7" r="3.5" fill="#cbd8ea"/><path d="M16 11V27M6 19Q7 27 16 27Q25 27 26 19M11 15H21" fill="none" stroke="#cbd8ea" stroke-width="3.5"/>',
  dockhand: person('#ffd83a', '#59d32c'),
  swift: person('#4aa3d8', '#ffffff'),
  lucky: person('#4f9a5a', '#ffffff'),
  careful: person('#d9a53a', '#ffffff'),
  thrifty: person('#9a6ab0', '#ffffff'),
} as const;

export type IconName = keyof typeof ICONS;

export const HULL_ICONS: IconName[] = ['rowboat', 'sloop', 'cutter', 'trawler'];

const svg = (inner: string, w: number, h: number, box: string) =>
  `<svg class="ic" width="${w}" height="${h}" viewBox="${box}" aria-hidden="true">${inner}</svg>`;

export function icon(name: IconName, size = 22): string {
  return svg(ICONS[name], size, size, '0 0 32 32');
}

/** A fish in a species colour; a dark silhouette for species not caught yet. */
export function fishIcon(colour: string, size = 22, silhouette = false): string {
  const body = silhouette ? '#16306f' : colour;
  const eye = silhouette ? '' : '<circle cx="9" cy="10" r="1.7" fill="#0b1a44" stroke="none"/>';
  return svg(
    `<polygon points="27,12 38,4 38,20" fill="${body}"/><ellipse cx="16" cy="12" rx="13" ry="8" fill="${body}"/>${silhouette ? '' : '<path d="M8 16Q16 21 24 15" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/>'}${eye}`,
    Math.round(size * 1.6), size, '0 0 40 24',
  );
}
