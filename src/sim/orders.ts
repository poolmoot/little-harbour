import {
  FISH, ORDER_BONUS, ORDER_HOURS_MAX, ORDER_HOURS_MIN, ORDER_NAMES, ORDER_QTY_MAX, ORDER_QTY_MIN, ORDER_REFILL_DELAY,
  ORDER_SLOTS, HOUR_SECONDS, ZONES, ZONE_IDS,
} from './config';
import type { Species } from './config';
import type { Rng } from './rng';
import type { Ev, GameState, Order } from './state';
import { nextId } from './state';

export function reachableSpecies(state: GameState): Species[] {
  const out = new Set<Species>();
  for (const z of ZONE_IDS) {
    if (ZONES[z].needsHull && !state.upgrades.hull) continue;
    for (const s of Object.keys(ZONES[z].table) as Species[]) out.add(s);
  }
  return [...out];
}

export function spawnOrder(state: GameState, rng: Rng): Ev[] {
  if (state.orders.length >= ORDER_SLOTS) return [];
  const species = rng.pick(reachableSpecies(state));
  const qty = rng.int(ORDER_QTY_MIN, ORDER_QTY_MAX);
  const hours = rng.range(ORDER_HOURS_MIN, ORDER_HOURS_MAX);
  const taken = new Set(state.orders.map((o) => o.name));
  const names = ORDER_NAMES.filter((n) => !taken.has(n));
  const order: Order = {
    id: nextId(state),
    species,
    qty,
    filled: 0,
    deadline: state.clock + hours * HOUR_SECONDS,
    name: rng.pick(names),
    baseValue: qty * FISH[species].price,
  };
  state.orders.push(order);
  return [{ type: 'orderPosted', orderId: order.id }];
}

/** Fill any empty slots that are not already waiting on a refill timer (used at game start). */
export function fillOrders(state: GameState, rng: Rng): Ev[] {
  const evs: Ev[] = [];
  while (state.orders.length + state.orderCooldowns.length < ORDER_SLOTS) evs.push(...spawnOrder(state, rng));
  return evs;
}

export function stepOrders(state: GameState, dt: number, rng: Rng): Ev[] {
  const evs: Ev[] = [];
  for (const o of [...state.orders]) {
    if (state.clock >= o.deadline) {
      state.orders = state.orders.filter((x) => x.id !== o.id);
      state.orderCooldowns.push(ORDER_REFILL_DELAY);
      state.stats.missed += 1;
      evs.push({ type: 'orderMissed', orderId: o.id, name: o.name });
    }
  }
  state.orderCooldowns = state.orderCooldowns.map((t) => t - dt);
  while (state.orderCooldowns.some((t) => t <= 0)) {
    const i = state.orderCooldowns.findIndex((t) => t <= 0);
    state.orderCooldowns.splice(i, 1);
    evs.push(...spawnOrder(state, rng));
  }
  return evs;
}

/** The open order a sold crate of this species would count toward (earliest deadline first). */
export function matchingOrder(state: GameState, species: Species): Order | null {
  const open = state.orders.filter((o) => o.species === species && o.filled < o.qty);
  open.sort((a, b) => a.deadline - b.deadline);
  return open[0] ?? null;
}

/** Count one sold crate toward its order; pays the bonus if that completes it. */
export function creditOrder(state: GameState, species: Species): Ev[] {
  const o = matchingOrder(state, species);
  if (!o) return [];
  o.filled += 1;
  if (o.filled < o.qty) return [];
  const bonus = Math.round(o.baseValue * ORDER_BONUS);
  state.money += bonus;
  state.stats.earned += bonus;
  state.stats.filled += 1;
  state.orders = state.orders.filter((x) => x.id !== o.id);
  state.orderCooldowns.push(ORDER_REFILL_DELAY);
  return [{ type: 'orderFilled', orderId: o.id, name: o.name, bonus }];
}
