/** Reusable UI parts. Each is a pure function from data to an HTML string, so screens stay declarative and testable. */
import { icon } from './icons';

export type Tone = 'go' | 'gold' | 'info' | 'danger' | 'ghost';
export type MeterTone = 'cyan' | 'green' | 'amber' | 'red' | 'gold';
export type CardTone = 'orange' | 'blue' | 'purple' | 'green' | 'gold' | 'teal' | 'grey';

const cls = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Make a typed name safe to put in HTML. */
export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const money = (n: number): string => Math.round(n).toLocaleString('en-US');
/** A multiplier without trailing zeros: 1.50 -> "1.5". */
export const mult = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');

export interface ButtonOpts {
  label: string;
  /** Action id handled by the window manager, with up to two arguments. */
  act?: string;
  a?: string | number;
  b?: string | number;
  tone?: Tone;
  /** Shown greyed out and ignores clicks. */
  off?: boolean;
  size?: 'sm' | 'lg';
  wide?: boolean;
}

export function button(o: ButtonOpts): string {
  const data = `${o.act ? ` data-act="${o.act}"` : ''}${o.a !== undefined ? ` data-a="${o.a}"` : ''}${o.b !== undefined ? ` data-b="${o.b}"` : ''}`;
  return `<button class="${cls('btn ol', o.tone && o.tone !== 'go' && o.tone, o.size, o.wide && 'wide', o.off && 'off')}"${data}>${o.label}</button>`;
}

/** Button label for a purchase: a coin and the price, or the reason it is unavailable. */
export const priceLabel = (cost: number): string => `${icon('coin', 16)}${money(cost)}`;

export function meter(frac: number, tone: MeterTone, label = '', extra = ''): string {
  return `<div class="${cls('well meter', tone, label && 'tall', extra)}"><i style="width:${Math.round(clamp01(frac) * 100)}%"></i>${label ? `<span class="ol">${label}</span>` : ''}</div>`;
}

/** Freshness meter: green when fresh, amber when turning, red when nearly spoiled. */
export const freshMeter = (pct: number): string => meter(pct / 100, pct > 60 ? 'green' : pct > 30 ? 'amber' : 'red');

export function stars(level: number, max: number, size = 14): string {
  let h = '';
  for (let i = 1; i <= max; i++) h += icon(i <= level ? 'star' : 'starOff', size);
  return `<span class="stars">${h}</span>`;
}

/** A person's portrait (an image URL from the 3D figures); draws nothing if no picture is available. */
export const face = (url: string, size: number): string =>
  url ? `<img class="face" src="${url}" width="${size}" height="${size}" alt="">` : '';

export const price = (text: string): string => `<span class="price ol">${icon('coin', 18)}${text}</span>`;
export const chip = (html: string): string => `<span class="chip">${html}</span>`;
export const section = (title: string): string => `<h3 class="section ol">${title}</h3>`;
export const empty = (text: string): string => `<div class="empty">${text}</div>`;

export interface CardOpts {
  tone: CardTone;
  art: string;
  name: string;
  tag?: string;
  /** Short lines between the art and the name band. */
  lines?: string[];
  /** Action area under the name band. */
  foot?: string;
}

export function card(o: CardOpts): string {
  return `<div class="card ${o.tone}">${o.tag ? `<span class="tag ol">${o.tag}</span>` : ''}<div class="card-art">${o.art}</div>${(o.lines ?? []).map((l) => `<div class="card-line ol">${l}</div>`).join('')}<div class="card-name ol">${o.name}</div>${o.foot ? `<div class="card-foot">${o.foot}</div>` : ''}</div>`;
}

/** A wrapping grid of cards; minWidth is the narrowest a card may get before the row wraps. */
export const cards = (items: string[], minWidth = 128): string => `<div class="cards" style="--card-min:${minWidth}px">${items.join('')}</div>`;

export interface ItemOpts {
  title: string;
  sub?: string;
  art?: string;
  /** Extra content under the subtitle (meters, chips). */
  extra?: string;
  /** Right-hand side: prices and buttons. */
  right?: string;
  state?: 'sel' | 'locked' | 'gold';
}

export function item(o: ItemOpts): string {
  return `<div class="${cls('item', o.state)}">${o.art ?? ''}<div class="grow"><div class="item-title ol">${o.title}</div>${o.sub ? `<div class="item-sub">${o.sub}</div>` : ''}${o.extra ?? ''}</div>${o.right ?? ''}</div>`;
}

export function stat(label: string, value: string, total = false): string {
  return `<div class="${cls('stat', total && 'total')}"><span>${label}</span><span class="ol">${value}</span></div>`;
}

export interface SliderOpts {
  /** Which setting the slider changes; sent back with each input event as data-slider. */
  id: string;
  /** Current value from 0 to 1. */
  value: number;
  /** Screen-reader name. */
  label: string;
  /** Greyed out (for example while sound is muted). */
  off?: boolean;
}

/** Whole percent for a 0-1 value. */
export const percent = (v: number): number => Math.round(clamp01(v) * 100);

/** A sunken track with a filled part and a chunky handle. The window manager listens for its input events. */
export function slider(o: SliderOpts): string {
  const p = percent(o.value);
  return `<span class="${cls('slider-wrap', o.off && 'dim')}"><input class="slider" type="range" min="0" max="100" step="5" value="${p}" data-slider="${o.id}" aria-label="${o.label}" style="--fill:${p}%"><span class="slider-val ol">${p}%</span></span>`;
}

export interface TickOpts {
  label: string;
  on: boolean;
  act: string;
  a?: string | number;
  b?: string | number;
  /** Small picture before the label (a fish icon, say). */
  art?: string;
  off?: boolean;
}

/** A tick box with a label. The whole thing is one button; the window manager sees it like any other action. */
export function tick(o: TickOpts): string {
  const data = ` data-act="${o.act}"${o.a !== undefined ? ` data-a="${o.a}"` : ''}${o.b !== undefined ? ` data-b="${o.b}"` : ''}`;
  return `<button class="${cls('tick ol', o.on && 'on', o.off && 'off')}" role="checkbox" aria-checked="${o.on}"${data}><span class="tick-box">${o.on ? icon('check', 18) : ''}</span>${o.art ?? ''}<span>${o.label}</span></button>`;
}
