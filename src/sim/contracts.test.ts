import { describe, expect, it } from 'vitest';
import { acceptContract, creditContract, makeOffer, stepContracts } from './contracts';
import { addCrate } from './crates';
import { sellCrate } from './market';
import { CONTRACT_REWARD_MULT, DAY_REAL_SECONDS, FISH_PRICE } from './config';
import { Rng } from './rng';
import { initialState } from './state';
import type { GameState } from './state';

function ready(): GameState {
  const s = initialState();
  s.lifetime = 600; // rank 1
  return s;
}

describe('contracts', () => {
  it('offers nothing before rank 1, then a choice of two different fish', () => {
    const s = initialState();
    const r = new Rng(2);
    expect(stepContracts(s, r)).toHaveLength(0);
    s.lifetime = 600;
    expect(stepContracts(s, r)[0].type).toBe('contractOffered');
    expect(s.contracts.offers).toHaveLength(2);
    expect(s.contracts.offers[0].species).not.toBe(s.contracts.offers[1].species);
    for (const o of s.contracts.offers) {
      expect(o.reward).toBe(Math.round(o.baseValue * CONTRACT_REWARD_MULT));
      expect(o.days === 2 || o.days === 3).toBe(true);
    }
  });
  it('sizes scale with the fleet', () => {
    const small = ready();
    const big = ready();
    big.boats[0].hold = 3;
    big.boats.push({ ...big.boats[0], id: 9, berth: 1 });
    const q = (st: GameState) => { const r = new Rng(5); return makeOffer(st, r, [])!.qty; };
    expect(q(big)).toBeGreaterThan(q(small));
  });
  it('counts only matching crates sold at the market and pays the reward at the end', () => {
    const s = ready();
    s.contracts.active = { id: 50, species: 'herring', smoked: false, qty: 2, filled: 0, days: 2, deadline: 9999, reward: 300, baseValue: 120 };
    const sell = (sp: 'herring' | 'mackerel', smoked = false) => {
      const c = addCrate(s, sp, 'hand');
      c.smoked = smoked;
      return sellCrate(s, c.id);
    };
    sell('mackerel');
    sell('herring', true); // smoked herring does not count for a fresh contract
    expect(s.contracts.active!.filled).toBe(0);
    sell('herring');
    expect(s.contracts.active!.filled).toBe(1);
    const before = s.money;
    const evs = sell('herring');
    expect(evs.some((e) => e.type === 'contractDone')).toBe(true);
    expect(s.money).toBeGreaterThanOrEqual(before + 300);
    expect(s.contracts.active).toBeNull();
    expect(s.tally.contracts).toBe(1);
    expect(creditContract(s, addCrate(s, 'herring', 'hand'))).toHaveLength(0);
  });
  it('accepting clears the board; missing the deadline pays nothing and the board stays empty for a day', () => {
    const s = ready();
    const r = new Rng(8);
    stepContracts(s, r);
    const id = s.contracts.offers[1].id;
    expect(acceptContract(s, id)[0].type).toBe('contractAccepted');
    expect(s.contracts.offers).toHaveLength(0);
    expect(acceptContract(s, id)[0].type).toBe('denied');
    const days = s.contracts.active!.days;
    s.clock = days * DAY_REAL_SECONDS + 1;
    const m = s.money;
    expect(stepContracts(s, r)[0].type).toBe('contractFailed');
    expect(s.money).toBe(m);
    expect(s.contracts.offers).toHaveLength(0);
    s.clock += DAY_REAL_SECONDS - 5;
    expect(stepContracts(s, r)).toHaveLength(0);
    s.clock += 10;
    expect(stepContracts(s, r)[0].type).toBe('contractOffered');
    expect(FISH_PRICE.herring).toBe(6);
  });
});
