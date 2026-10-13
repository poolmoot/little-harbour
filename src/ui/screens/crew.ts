import { DOCKHAND_WAGE, ICE_CAPACITY, MAX_DOCKHANDS, TRAIT_INFO } from '../../sim/config';
import type { Trait } from '../../sim/config';
import { iceCrates } from '../../sim/crates';
import { rankOf } from '../../sim/rank';
import { canHireCaptain, canHireDockhand, dailyWages } from '../../sim/staff';
import type { Dockhand, GameState } from '../../sim/state';
import { button, card, cards, empty, item, money, section } from '../components';
import type { CardTone } from '../components';
import { icon } from '../icons';
import { pickTab } from './types';
import type { Screen } from './types';

const TRAIT_TONE: Record<Trait, CardTone> = { swift: 'blue', lucky: 'teal', careful: 'gold', thrifty: 'purple' };

function hire(s: GameState): string {
  const dock = canHireDockhand(s);
  const list = [card({
    tone: 'green',
    tag: 'Dockhand',
    art: icon('dockhand', 56),
    lines: [`Hauls ${s.upgrades.handcart ? 4 : 2} crates a trip`, `${s.dockhands.length} of ${MAX_DOCKHANDS} hired`],
    name: 'Dockhand',
    foot: `<span class="dim">$${DOCKHAND_WAGE} a day</span>${button({ label: dock.ok ? 'Hire' : dock.reason ?? 'Locked', act: 'hiredock', size: 'sm', off: !dock.ok })}`,
  })];
  const captainsOpen = rankOf(s) >= 2;
  const free = s.boats.filter((b) => !b.captain);
  for (const c of s.candidates) {
    const info = TRAIT_INFO[c.trait];
    let actions: string;
    if (!captainsOpen) actions = button({ label: `${icon('lock', 14)}Skipper & Co`, tone: 'ghost', size: 'sm', off: true });
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
  if (d.unpaid) return '<span class="bad">Unpaid, resting today</span>';
  if (!d.job) return 'Waiting for crates';
  if (d.job.phase === 'out') return 'Heading to the dock';
  if (d.job.phase === 'haul') return `Carrying ${d.job.crateIds.length} to the ${d.job.dest === 'ice' ? 'ice box' : 'market'}`;
  return 'Walking back';
}

function roster(s: GameState): string {
  let h = section(`Dockhands ${s.dockhands.length} / ${MAX_DOCKHANDS}`);
  if (!s.dockhands.length) h += empty('No dockhands yet. Hire one to haul crates for you.');
  for (const d of s.dockhands) {
    h += item({ art: icon('dockhand', 36), title: d.name, sub: dockhandTask(d), right: button({ label: 'Let go', act: 'firedock', a: d.id, tone: 'danger', size: 'sm' }) });
  }
  const captains = s.boats.filter((b) => b.captain);
  h += section('Captains');
  if (!captains.length) h += empty('No captains yet.');
  for (const b of captains) {
    const c = b.captain!;
    h += item({ art: icon(c.trait, 36), title: `${c.name} · ${TRAIT_INFO[c.trait].name}`, sub: `${b.name} · $${c.wage} a day`, right: button({ label: 'Let go', act: 'firecap', a: b.id, tone: 'danger', size: 'sm' }) });
  }
  h += section('Where dockhands take crates');
  h += item({
    title: s.haulPolicy === 'ice' ? 'Ice box first' : 'Straight to market',
    sub: `The ice box holds ${iceCrates(s).length} of ${ICE_CAPACITY}. Once it is full, crates go to market.`,
    right: `${button({ label: 'Market', act: 'policy', a: 'market', tone: s.haulPolicy === 'market' ? 'go' : 'ghost', size: 'sm' })}${button({ label: s.upgrades.icebox ? 'Ice box' : 'No ice box', act: 'policy', a: 'ice', tone: s.haulPolicy === 'ice' ? 'go' : 'ghost', size: 'sm', off: !s.upgrades.icebox })}`,
  });
  return h;
}

export const crewScreen: Screen = (ctx) => {
  const s = ctx.state;
  const count = s.dockhands.length + s.boats.filter((b) => b.captain).length;
  const tabs = [{ id: 'hire', label: 'Hire' }, { id: 'crew', label: `Your crew ${count}` }];
  const tab = pickTab(ctx, tabs);
  return {
    title: 'Anchor Inn',
    icon: icon('dockhand', 28),
    tabs,
    tab,
    body: tab === 'hire' ? hire(s) : roster(s),
    foot: `<span class="dim">Wages are paid at 06:00. Crew you can't pay sit the day out.</span><span class="ol">Wages today · $${money(dailyWages(s))}</span>`,
  };
};
