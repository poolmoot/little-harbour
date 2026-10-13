import { HULL_NAMES, MAX_BOATS, RANK_NAMES, UPGRADES, UPGRADE_IDS } from '../../sim/config';
import type { UpgradeId } from '../../sim/config';
import { canBuyBoat, holdSize } from '../../sim/fleet';
import { rankOf } from '../../sim/rank';
import type { GameState } from '../../sim/state';
import { canBuy } from '../../sim/upgrades';
import { button, card, cards, item, priceLabel } from '../components';
import type { CardTone } from '../components';
import { HULL_ICONS, icon } from '../icons';
import type { IconName } from '../icons';
import { pickTab } from './types';
import type { Screen } from './types';

const UPGRADE_LOOK: Record<UpgradeId, { tone: CardTone; icon: IconName }> = {
  icebox: { tone: 'blue', icon: 'ice' },
  handcart: { tone: 'orange', icon: 'cart' },
  stall1: { tone: 'green', icon: 'stall' },
  stall2: { tone: 'purple', icon: 'stall' },
};

function fleet(s: GameState): string {
  const bb = canBuyBoat(s);
  let h = item({
    art: icon('rowboat', 40),
    title: bb.cost === null ? 'Fleet complete' : 'New rowboat',
    sub: bb.cost === null ? 'Every berth is in use.' : `Moors at berth ${s.boats.length + 1}. Upgrade it from the pier afterwards.`,
    state: bb.cost === null ? 'locked' : undefined,
    right: bb.cost === null
      ? button({ label: 'Full', tone: 'ghost', size: 'sm', off: true })
      : button({ label: bb.ok ? priceLabel(bb.cost) : bb.reason ?? 'Locked', act: 'buyboat', off: !bb.ok }),
  });
  for (const b of s.boats) {
    h += item({
      art: icon(HULL_ICONS[b.hull], 40),
      title: b.name,
      sub: `${HULL_NAMES[b.hull]} · hold ${holdSize(b)}${b.captain ? ` · captain ${b.captain.name}` : ''}`,
      right: button({ label: 'Manage', act: 'openboat', a: b.id, tone: 'info', size: 'sm' }),
    });
  }
  return h;
}

function harbour(s: GameState): string {
  const rank = rankOf(s);
  return cards(UPGRADE_IDS.map((id) => {
    const u = UPGRADES[id];
    const owned = s.upgrades[id];
    const chk = canBuy(s, id);
    const look = UPGRADE_LOOK[id];
    return card({
      tone: owned ? 'grey' : look.tone,
      tag: owned ? 'Owned' : rank < u.rank ? RANK_NAMES[u.rank] : undefined,
      art: icon(look.icon, 48),
      lines: [u.desc],
      name: u.name,
      foot: owned
        ? button({ label: 'Owned', tone: 'ghost', size: 'sm', off: true })
        : button({ label: chk.ok ? priceLabel(u.cost) : chk.reason ?? 'Locked', act: 'buy', a: id, size: 'sm', off: !chk.ok }),
    });
  }));
}

export const shipyardScreen: Screen = (ctx) => {
  const s = ctx.state;
  const tabs = [{ id: 'fleet', label: `Fleet ${s.boats.length} / ${MAX_BOATS}` }, { id: 'harbour', label: 'Harbour' }];
  const tab = pickTab(ctx, tabs);
  return { title: 'Shipyard', icon: icon('hammer', 28), tabs, tab, body: tab === 'fleet' ? fleet(s) : harbour(s) };
};
