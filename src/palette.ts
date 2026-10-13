import type { Species } from './sim/config';

export const SPECIES_COLOUR: Record<Species, number> = {
  herring: 0xb8c7d6,
  mackerel: 0x4f8fb0,
  flounder: 0xd2b48c,
  seabass: 0x7aa58a,
  snapper: 0xe05a4f,
  lobster: 0xa8201a,
  cod: 0x9c8b6a,
  tuna: 0x2f5f9a,
  swordfish: 0x6f7fa8,
  anglerfish: 0x4a3a5a,
  squid: 0xc9585f,
  sturgeon: 0xf2c14e,
};

export const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
