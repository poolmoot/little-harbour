import {
  BIG_CATCH_CHANCE, BIG_CATCH_EXTRA, MARKET_DAY_CHANCE, MARKET_DAY_MULT, STORM_FIRST_DAY, STORM_ZONES, WEATHER_CHANCE,
  WEATHER_TRIP_MULT, ZONE_IDS,
} from './config';
import type { WeatherId, ZoneId } from './config';
import type { Rng } from './rng';
import type { Ev, Forecast, GameState, Special } from './state';

/** Weather for a given day number. No storms in the first days. */
export function rollWeather(day: number, rng: Rng): WeatherId {
  const table: Partial<Record<WeatherId, number>> = { ...WEATHER_CHANCE };
  if (day < STORM_FIRST_DAY) delete table.storm;
  return rng.weighted(table);
}

/** About one day in six is a market day, about one in five a big catch day (never both). */
export function rollSpecial(rng: Rng): Special {
  const r = rng.next();
  if (r < MARKET_DAY_CHANCE) return { kind: 'market' };
  if (r < MARKET_DAY_CHANCE + BIG_CATCH_CHANCE) return { kind: 'bigcatch', zone: rng.pick(ZONE_IDS) };
  return null;
}

/** New game: roll the forecast for day 2. Day 1 is calm. */
export function startWeather(state: GameState, rng: Rng): void {
  state.nextWeather = rollWeather(state.day + 1, rng);
  state.nextSpecial = rollSpecial(rng);
}

/** Called when a new day begins: tomorrow's weather becomes today's, and a new forecast is rolled. */
export function rollNewDay(state: GameState, rng: Rng): { forecast: Forecast; ev: Ev } {
  state.weather = state.nextWeather;
  state.special = state.nextSpecial;
  state.nextWeather = rollWeather(state.day + 1, rng);
  state.nextSpecial = rollSpecial(rng);
  const forecast: Forecast = { weather: state.weather, special: state.special, tomorrowWeather: state.nextWeather, tomorrowSpecial: state.nextSpecial };
  return { forecast, ev: { type: 'weatherChanged', weather: forecast.weather, special: forecast.special, tomorrowWeather: forecast.tomorrowWeather, tomorrowSpecial: forecast.tomorrowSpecial } };
}

export const isStorm = (state: GameState): boolean => state.weather === 'storm';
export const isStormZone = (zone: ZoneId): boolean => STORM_ZONES.includes(zone);
export const weatherTripMult = (state: GameState): number => WEATHER_TRIP_MULT[state.weather];
export const marketMult = (state: GameState): number => (state.special?.kind === 'market' ? MARKET_DAY_MULT : 1);
/** Extra crates a trip to this zone brings today. */
export function bigCatchExtra(state: GameState, zone: ZoneId): number {
  return state.special?.kind === 'bigcatch' && state.special.zone === zone ? BIG_CATCH_EXTRA : 0;
}
