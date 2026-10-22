import { CAPTAIN_MAX_LEVEL, STORM_ZONES, TRACKS, TRACK_MAX, ZONES, ZONE_IDS } from '../../sim/config';
import { captainLevel, captainWage, tripsToNextLevel } from '../../sim/captains';
import type { Track } from '../../sim/config';
import { zoneWeights } from '../../sim/catch';
import { canUpgradeBoat, holdSize, rareMult, trackCost, tripCostFor, tripTimeFor, zoneUnlockedFor } from '../../sim/fleet';
import { unitPrice } from '../../sim/market';
import { CAPTAINS_RANK, rankOf } from '../../sim/rank';
import { canHireCaptain } from '../../sim/staff';
import type { Boat, GameState } from '../../sim/state';
import { phaseOf } from '../../sim/time';
import { hex, SPECIES_COLOUR } from '../../palette';
import { button, buyLabel, chip, section, empty, esc, face, item, levelDots, lockNote, money, mult, priceLabel, stars, textField, tick } from '../components';
import { captainLook } from '../../view/people';
import { portrait as facePicture } from '../../view/portraits';
import type { CardTone } from '../components';
import { fishIcon, HULL_ICONS, icon } from '../icons';
import type { IconName } from '../icons';
import { BOAT_TEXT, CAPTAIN_TEXT, LOCK_TEXT, UPGRADE_ROW_TEXT } from '../screenText';
import { FISH_NAME, LABEL, NAME_LABEL, WEATHER_LABEL, TRACK_NAME, TRAIT, ZONE_NAME, boatType, crates, trackNext, trackNow, zoneNeeds } from '../text';
import { pickTab } from './types';
import type { Screen, TabDef } from './types';

const TABS: TabDef[] = [{ id: 'upgrades', label: 'Upgrade' }, { id: 'grounds', label: 'Where to fish' }];
const TRACK_LOOK: Record<Track, { tone: CardTone; icon: IconName }> = {
  hull: { tone: 'orange', icon: 'sloop' },
  hold: { tone: 'gold', icon: 'crate' },
  gear: { tone: 'purple', icon: 'net' },
  sails: { tone: 'blue', icon: 'sail' },
};

/** One row per upgrade: what it is, how far along, what you have, what you get, and a big button with the price. */
export function upgradeRow(s: GameState, boat: Boat, t: Track): string {
  const cost = trackCost(boat, t);
  const chk = canUpgradeBoat(s, boat.id, t);
  const look = TRACK_LOOK[t];
  const max = TRACK_MAX[t];
  const maxed = cost === null;
  const rankLocked = !chk.ok && (chk.needRank !== undefined || chk.needHull !== undefined);
  const reason = chk.needHull !== undefined ? LOCK_TEXT.needBoat(boatType(chk.needHull)) : chk.reason;
  const lock = maxed || chk.ok ? '' : lockNote({ cost, money: s.money, rank: rankOf(s), needRank: chk.needRank, reason });
  const act = maxed
    ? button({ label: LABEL.maxed, tone: 'gold', off: true })
    : button({ label: rankLocked ? `${icon('lock', 20)}${LOCK_TEXT.locked}` : buyLabel(UPGRADE_ROW_TEXT.upgrade, cost), act: 'up', a: boat.id, b: t, off: !chk.ok });
  const next = maxed ? UPGRADE_ROW_TEXT.allDone : trackNext(boat, t);
  return `<div class="urow${maxed ? ' maxed' : ''}"><div class="urow-art">${icon(t === 'hull' ? HULL_ICONS[boat.hull] : look.icon, 52)}</div>`
    + `<div class="urow-main"><div class="urow-head"><span class="item-title ol">${TRACK_NAME[t]}</span>${levelDots(boat[t], max)}<span class="urow-lvl">${maxed ? UPGRADE_ROW_TEXT.maxed : UPGRADE_ROW_TEXT.level(boat[t], max)}</span></div>`
    + `<div class="urow-line">${UPGRADE_ROW_TEXT.now}: <b>${trackNow(boat, t)}</b></div>`
    + `<div class="urow-line">${maxed ? '' : `${UPGRADE_ROW_TEXT.next}: `}${next}</div>${lock}</div>`
    + `<div class="urow-act">${act}</div></div>`;
}

