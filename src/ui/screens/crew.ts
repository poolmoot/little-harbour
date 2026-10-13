import { DOCKHAND_WAGE, ICE_CAPACITY, MAX_DOCKHANDS, SPECIES } from '../../sim/config';
import type { Trait } from '../../sim/config';
import { coldCapacity } from '../../sim/buildings';
import { carryCapacity, coldCrates, iceCrates } from '../../sim/crates';
import { CAPTAINS_RANK, rankOf } from '../../sim/rank';
import { canHireCaptain, canHireDockhand, dailyWages } from '../../sim/staff';
import type { Dockhand, GameState } from '../../sim/state';
import { button, card, cards, empty, esc, face, item, money, section, tick } from '../components';
import { captainLook, dockhandLook, NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import type { CardTone } from '../components';
import { fishIcon, icon } from '../icons';
import { hex, SPECIES_COLOUR } from '../../palette';
import { WORKER_TEXT } from '../screenText';
import { FISH_NAME, LABEL, RANK_NAME, TRAIT, crates, denyText } from '../text';
import { pickTab } from './types';
import type { Screen } from './types';

const TRAIT_TONE: Record<Trait, CardTone> = { swift: 'blue', lucky: 'teal', careful: 'gold', thrifty: 'purple' };

function hire(s: GameState): string {
  const dock = canHireDockhand(s);
  const list = [card({
    tone: 'green',
    tag: 'Worker',
    art: face(portrait(dockhandLook(s.nextId)), 84) || icon('dockhand', 56),
    lines: [`Carries ${crates(carryCapacity(s))} at a time`, `${s.dockhands.length} of ${MAX_DOCKHANDS} hired`],
    name: 'Worker',
    foot: `<span class="dim">$${DOCKHAND_WAGE} a day</span>${button({ label: dock.ok ? 'Hire' : denyText(dock.reason, dock.needRank), act: 'hiredock', size: 'sm', off: !dock.ok })}`,
  })];
  const captainsOpen = rankOf(s) >= CAPTAINS_RANK;
  const free = s.boats.filter((b) => !b.captain);
  for (const c of s.candidates) {
    const info = TRAIT[c.trait];
    let actions: string;
    if (!captainsOpen) actions = button({ label: `${icon('lock', 14)}${RANK_NAME[CAPTAINS_RANK]}`, tone: 'ghost', size: 'sm', off: true });
    else if (free.length === 0) actions = button({ label: 'No free boat', tone: 'ghost', size: 'sm', off: true });
    else actions = free.map((b) => button({ label: `Hire for ${esc(b.name)}`, act: 'hirecap', a: c.id, b: b.id, size: 'sm', off: !canHireCaptain(s, b.id).ok })).join('');
    list.push(card({
      tone: TRAIT_TONE[c.trait],
      tag: 'Captain',
      art: face(portrait(captainLook(c.id, c.trait)), 84) || icon(c.trait, 56),
      lines: [info.name, info.desc],
      name: c.name,
      foot: `<span class="dim">$${c.wage} a day</span>${actions}`,
    }));
  }
  return cards(list);
}

function dockhandTask(d: Dockhand): string {
  if (d.unpaid) return '<span class="bad">Not paid, resting</span>';
  if (!d.job) return 'Waiting for crates';
  if (d.job.phase === 'out') return 'Going to the dock';
  if (d.job.phase === 'haul') return d.job.src === 'smoke' ? WORKER_TEXT.carryingSmoked : WORKER_TEXT.carryingTo(`${WORKER_TEXT.dest[d.job.dest]}`);
  return 'Walking back';
}

/** The "Smoke these" ticks (once the smokehouse is built) and the choice of where spare crates go (once there is somewhere to store them). */
export function workerRules(s: GameState): string {
  let h = '';
  const storage = s.buildings.coldstore > 0 || s.upgrades.icebox;
  if (s.buildings.smokehouse > 0) {
    const caught = SPECIES.filter((sp) => s.book[sp].caught > 0);
    h += section(WORKER_TEXT.smokeTitle) + `<p class="dim">${WORKER_TEXT.smokeNote}</p>`;
    h += caught.length
      ? `<div>${caught.map((sp) => tick({ label: FISH_NAME[sp], on: s.smokeList.includes(sp), act: 'smokelist', a: sp, b: s.smokeList.includes(sp) ? 0 : 1, art: fishIcon(hex(SPECIES_COLOUR[sp]), 15) })).join('')}</div>`
      : empty(WORKER_TEXT.smokeNone);
  }
  if (storage) {
    h += section(WORKER_TEXT.spareTitle) + item({
      title: s.haulPolicy === 'ice' ? WORKER_TEXT.storage : WORKER_TEXT.market,
      sub: `${WORKER_TEXT.spareNote} (Ice box ${iceCrates(s).length} of ${ICE_CAPACITY}${s.buildings.coldstore ? `, cold store ${coldCrates(s).length} of ${coldCapacity(s)}` : ''}.)`,
      right: `${button({ label: WORKER_TEXT.market, act: 'policy', a: 'market', tone: s.haulPolicy === 'market' ? 'go' : 'ghost', size: 'sm' })}${button({ label: WORKER_TEXT.storage, act: 'policy', a: 'ice', tone: s.haulPolicy === 'ice' ? 'go' : 'ghost', size: 'sm' })}`,
    });
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
    h += item({ art: face(portrait(captainLook(c.id, c.trait)), 48) || icon(c.trait, 36), title: `${c.name} · ${TRAIT[c.trait].name}`, sub: `${b.name} · $${c.wage} a day`, right: button({ label: LABEL.endJob, act: 'firecap', a: b.id, tone: 'danger', size: 'sm' }) });
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
    foot: `<span class="dim">Pay is taken at 06:00 each day. People you cannot pay do not work that day.</span><span class="ol">Pay each day · $${money(dailyWages(s))}</span>`,
  };
};
