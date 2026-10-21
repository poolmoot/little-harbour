import { MAX_BOATS, TRACKS, TRACK_MAX, UPGRADES, UPGRADE_IDS } from '../../sim/config';
import type { UpgradeId } from '../../sim/config';
import { holdSize } from '../../sim/fleet';
import { REPAIR_SECONDS } from '../../sim/config';
import { canRepair, repairCost } from '../../sim/storm';
import { rankOf } from '../../sim/rank';
import type { GameState } from '../../sim/state';
import { canBuy } from '../../sim/upgrades';
import { button, buyLabel, card, cards, esc, item, levelDots, lockNote, meter, priceLabel, section } from '../components';
import type { CardTone } from '../components';
import { HULL_ICONS, icon } from '../icons';
import { NPC_LOOK } from '../../view/people';
import { portrait } from '../../view/portraits';
import type { IconName } from '../icons';
import { boatOffer, offerButton, offerIcon } from '../boatOffer';
import { BOAT_OFFER_TEXT, CAPTAIN_TEXT, BOAT_TEXT, LOCK_TEXT, SHIPYARD_TEXT, YARD_TEXT } from '../screenText';
import { LABEL, UPGRADE, boatType, crates } from '../text';
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
      return item({ art: icon(HULL_ICONS[b.hull], 40), title: esc(b.name), sub: BOAT_TEXT.fixing(Math.ceil(b.repairLeft)), extra: meter(1 - b.repairLeft / REPAIR_SECONDS, 'amber'), right: button({ label: 'Being fixed', tone: 'ghost', size: 'sm', off: true }) });
    }
    const chk = canRepair(s, b.id);
    return item({
      art: icon(HULL_ICONS[b.hull], 40),
      title: `${esc(b.name)} · ${BOAT_TEXT.broken}`,
      sub: `${SHIPYARD_TEXT.fixCost(cost)} · ${SHIPYARD_TEXT.fixTime(REPAIR_SECONDS)}${b.status === 'docked' ? '' : ` · ${SHIPYARD_TEXT.unloadFirst}`}`,
      right: button({ label: `${SHIPYARD_TEXT.fix} ${priceLabel(cost)}`, act: 'repair', a: b.id, size: 'sm', off: !chk.ok }),
    });
  }).join('');
}

/** One card per boat: its name, size, its upgrades in short, and a big Open button. */
function boatCard(b: GameState['boats'][number]): string {
  const ups = TRACKS.map((t) => `<span>${YARD_TEXT.upgradeShort[t]} ${levelDots(b[t], TRACK_MAX[t])}</span>`).join('');
  const who = b.captain ? YARD_TEXT.captain(esc(b.captain.name)) : '';
  const where = b.damaged ? `<span class="bad">${BOAT_TEXT.broken}</span>` : b.status === 'docked' ? YARD_TEXT.docked : YARD_TEXT.away;
  return `<div class="bcard${b.damaged ? ' broken' : ''}"><div class="bcard-art">${icon(HULL_ICONS[b.hull], 64)}</div>`
    + `<div class="bcard-main"><div class="item-title ol">${esc(b.name)}</div>`
    + `<div class="bcard-line">${boatType(b.hull)} · carries ${crates(holdSize(b))} · ${where}</div>`
    + `<div class="bcard-line">${b.captain ? `${who} · <b>${CAPTAIN_TEXT.selfSails}</b>` : `${CAPTAIN_TEXT.youSend}`}</div>`
    + `<div class="bcard-ups">${ups}</div></div>`
    + `<div class="bcard-act">${button({ label: `${YARD_TEXT.open} ${esc(b.name)}`, act: 'openboat', a: b.id, tone: 'info' })}${b.captain ? '' : button({ label: CAPTAIN_TEXT.getButton, act: 'openboat', a: b.id, tone: 'gold', size: 'sm' })}</div></div>`;
}

function yourBoats(s: GameState): string {
  return section(YARD_TEXT.yourBoats(s.boats.length, MAX_BOATS)) + `<p class="yard-help">${YARD_TEXT.yourBoatsHelp}</p>`
    + (s.boats.length ? s.boats.map(boatCard).join('') : `<p class="dim">${YARD_TEXT.noBoats}</p>`);
}

function buyBoat(s: GameState): string {
  const o = boatOffer(s);
  if (o.cost === null) return section(YARD_TEXT.buyTitle) + `<p class="yard-help">${YARD_TEXT.allBoats}</p>`;
  return section(YARD_TEXT.buyTitle) + `<p class="yard-help">${YARD_TEXT.buyHelp}</p>`
    + `<div class="bcard offer"><div class="bcard-art">${offerIcon(64)}</div>`
    + `<div class="bcard-main"><div class="item-title ol">${BOAT_OFFER_TEXT.name} <span class="dim">· ${BOAT_OFFER_TEXT.spot(o.spot)}</span></div>`
    + `<div class="bcard-line">${o.can}</div>${o.lock}</div>`
    + `<div class="bcard-act">${offerButton(s, o)}</div></div>`;
}

function harbour(s: GameState): string {
  const rank = rankOf(s);
  return section(YARD_TEXT.harbourTitle) + `<p class="yard-help">${YARD_TEXT.harbourHelp}</p>` + cards(UPGRADE_IDS.map((id) => {
    const u = UPGRADES[id];
    const owned = s.upgrades[id];
    const chk = canBuy(s, id);
    const look = UPGRADE_LOOK[id];
    const rankLocked = !chk.ok && chk.needRank !== undefined;
    return card({
      tone: owned ? 'grey' : look.tone,
      tag: owned ? YARD_TEXT.owned : undefined,
      art: icon(look.icon, 56),
      lines: [UPGRADE[id].desc],
      name: UPGRADE[id].name,
      foot: owned
        ? button({ label: LABEL.owned, tone: 'ghost', size: 'sm', off: true })
        : (chk.ok ? '' : lockNote({ cost: u.cost, money: s.money, rank, needRank: chk.needRank, reason: chk.reason }))
          + `<span class="price ol">${LOCK_TEXT.price}: ${priceLabel(u.cost)}</span>`
          + button({ label: rankLocked ? `${icon('lock', 18)}${LOCK_TEXT.locked}` : buyLabel(YARD_TEXT.buy, u.cost), act: 'buy', a: id, size: 'sm', off: !chk.ok }),
    });
  }), 230);
}

/** One page for everything: your boats, a new boat, and what helps the whole harbour. No hidden tabs. */
export const shipyardScreen: Screen = (ctx) => {
  const s = ctx.state;
  return {
    title: 'Shipyard', icon: icon('hammer', 28), host: portrait(NPC_LOOK.shipwright), note: YARD_TEXT.note,
    body: repairs(s) + yourBoats(s) + buyBoat(s) + harbour(s),
  };
};
