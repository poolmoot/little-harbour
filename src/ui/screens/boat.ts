import { FISH, GEAR_MULT, HOLD_SIZES, HULL_NAMES, SAILS_MULT, TRACKS, TRACK_MAX, TRACK_NAMES, TRAIT_INFO, ZONES, ZONE_IDS } from '../../sim/config';
import type { Track } from '../../sim/config';
import { zoneWeights } from '../../sim/catch';
import { canUpgradeBoat, holdSize, rareMult, trackCost, trackNote, tripTimeFor, zoneUnlockedFor } from '../../sim/fleet';
import { unitPrice } from '../../sim/market';
import { rankOf } from '../../sim/rank';
import type { Boat, GameState } from '../../sim/state';
import { isNight, phaseOf } from '../../sim/time';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, card, cards, chip, empty, item, mult, priceLabel, stars } from '../components';
import type { CardTone } from '../components';
import { fishIcon, HULL_ICONS, icon } from '../icons';
import type { IconName } from '../icons';
import { pickTab } from './types';
import type { Screen, TabDef } from './types';

const TABS: TabDef[] = [{ id: 'upgrades', label: 'Upgrades' }, { id: 'grounds', label: 'Fishing grounds' }, { id: 'captain', label: 'Captain' }];
const TRACK_LOOK: Record<Track, { tone: CardTone; icon: IconName }> = {
  hull: { tone: 'orange', icon: 'sloop' },
  hold: { tone: 'gold', icon: 'crate' },
  gear: { tone: 'purple', icon: 'net' },
  sails: { tone: 'blue', icon: 'sail' },
};

function trackLevel(boat: Boat, t: Track): string {
  const lvl = boat[t];
  if (t === 'hull') return HULL_NAMES[lvl];
  if (t === 'hold') return `${HOLD_SIZES[lvl]} crates`;
  if (t === 'gear') return `Rare fish ×${GEAR_MULT[lvl]}`;
  return `Trip time ×${SAILS_MULT[lvl]}`;
}

function upgrades(s: GameState, boat: Boat): string {
  return cards(TRACKS.map((t) => {
    const cost = trackCost(boat, t);
    const chk = canUpgradeBoat(s, boat.id, t);
    const look = TRACK_LOOK[t];
    const foot = cost === null
      ? button({ label: 'Max', tone: 'gold', size: 'sm', off: true })
      : button({ label: chk.ok ? priceLabel(cost) : chk.reason ?? 'Locked', act: 'up', a: boat.id, b: t, size: 'sm', off: !chk.ok });
    return card({
      tone: look.tone,
      art: icon(t === 'hull' ? HULL_ICONS[boat.hull] : look.icon, 48),
      lines: [stars(boat[t], TRACK_MAX[t]), trackLevel(boat, t), trackNote(boat, t)],
      name: TRACK_NAMES[t],
      foot,
    });
  }), 104);
}

function grounds(s: GameState, boat: Boat): string {
  const phase = phaseOf(s.dayTime);
  return ZONE_IDS.map((z) => {
    const zone = ZONES[z];
    const unlocked = zoneUnlockedFor(boat, z);
    const sel = boat.target === z;
    const w = zoneWeights(z, phase);
    const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
    const fish = (Object.keys(w) as (keyof typeof w)[])
      .map((sp) => chip(`${fishIcon(hex(SPECIES_COLOUR[sp]), 13)}${FISH[sp].name} ${Math.round(((w[sp] ?? 0) / total) * 100)}% · $${Math.round(unitPrice(s, sp, 100))}`))
      .join('');
    return item({
      title: zone.name,
      sub: `${Math.round(tripTimeFor(boat, z))}s trip${unlocked ? '' : ` · needs a ${HULL_NAMES[zone.needsHull]} hull`}`,
      extra: `<div class="chips">${fish}</div>`,
      state: sel ? 'sel' : unlocked ? undefined : 'locked',
      right: sel
        ? button({ label: 'Assigned', tone: 'gold', size: 'sm', off: true })
        : button({ label: unlocked ? 'Assign' : 'Locked', act: 'target', a: boat.id, b: z, tone: 'info', size: 'sm', off: !unlocked }),
    });
  }).join('');
}

function captain(s: GameState, boat: Boat): string {
  const cap = boat.captain;
  if (!cap) return empty(rankOf(s) >= 2 ? 'No captain yet. Hire one at the Anchor Inn.' : 'Captains unlock at rank Skipper & Co.');
  const info = TRAIT_INFO[cap.trait];
  return item({
    art: icon(cap.trait, 40),
    title: `${cap.name} · ${info.name}`,
    sub: `${info.desc} · $${cap.wage} a day${cap.unpaid ? ' · <span class="bad">unpaid, not working today</span>' : ' · sails the assigned grounds by daylight'}`,
    right: button({ label: 'Let go', act: 'firecap', a: boat.id, tone: 'danger', size: 'sm' }),
  });
}

function portrait(boat: Boat): string {
  const zone = ZONES[boat.target];
  return `<div class="portrait">${icon(HULL_ICONS[boat.hull], 120)}${stars(boat.hull + 1, 4, 16)}
    <div class="portrait-name ol">${HULL_NAMES[boat.hull]}</div>
    <div class="chips">${chip(`${icon('crate', 14)}Hold ${holdSize(boat)}`)}${chip(`${icon('net', 14)}Rare ×${mult(rareMult(boat))}`)}${chip(`${icon('sail', 14)}Trips ×${mult(tripTimeFor(boat, boat.target) / zone.trip)}`)}</div></div>`;
}

function foot(s: GameState, boat: Boat): string {
  const zone = ZONES[boat.target];
  const where = `<div class="row-x">${icon('anchor', 22)}<div><div class="ol">Bound for the ${zone.name}</div><div class="dim">${Math.round(tripTimeFor(boat, boat.target))}s trip</div></div></div>`;
  if (boat.captain) return `${where}<span class="dim">${boat.captain.name} sails for you</span>`;
  const night = isNight(s);
  const ok = boat.status === 'docked' && !night;
  return `${where}${button({ label: night ? 'Too dark' : boat.status === 'docked' ? 'Send out' : 'Boat is away', act: 'send', a: boat.id, b: boat.target, off: !ok })}`;
}

export const boatScreen: Screen = (ctx) => {
  const s = ctx.state;
  const boat = s.boats.find((b) => b.id === ctx.arg);
  if (!boat) return { title: 'Boat', icon: icon('rowboat', 28), body: empty('No such boat.') };
  const tab = pickTab(ctx, TABS);
  const pane = tab === 'upgrades' ? upgrades(s, boat) : tab === 'grounds' ? grounds(s, boat) : captain(s, boat);
  return {
    title: boat.name,
    icon: icon(HULL_ICONS[boat.hull], 28),
    tabs: TABS,
    tab,
    note: isNight(s) ? '<span class="warn">It is too dark to sail. Boats go out again at dawn.</span>' : undefined,
    body: `<div class="split">${portrait(boat)}<div>${pane}</div></div>`,
    foot: foot(s, boat),
  };
};
