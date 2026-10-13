import type { Species } from './sim/config';

export const SPECIES_COLOUR: Record<Species, number> = {
  herring: 0xb8c7d6,
  mackerel: 0x4f8fb0,
  flounder: 0xd2b48c,
  seabass: 0x7aa58a,
  snapper: 0xe05a4f,
  lobster: 0xa8201a,
};

export const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
