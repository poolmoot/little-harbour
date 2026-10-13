import { FLOUNDER_TWILIGHT_MULT, PIER_TABLE, ZONES } from './config';
import type { Phase, Species, ZoneId } from './config';
import type { Rng } from './rng';

/** The lowest-weight species of a zone: the one Gear and Lucky captains favour. */
function rareSpecies(zone: ZoneId): Species {
  const e = Object.entries(ZONES[zone].table) as [Species, number][];
  return e.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

export function zoneWeights(zone: ZoneId, phase: Phase, rareMult = 1): Partial<Record<Species, number>> {
  const t: Partial<Record<Species, number>> = { ...ZONES[zone].table };
  const rare = rareSpecies(zone);
  t[rare] = (t[rare] ?? 0) * rareMult;
  if (t.flounder !== undefined && (phase === 'dawn' || phase === 'dusk')) {
    t.flounder *= FLOUNDER_TWILIGHT_MULT;
  }
  return t;
}

export function rollCatch(zone: ZoneId, phase: Phase, count: number, rng: Rng, rareMult = 1): Species[] {
  const w = zoneWeights(zone, phase, rareMult);
  const out: Species[] = [];
  for (let i = 0; i < count; i++) out.push(rng.weighted(w));
  return out;
}

export function rollPier(rng: Rng): Species {
  return rng.weighted(PIER_TABLE);
}
