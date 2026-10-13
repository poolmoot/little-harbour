import { MAX_BOATS, UPGRADES, UPGRADE_IDS } from '../../sim/config';
import type { UpgradeId } from '../../sim/config';
import { canBuyBoat, holdSize } from '../../sim/fleet';
import { REPAIR_SECONDS } from '../../sim/config';
import { canRepair, repairCost } from '../../sim/storm';
import { rankOf } from '../../sim/rank';
import type { GameState } from '../../sim/state';
import { canBuy } from '../../sim/upgrades';
import { button, card, cards, item, meter, priceLabel, section } from '../components';
import type { CardTone } from '../components';
import { HULL_ICONS, icon } from '../icons';
import { NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import type { IconName } from '../icons';
import { BOAT_TEXT, SHIPYARD_TEXT } from '../screenText';
import { LABEL, RANK_NAME, UPGRADE, boatType, crates, denyText } from '../text';
import { pickTab } from './types';
import type { Screen } from './types';

const UPGRADE_LOOK: Record<UpgradeId, { tone: CardTone; icon: IconName }> = {
  icebox: { tone: 'blue', icon: 'ice' },
  handcart: { tone: 'orange', icon: 'cart' },
  stall1: { tone: 'green', icon: 'stall' },
  stall2: { tone: 'purple', icon: 'stall' },
};

/** One row per broken boat: a Fix button with cost and time, or a countdown while it is being fixed. */
export function repairs(s: GameState): string {
  const broken = s.boats.filter((b) => b.damaged);
  if (!broken.length) return '';
  return section(SHIPYARD_TEXT.brokenTitle) + broken.map((b) => {
    const cost = repairCost(b);
    if (b.repairLeft !== undefined) {
      return item({ art: icon(HULL_ICONS[b.hull], 40), title: b.name, sub: BOAT_TEXT.fixing(Math.ceil(b.repairLeft)), extra: meter(1 - b.repairLeft / REPAIR_SECONDS, 'amber'), right: button({ label: 'Being fixed', tone: 'ghost', size: 'sm', off: true }) });
    }
    const chk = canRepair(s, b.id);
    return item({
      art: icon(HULL_ICONS[b.hull], 40),
      title: `${b.name} · ${BOAT_TEXT.broken}`,
      sub: `${SHIPYARD_TEXT.fixCost(cost)} · ${SHIPYARD_TEXT.fixTime(REPAIR_SECONDS)}${b.status === 'docked' ? '' : ` · ${SHIPYARD_TEXT.unloadFirst}`}`,
      right: button({ label: `${SHIPYARD_TEXT.fix} ${priceLabel(cost)}`, act: 'repair', a: b.id, size: 'sm', off: !chk.ok }),
    });
  }).join('');
}

function fleet(s: GameState): string {
  const bb = canBuyBoat(s);
  let h = repairs(s) + (s.boats.some((b) => b.damaged) ? section(SHIPYARD_TEXT.yourBoats) : '') + item({
    art: icon('rowboat', 40),
    title: bb.cost === null ? 'You have all four boats' : 'New rowboat',
    sub: bb.cost === null ? 'Every boat spot is used.' : `It gets boat spot ${s.boats.length + 1}. Make it better after you buy it.`,
    state: bb.cost === null ? 'locked' : undefined,
    right: bb.cost === null
      ? button({ label: LABEL.full, tone: 'ghost', size: 'sm', off: true })
      : button({ label: bb.ok ? priceLabel(bb.cost) : denyText(bb.reason, bb.needRank), act: 'buyboat', off: !bb.ok }),
  });
  for (const b of s.boats) {
    h += item({
      art: icon(HULL_ICONS[b.hull], 40),
      title: b.name,
      sub: `${boatType(b.hull)} · carries ${crates(holdSize(b))}${b.captain ? ` · captain ${b.captain.name}` : ''}`,
      right: button({ label: LABEL.open, act: 'openboat', a: b.id, tone: 'info', size: 'sm' }),
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
      tag: owned ? LABEL.owned : rank < u.rank ? RANK_NAME[u.rank] : undefined,
      art: icon(look.icon, 48),
      lines: [UPGRADE[id].desc],
      name: UPGRADE[id].name,
      foot: owned
        ? button({ label: LABEL.owned, tone: 'ghost', size: 'sm', off: true })
        : button({ label: chk.ok ? priceLabel(u.cost) : denyText(chk.reason, chk.needRank), act: 'buy', a: id, size: 'sm', off: !chk.ok }),
    });
  }));
}

export const shipyardScreen: Screen = (ctx) => {
  const s = ctx.state;
  const broken = s.boats.filter((b) => b.damaged).length;
  const tabs = [{ id: 'fleet', label: `Your boats ${s.boats.length} / ${MAX_BOATS}${broken ? SHIPYARD_TEXT.tabBroken(broken) : ''}` }, { id: 'harbour', label: 'For the harbour' }];
  const tab = pickTab(ctx, tabs);
  return { title: 'Shipyard', icon: icon('hammer', 28), host: portrait(NPC_LOOK.shipwright), tabs, tab, body: tab === 'fleet' ? fleet(s) : harbour(s) };
};
