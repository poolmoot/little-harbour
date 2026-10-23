import { DOCKHAND_WAGE, MAX_DOCKHANDS, SPECIES } from '../../sim/config';
import { carryCapacity } from '../../sim/crates';
import { CAPTAINS_RANK, rankOf } from '../../sim/rank';
import { canHireCaptain, canHireDockhand, dailyUpkeep, dailyWages } from '../../sim/staff';
import type { Dockhand, GameState } from '../../sim/state';
import { button, empty, esc, face, item, lockNote, money, section, tick } from '../components';
import { captainLook, dockhandLook, NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import { fishIcon, icon } from '../icons';
import { hex, SPECIES_COLOUR } from '../../palette';
import { CAPTAIN_TEXT, WORKER_TEXT } from '../screenText';
import { captainLevel, captainWage } from '../../sim/captains';
import { FISH_NAME, LABEL, TRAIT, crates } from '../text';
import { pickTab } from './types';
import type { Screen } from './types';

/** One short row: a face, a name with one line about the person, then the pay and the Hire button. */
function hireRow(o: { art: string; title: string; sub: string; pay: string; actions: string; lock?: string }): string {
  return item({
    art: o.art,
    title: o.title,
    sub: o.sub,
    extra: o.lock ?? '',
    right: `<span class="hire-end"><span class="hire-pay ol">${o.pay}</span>${o.actions}</span>`,
  });
}

function hire(s: GameState): string {
  const dock = canHireDockhand(s);
  const rows = [hireRow({
    art: face(portrait(dockhandLook(s.nextId)), 44) || icon('dockhand', 36),
    title: 'Worker',
    sub: `Carries ${crates(carryCapacity(s))} at a time · ${s.dockhands.length} of ${MAX_DOCKHANDS} hired`,
    pay: `$${DOCKHAND_WAGE} a day`,
    lock: dock.ok ? '' : lockNote({ money: s.money, rank: rankOf(s), needRank: dock.needRank, reason: dock.reason }),
    actions: button({ label: dock.ok ? 'Hire' : `${icon('lock', 18)}${LABEL.locked}`, act: 'hiredock', size: 'sm', off: !dock.ok }),
  })];
  const captainsOpen = rankOf(s) >= CAPTAINS_RANK;
  const free = s.boats.filter((b) => !b.captain);
  const captains: string[] = [];
  for (const c of s.candidates) {
    const info = TRAIT[c.trait];
    let actions: string;
    let pay = `$${captainWage(c, free[0]?.hull ?? 0)} a day`;
    if (!captainsOpen) actions = button({ label: `${icon('lock', 18)}${LABEL.locked}`, tone: 'ghost', size: 'sm', off: true });
    else if (free.length === 0) actions = button({ label: 'No free boat', tone: 'ghost', size: 'sm', off: true });
    else if (free.length === 1) actions = button({ label: 'Hire', act: 'hirecap', a: c.id, b: free[0].id, size: 'sm', off: !canHireCaptain(s, free[0].id).ok });
    else {
      pay = '';
      actions = free.map((b) => button({ label: `${esc(b.name)} · $${captainWage(c, b.hull)}`, act: 'hirecap', a: c.id, b: b.id, size: 'sm', off: !canHireCaptain(s, b.id).ok })).join('');
    }
    captains.push(hireRow({
      art: face(portrait(captainLook(c.id, c.trait)), 44) || icon(c.trait, 36),
      title: `${c.name} · ${info.name}`,
      sub: info.desc,
      pay,
      actions,
    }));
  }
  const lock = captainsOpen ? '' : lockNote({ money: s.money, rank: rankOf(s), needRank: CAPTAINS_RANK, reason: 'Captains sail a boat for you.' });
  return `<div class="hire-list">${rows.join('')}${section('Captains')}${lock}${captains.join('')}</div>` + (captainsOpen && free.length > 1 ? `<p class="dim">${CAPTAIN_TEXT.pickBoat}</p>` : '');
}

function dockhandTask(d: Dockhand): string {
  if (d.unpaid) return '<span class="bad">Not paid, resting</span>';
  if (!d.job) return 'Waiting for crates';
  if (d.job.phase === 'out') return 'Going to the dock';
  if (d.job.phase === 'haul') return d.job.src === 'smoke' ? WORKER_TEXT.carryingSmoked : WORKER_TEXT.carryingTo(`${WORKER_TEXT.dest[d.job.dest]}`);
  return 'Walking back';
}

/** The "Smoke these" ticks, once the smokehouse is built. */
export function workerRules(s: GameState): string {
  let h = '';
  if (s.buildings.smokehouse > 0) {
    const caught = SPECIES.filter((sp) => s.book[sp].caught > 0);
    h += section(WORKER_TEXT.smokeTitle) + `<p class="dim">${WORKER_TEXT.smokeNote}</p>`;
    h += caught.length
      ? `<div>${caught.map((sp) => tick({ label: FISH_NAME[sp], on: s.smokeList.includes(sp), act: 'smokelist', a: sp, b: s.smokeList.includes(sp) ? 0 : 1, art: fishIcon(hex(SPECIES_COLOUR[sp]), 15) })).join('')}</div>`
      : empty(WORKER_TEXT.smokeNone);
  }
  if (s.buildings.smokehouse > 0 || s.buildings.restaurant > 0) h += `<p class="dim">${WORKER_TEXT.rules}</p>`;
  return h;
}

function roster(s: GameState): string {
  let h = section(`Workers ${s.dockhands.length} / ${MAX_DOCKHANDS}`);
  if (!s.dockhands.length) h += empty('No workers yet. Hire one to carry crates for you.');
  for (const d of s.dockhands) {
    h += item({ art: face(portrait(dockhandLook(d.id)), 48) || icon('dockhand', 36), title: d.name, sub: dockhandTask(d), right: button({ label: LABEL.endJob, act: 'firedock', a: d.id, tone: 'danger', size: 'sm' }) });
  }
  const captains = s.boats.filter((b) => b.captain);
  h += section('Captains');
  if (!captains.length) h += empty('No captains yet.');
  for (const b of captains) {
    const c = b.captain!;
    h += item({ art: face(portrait(captainLook(c.id, c.trait)), 48) || icon(c.trait, 36), title: `${c.name} · ${TRAIT[c.trait].name} · ${CAPTAIN_TEXT.level(captainLevel(c))}`, sub: `${esc(b.name)} · ${CAPTAIN_TEXT.wage(captainWage(c, b.hull))}`, right: button({ label: LABEL.endJob, act: 'firecap', a: b.id, tone: 'danger', size: 'sm' }) });
  }
  h += workerRules(s);
  return h;
}

export const crewScreen: Screen = (ctx) => {
  const s = ctx.state;
  const count = s.dockhands.length + s.boats.filter((b) => b.captain).length;
  const tabs = [{ id: 'hire', label: 'Hire' }, { id: 'crew', label: `Your people ${count}` }];
  const tab = pickTab(ctx, tabs);
  return {
    title: 'The Anchor Inn',
    icon: icon('dockhand', 28),
    host: portrait(NPC_LOOK.innkeeper),
    tabs,
    tab,
    body: tab === 'hire' ? hire(s) : roster(s),
    foot: `<span class="dim">Paid at 06:00 each day. No pay, no work.</span><span class="ol">Pay each day · $${money(dailyWages(s))}${dailyUpkeep(s) ? ` · Boat care $${money(dailyUpkeep(s))}` : ''}</span>`,
  };
};