function upgrades(s: GameState, boat: Boat): string {
  return TRACKS.map((t) => upgradeRow(s, boat, t)).join('');
}

/** The "Stay home in storms" tick, with a line about what it does. */
function stayHome(s: GameState, boat: Boat): string {
  return `<div>${tick({ label: WEATHER_LABEL.stayHome, on: boat.stayInStorms, act: 'stayhome', a: boat.id, b: boat.stayInStorms ? 0 : 1 })}</div><p class="dim">${s.weather === 'storm' && boat.stayInStorms ? BOAT_TEXT.stayToday : BOAT_TEXT.stayNote}</p>`;
}

function grounds(s: GameState, boat: Boat): string {
  const phase = phaseOf(s.dayTime);
  return stayHome(s, boat) + ZONE_IDS.map((z) => {
    const unlocked = zoneUnlockedFor(boat, z);
    const sel = boat.target === z;
    const w = zoneWeights(z, phase);
    const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
    const fish = (Object.keys(w) as (keyof typeof w)[])
      .map((sp) => chip(`${fishIcon(hex(SPECIES_COLOUR[sp]), 13)}${FISH_NAME[sp]} ${Math.round(((w[sp] ?? 0) / total) * 100)}% · $${Math.round(unitPrice(s, sp, 100))}`))
      .join('');
    return item({
      title: ZONE_NAME[z],
      sub: `${Math.round(tripTimeFor(boat, z))}s trip · <span class="${unlocked && s.money < tripCostFor(z, boat) ? 'bad' : ''}">${LABEL.tripCost} $${money(tripCostFor(z, boat))}</span>`,
      extra: `<div class="chips">${fish}</div>${unlocked ? '' : lockNote({ money: s.money, rank: rankOf(s), reason: `${zoneNeeds(z)}. ${UPGRADE_ROW_TEXT.zoneHow}` })}`,
      state: sel ? 'sel' : unlocked ? undefined : 'locked',
      right: sel
        ? button({ label: 'Chosen', tone: 'gold', size: 'sm', off: true })
        : button({ label: unlocked ? 'Choose' : `${icon('lock', 18)}${LABEL.locked}`, act: 'target', a: boat.id, b: z, tone: 'info', size: 'sm', off: !unlocked }),
    });
  }).join('');
}

function captain(s: GameState, boat: Boat): string {
  const cap = boat.captain;
  if (cap) {
    const info = TRAIT[cap.trait];
    const lvl = captainLevel(cap);
    const toNext = tripsToNextLevel(cap);
    return section(CAPTAIN_TEXT.hasTitle) + item({
      art: face(facePicture(captainLook(cap.id, cap.trait)), 56) || icon(cap.trait, 40),
      title: `${cap.name} · ${info.name} · ${CAPTAIN_TEXT.level(lvl)} ${levelDots(lvl, CAPTAIN_MAX_LEVEL)}`,
      sub: `${info.desc} · ${CAPTAIN_TEXT.wage(captainWage(cap, boat.hull))} · ${toNext === null ? CAPTAIN_TEXT.topLevel : CAPTAIN_TEXT.toNext(Math.ceil(toNext), lvl + 1)}${cap.unpaid ? ' · <span class="bad">not paid, no work today</span>' : ` · ${CAPTAIN_TEXT.helpGoing}`}<br>${CAPTAIN_TEXT.fishes(ZONE_NAME[boat.target])}`,
      right: `<div class="col-y">${button({ label: CAPTAIN_TEXT.change, act: 'tab', a: 'grounds', tone: 'info', size: 'sm' })}${button({ label: LABEL.endJob, act: 'firecap', a: boat.id, tone: 'danger', size: 'sm' })}</div>`,
    });
  }
  let head = section(CAPTAIN_TEXT.getTitle) + `<p class="yard-help">${CAPTAIN_TEXT.getHelp}</p>`;
  if (rankOf(s) < CAPTAINS_RANK) return head + lockNote({ money: s.money, rank: rankOf(s), needRank: CAPTAINS_RANK, reason: CAPTAIN_TEXT.lockedWhy });
  if (!s.candidates.length) return head + empty(CAPTAIN_TEXT.noneToHire);
  head += `<p class="dim">${CAPTAIN_TEXT.levelHelp}</p>`;
  const can = canHireCaptain(s, boat.id).ok;
  return head + s.candidates.map((c) => {
    const info = TRAIT[c.trait];
    return item({
      art: face(facePicture(captainLook(c.id, c.trait)), 56) || icon(c.trait, 40),
      title: `${c.name} · ${info.name} · ${CAPTAIN_TEXT.level(captainLevel(c))}`,
      sub: `${info.desc} · ${CAPTAIN_TEXT.wage(captainWage(c, boat.hull))}`,
      right: button({ label: CAPTAIN_TEXT.hire, act: 'hirecap', a: c.id, b: boat.id, tone: 'go', off: !can }),
    });
  }).join('');
}

