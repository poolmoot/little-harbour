import { FLOUNDER_TWILIGHT_MULT, PIER_TABLE, ZONES } from './config';
import type { Phase, Species, ZoneId } from './config';
import type { Rng } from './rng';

export function zoneWeights(zone: ZoneId, phase: Phase): Partial<Record<Species, number>> {
  const t: Partial<Record<Species, number>> = { ...ZONES[zone].table };
  if (t.flounder !== undefined && (phase === 'dawn' || phase === 'dusk')) {
    t.flounder *= FLOUNDER_TWILIGHT_MULT;
  }
  return t;
}

export function rollCatch(zone: ZoneId, phase: Phase, count: number, rng: Rng): Species[] {
  const w = zoneWeights(zone, phase);
  const out: Species[] = [];
  for (let i = 0; i < count; i++) out.push(rng.weighted(w));
  return out;
}

export function rollPier(rng: Rng): Species {
  return rng.weighted(PIER_TABLE);
}
