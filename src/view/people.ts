import type { Trait } from '../sim/config';
import type { Role } from '../ui/text';
import type { FigureOpts } from './figures';

/** How each person in the harbour looks. The 3D figures and the portraits in the menus both read from here, so they always match. */

const SKINS = [0xf6c9a0, 0xe8b890, 0xf2d2b4, 0xc98f62, 0x9a6a48];
const HAIRS = [0x4a3626, 0x7a4a24, 0x2a2018, 0xb5651d, 0xd9a03a, 0x8a8a8a];
const SHIRTS = [0x5a8a6a, 0xb5883a, 0x7a6aa8, 0x4a7aa8];
const TRAIT_HAT: Record<Trait, number> = { swift: 0x4aa3d8, lucky: 0x4f9a5a, careful: 0xd9a53a, thrifty: 0x9a6ab0 };

/** A stable pick from a list for a person id, different for each `salt` so skin, hair and beard do not move together. */
const pick = <T>(list: readonly T[], id: number, salt: number): T => list[(id * 7 + salt * 13) % list.length];

export function dockhandLook(id: number): FigureOpts {
  const hair = pick(HAIRS, id, 1);
  return {
    shirt: SHIRTS[id % SHIRTS.length], pants: 0x4a4038, hat: id % 2 ? 'straw' : 'cap', hatColor: 0xc9a24a, scale: 0.95,
    skin: pick(SKINS, id, 2), hair, beard: id % 3 === 0 ? hair : undefined,
  };
}

export function captainLook(id: number, trait: Trait): FigureOpts {
  const hair = pick(HAIRS, id, 3);
  return {
    shirt: 0xf0e8d8, pants: 0x2f3b47, hat: 'cap', hatColor: TRAIT_HAT[trait], scale: 0.8, scarf: 0x2f3b47,
    skin: pick(SKINS, id, 4), hair, beard: id % 2 === 0 ? hair : undefined,
  };
}

/** The three shopkeepers who stand at the market, the shipyard and the inn. */
export const NPC_LOOK: Record<Role, FigureOpts> = {
  fishmonger: { shirt: 0xe8e4d8, pants: 0x3f5f7f, apron: 0xffffff, hat: 'cap', hatColor: 0xf2c14e, hair: 0xb5651d },
  shipwright: { shirt: 0x4a6a8a, pants: 0x5a4a3a, hat: 'cap', hatColor: 0x2f3b47, beard: 0x8a7a6a },
  innkeeper: { shirt: 0xb5483a, pants: 0x5a4a3a, apron: 0xf0e8d8, skin: 0xe8b890, scale: 1.05, hair: 0x3a2a1a, beard: 0x3a2a1a },
};

const TOWN_SHIRTS = [0xe8c14a, 0xd9705a, 0x6fae7e, 0xb58ad6, 0x4a7aa8, 0xe29a5c, 0x8fb8d8, 0xc86a8a, 0x7ab07a, 0xf0e8d8];
const TOWN_PANTS = [0x5a4a6a, 0x3f4f5f, 0x6a5238, 0x4a4038, 0x2f3b47, 0x5f6a4a];
const TOWN_HATS: (FigureOpts['hat'])[] = ['none', 'cap', 'straw', 'none', 'cap'];

/** A look for the n-th townsperson (queue customers, diners, crowds, extra strollers): varied clothes, skin and hair, the same every run. */
export function townLook(n: number): FigureOpts {
  const hat = TOWN_HATS[(n * 3 + 1) % TOWN_HATS.length];
  const hair = pick(HAIRS, n, 5);
  return {
    shirt: TOWN_SHIRTS[(n * 7 + 2) % TOWN_SHIRTS.length], pants: TOWN_PANTS[(n * 5 + 1) % TOWN_PANTS.length],
    hat, hatColor: TOWN_SHIRTS[(n * 3 + 5) % TOWN_SHIRTS.length], skin: pick(SKINS, n, 6), hair,
    beard: n % 5 === 2 ? hair : undefined, scarf: n % 4 === 1 ? 0x3f8fbf : undefined,
    scale: 0.9 + ((n * 37) % 11) / 100,
  };
}