function portrait(boat: Boat): string {
  const zone = ZONES[boat.target];
  return `<div class="portrait">${icon(HULL_ICONS[boat.hull], 120)}${stars(boat.hull + 1, 4, 16)}
    <div class="portrait-name ol">${boatType(boat.hull)}</div>
    <div class="chips">${boat.damaged ? chip(`<span class="bad">${BOAT_TEXT.broken}</span>`) : ''}${chip(`${icon('crate', 14)}${crates(holdSize(boat))}`)}${chip(`${icon('net', 14)}Rare fish ×${mult(rareMult(boat))}`)}${chip(`${icon('sail', 14)}Trip time ×${mult(tripTimeFor(boat, boat.target) / zone.trip)}`)}</div>
    <div class="rename"><div class="rename-label">${NAME_LABEL.boat}</div>${textField({ id: 'boatname', value: boat.name, label: NAME_LABEL.boat, save: 'renameboat', a: boat.id, saveLabel: NAME_LABEL.save, stack: true })}</div></div>`;
}

function foot(s: GameState, boat: Boat): string {
  const cost = tripCostFor(boat.target, boat);
  const where = `<div class="row-x">${icon('anchor', 22)}<div><div class="ol">Going to ${ZONE_NAME[boat.target]}</div><div class="dim">${Math.round(tripTimeFor(boat, boat.target))}s trip · ${LABEL.tripCost} $${money(cost)}</div></div></div>`;
  if (boat.damaged) return `${where}${button({ label: boat.repairLeft !== undefined ? BOAT_TEXT.fixing(Math.ceil(boat.repairLeft)) : BOAT_TEXT.cannotSail, tone: 'ghost', off: true })}`;
  if (boat.captain) return `${where}<span class="dim">${boat.captain.name} sails for you</span>`;
  const stays = s.weather === 'storm' && boat.stayInStorms && STORM_ZONES.includes(boat.target);
  const poor = s.money < cost;
  const ok = boat.status === 'docked' && !poor && !stays;
  const label = stays ? 'Stays home (storm)' : boat.status !== 'docked' ? 'Boat is away' : poor ? `Not enough money ($${money(cost)} needed)` : `Send out ${priceLabel(cost)}`;
  return `${where}${button({ label: ok ? `${icon(HULL_ICONS[boat.hull], 26)}${label}` : label, act: 'send', a: boat.id, b: boat.target, off: !ok, hero: true })}`;
}

export const boatScreen: Screen = (ctx) => {
  const s = ctx.state;
  const boat = s.boats.find((b) => b.id === ctx.arg);
  if (!boat) return { title: 'Boat', icon: icon('rowboat', 28), body: empty('There is no such boat.') };
  const tab = pickTab(ctx, TABS);
  const pane = tab === 'upgrades' ? captain(s, boat) + upgrades(s, boat) : grounds(s, boat);
  return {
    title: esc(boat.name),
    icon: icon(HULL_ICONS[boat.hull], 28),
    tabs: TABS,
    tab,
    note: boat.damaged
      ? `<span class="bad">${boat.repairLeft !== undefined ? BOAT_TEXT.fixing(Math.ceil(boat.repairLeft)) : `${BOAT_TEXT.brokenChip} ${BOAT_TEXT.fixHint}`}</span>`
      : tab === 'grounds' ? LABEL.tripCostNote : undefined,
    body: `<div class="split">${portrait(boat)}<div>${pane}</div></div>`,
    foot: foot(s, boat),
  };
};
