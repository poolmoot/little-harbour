import { DOCKHAND_WAGE, ICE_CAPACITY, MAX_DOCKHANDS } from '../../sim/config';
import type { Trait } from '../../sim/config';
import { carryCapacity, iceCrates } from '../../sim/crates';
import { CAPTAINS_RANK, rankOf } from '../../sim/rank';
import { canHireCaptain, canHireDockhand, dailyWages } from '../../sim/staff';
import type { Dockhand, GameState } from '../../sim/state';
import { button, card, cards, empty, item, money, section } from '../components';
import type { CardTone } from '../components';
import { icon } from '../icons';
import { LABEL, RANK_NAME, TRAIT, crates, denyText } from '../text';
import { pickTab } from './types';
import type { Screen } from './types';

const TRAIT_TONE: Record<Trait, CardTone> = { swift: 'blue', lucky: 'teal', careful: 'gold', thrifty: 'purple' };

function hire(s: GameState): string {
  const dock = canHireDockhand(s);
  const list = [card({
    tone: 'green',
    tag: 'Worker',
    art: icon('dockhand', 56),
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
    else actions = free.map((b) => button({ label: `Hire for ${b.name}`, act: 'hirecap', a: c.id, b: b.id, size: 'sm', off: !canHireCaptain(s, b.id).ok })).join('');
    list.push(card({
      tone: TRAIT_TONE[c.trait],
      tag: 'Captain',
      art: icon(c.trait, 56),
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
  if (d.job.phase === 'haul') return `Carrying ${d.job.crateIds.length} to the ${d.job.dest === 'ice' ? 'ice box' : 'market'}`;
  return 'Walking back';
}

function roster(s: GameState): string {
  let h = section(`Workers ${s.dockhands.length} / ${MAX_DOCKHANDS}`);
  if (!s.dockhands.length) h += empty('No workers yet. Hire one to carry crates for you.');
  for (const d of s.dockhands) {
    h += item({ art: icon('dockhand', 36), title: d.name, sub: dockhandTask(d), right: button({ label: LABEL.endJob, act: 'firedock', a: d.id, tone: 'danger', size: 'sm' }) });
  }
  const captains = s.boats.filter((b) => b.captain);
  h += section('Captains');
  if (!captains.length) h += empty('No captains yet.');
  for (const b of captains) {
    const c = b.captain!;
    h += item({ art: icon(c.trait, 36), title: `${c.name} · ${TRAIT[c.trait].name}`, sub: `${b.name} · $${c.wage} a day`, right: button({ label: LABEL.endJob, act: 'firecap', a: b.id, tone: 'danger', size: 'sm' }) });
  }
  h += section('Where workers take the fish');
  h += item({
    title: s.haulPolicy === 'ice' ? 'Ice box first' : 'Straight to market',
    sub: `The ice box keeps fish fresh, but holds only ${ICE_CAPACITY} (now ${iceCrates(s).length}). When it is full, they go to the market.`,
    right: `${button({ label: 'Market', act: 'policy', a: 'market', tone: s.haulPolicy === 'market' ? 'go' : 'ghost', size: 'sm' })}${button({ label: s.upgrades.icebox ? 'Ice box' : 'Ice box (buy first)', act: 'policy', a: 'ice', tone: s.haulPolicy === 'ice' ? 'go' : 'ghost', size: 'sm', off: !s.upgrades.icebox })}`,
  });
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
    tabs,
    tab,
    body: tab === 'hire' ? hire(s) : roster(s),
    foot: `<span class="dim">Pay is taken at 06:00 each day. People you cannot pay do not work that day.</span><span class="ol">Pay each day · $${money(dailyWages(s))}</span>`,
  };
};
