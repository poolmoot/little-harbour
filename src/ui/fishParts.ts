/** Shared pieces for showing a crate anywhere: its picture, name, size, stars, the golden look and what the size does to the price. */
import { GOLDEN_MULT } from '../sim/config';
import { crateSize, crateStars, sizeMult } from '../sim/fishbook';
import type { Crate } from '../sim/state';
import { hex, SPECIES_COLOUR } from '../palette';
import { stars } from './components';
import { fishIcon } from './icons';
import { CRATE_TEXT, FISH_NAME, sizeText } from './text';

/** The colour of a golden fish. */
export const GOLD_FISH = '#ffd83a';

/** The fish picture for a crate: golden fish are gold with a glow. */
export function crateArt(c: Crate, size = 26): string {
  return c.golden ? `<span class="gold-art">${fishIcon(GOLD_FISH, size)}</span>` : fishIcon(hex(SPECIES_COLOUR[c.species]), size);
}

/** "Golden Tuna", "Cod (smoked)". */
export const crateTitle = (c: Crate): string => `${c.golden ? `${CRATE_TEXT.golden} ` : ''}${FISH_NAME[c.species]}${c.smoked ? ' (smoked)' : ''}`;

export const goldTag = (): string => `<span class="gold-tag ol">${CRATE_TEXT.golden}</span>`;

/** Stars and size in cm, with a gold tag for golden fish. Empty for the King Fish, which has no size. */
export function crateFacts(c: Crate, starSize = 12): string {
  if (c.king) return '';
  return `<span class="facts">${stars(crateStars(c), 3, starSize)}<span>${sizeText(crateSize(c))}</span>${c.golden ? goldTag() : ''}</span>`;
}

/** What size and the golden shine do to the price, as one plain sentence. */
export function priceEffect(c: Crate): string {
  if (c.king) return '';
  const pct = Math.round((sizeMult(c.species, crateSize(c)) - 1) * 100);
  const size = pct > 0 ? CRATE_TEXT.bigger(pct) : pct < 0 ? CRATE_TEXT.smaller(-pct) : '';
  if (c.golden) return `${CRATE_TEXT.goldenPays(GOLDEN_MULT)}${size ? `, and ${size}` : ''}.`;
  return size ? `Pays ${size}.` : `${CRATE_TEXT.normalSize}.`;
}

/** The row look for a crate: golden rows are gold. */
export const crateRowState = (c: Crate): 'gold' | undefined => (c.golden ? 'gold' : undefined);
