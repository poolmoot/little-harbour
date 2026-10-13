import { TRACKS, TRACK_MAX, ZONES, ZONE_IDS } from '../../sim/config';
import type { Track } from '../../sim/config';
import { zoneWeights } from '../../sim/catch';
import { canUpgradeBoat, holdSize, rareMult, trackCost, tripCostFor, tripTimeFor, zoneUnlockedFor } from '../../sim/fleet';
import { unitPrice } from '../../sim/market';
import { CAPTAINS_RANK, rankOf } from '../../sim/rank';
import type { Boat, GameState } from '../../sim/state';
import { isNight, phaseOf } from '../../sim/time';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, card, cards, chip, empty, item, money, mult, priceLabel, stars } from '../components';
import type { CardTone } from '../components';
import { fishIcon, HULL_ICONS, icon } from '../icons';
import type { IconName } from '../icons';
import { FISH_NAME, LABEL, RANK_NAME, TRACK_NAME, TRAIT, ZONE_NAME, boatType, crates, denyText, trackNext, trackNow, zoneNeeds } from '../text';
import { pickTab } from './types';
import type { Screen, TabDef } from './types';

const TABS: TabDef[] = [{ id: 'upgrades', label: 'Make it better' }, { id: 'grounds', label: 'Where to fish' }, { id: 'captain', label: LABEL.captain }];
const TRACK_LOOK: Record<Track, { tone: CardTone; icon: IconName }> = {
  hull: { tone: 'orange', icon: 'sloop' },
  hold: { tone: 'gold', icon: 'crate' },
  gear: { tone: 'purple', icon: 'net' },
  sails: { tone: 'blue', icon: 'sail' },
};

function upgrades(s: GameState, boat: Boat): string {
  return cards(TRACKS.map((t) => {
    const cost = trackCost(boat, t);
    const chk = canUpgradeBoat(s, boat.id, t);
    const look = TRACK_LOOK[t];
    const foot = cost === null
      ? button({ label: LABEL.maxed, tone: 'gold', size: 'sm', off: true })
      : button({ label: chk.ok ? priceLabel(cost) : denyText(chk.reason, chk.needRank), act: 'up', a: boat.id, b: t, size: 'sm', off: !chk.ok });
    return card({
      tone: look.tone,
      art: icon(t === 'hull' ? HULL_ICONS[boat.hull] : look.icon, 48),
      lines: [stars(boat[t], TRACK_MAX[t]), trackNow(boat, t), cost === null ? 'All done' : `Next: ${trackNext(boat, t)}`],
      name: TRACK_NAME[t],
      foot,
    });
  }), 104);
}

function grounds(s: GameState, boat: Boat): string {
  const phase = phaseOf(s.dayTime);
  return ZONE_IDS.map((z) => {
    const unlocked = zoneUnlockedFor(boat, z);
    const sel = boat.target === z;
    const w = zoneWeights(z, phase);
    const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
    const fish = (Object.keys(w) as (keyof typeof w)[])
      .map((sp) => chip(`${fishIcon(hex(SPECIES_COLOUR[sp]), 13)}${FISH_NAME[sp]} ${Math.round(((w[sp] ?? 0) / total) * 100)}% · $${Math.round(unitPrice(s, sp, 100))}`))
      .join('');
    return item({
      title: ZONE_NAME[z],
      sub: `${Math.round(tripTimeFor(boat, z))}s trip · <span class="${unlocked && s.money < tripCostFor(z) ? 'bad' : ''}">${LABEL.tripCost} $${money(tripCostFor(z))}</span>${unlocked ? '' : ` · ${zoneNeeds(z)}`}`,
      extra: `<div class="chips">${fish}</div>`,
      state: sel ? 'sel' : unlocked ? undefined : 'locked',
      right: sel
        ? button({ label: 'Chosen', tone: 'gold', size: 'sm', off: true })
        : button({ label: unlocked ? 'Choose' : LABEL.locked, act: 'target', a: boat.id, b: z, tone: 'info', size: 'sm', off: !unlocked }),
    });
  }).join('');
}

function captain(s: GameState, boat: Boat): string {
  const cap = boat.captain;
  if (!cap) return empty(rankOf(s) >= CAPTAINS_RANK ? 'No captain. A captain sails the boat for you. Hire one at the inn.' : `Captains come at rank ${RANK_NAME[CAPTAINS_RANK]}.`);
  const info = TRAIT[cap.trait];
  return item({
    art: icon(cap.trait, 40),
    title: `${cap.name} · ${info.name}`,
    sub: `${info.desc} · $${cap.wage} a day${cap.unpaid ? ' · <span class="bad">not paid, no work today</span>' : ' · sails by day and pays the trip cost'}`,
    right: button({ label: LABEL.endJob, act: 'firecap', a: boat.id, tone: 'danger', size: 'sm' }),
  });
}

function portrait(boat: Boat): string {
  const zone = ZONES[boat.target];
  return `<div class="portrait">${icon(HULL_ICONS[boat.hull], 120)}${stars(boat.hull + 1, 4, 16)}
    <div class="portrait-name ol">${boatType(boat.hull)}</div>
    <div class="chips">${chip(`${icon('crate', 14)}${crates(holdSize(boat))}`)}${chip(`${icon('net', 14)}Rare fish ×${mult(rareMult(boat))}`)}${chip(`${icon('sail', 14)}Trip time ×${mult(tripTimeFor(boat, boat.target) / zone.trip)}`)}</div></div>`;
}

function foot(s: GameState, boat: Boat): string {
  const cost = tripCostFor(boat.target);
  const where = `<div class="row-x">${icon('anchor', 22)}<div><div class="ol">Going to ${ZONE_NAME[boat.target]}</div><div class="dim">${Math.round(tripTimeFor(boat, boat.target))}s trip · ${LABEL.tripCost} $${money(cost)}</div></div></div>`;
  if (boat.captain) return `${where}<span class="dim">${boat.captain.name} sails for you</span>`;
  const night = isNight(s);
  const poor = s.money < cost;
  const ok = boat.status === 'docked' && !night && !poor;
  const label = night ? 'Too dark' : boat.status !== 'docked' ? 'Boat is away' : poor ? `Not enough money ($${money(cost)} needed)` : `Send out ${priceLabel(cost)}`;
  return `${where}${button({ label, act: 'send', a: boat.id, b: boat.target, off: !ok })}`;
}

export const boatScreen: Screen = (ctx) => {
  const s = ctx.state;
  const boat = s.boats.find((b) => b.id === ctx.arg);
  if (!boat) return { title: 'Boat', icon: icon('rowboat', 28), body: empty('There is no such boat.') };
  const tab = pickTab(ctx, TABS);
  const pane = tab === 'upgrades' ? upgrades(s, boat) : tab === 'grounds' ? grounds(s, boat) : captain(s, boat);
  return {
    title: boat.name,
    icon: icon(HULL_ICONS[boat.hull], 28),
    tabs: TABS,
    tab,
    note: tab === 'grounds' && !isNight(s) ? LABEL.tripCostNote : isNight(s) ? '<span class="warn">It is too dark to go out. Boats can sail again in the morning.</span>' : undefined,
    body: `<div class="split">${portrait(boat)}<div>${pane}</div></div>`,
    foot: foot(s, boat),
  };
};
