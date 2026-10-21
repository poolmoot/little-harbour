import { describe, expect, it } from 'vitest';
import { button, buyLabel, card, esc, freshMeter, item, levelDots, lockInfo, lockNote, meter, money, mult, nameFeedback, percent, slider, stars, textField, tick } from './components';

describe('ui components', () => {
  it('formats money and multipliers', () => {
    expect(money(11100.4)).toBe('11,100');
    expect(mult(1.5)).toBe('1.5');
    expect(mult(2)).toBe('2');
  });

  it('builds a button with its action and arguments', () => {
    const h = button({ label: 'Buy', act: 'up', a: 3, b: 'hull', size: 'sm' });
    expect(h).toContain('data-act="up"');
    expect(h).toContain('data-a="3"');
    expect(h).toContain('data-b="hull"');
    expect(h).toContain('sm');
    expect(h).not.toContain('off');
  });

  it('marks unavailable buttons as off so clicks are ignored', () => {
    expect(button({ label: 'Locked', act: 'buy', off: true })).toMatch(/class="[^"]*\boff\b/);
  });

  it('clamps meters to 0-100%', () => {
    expect(meter(1.7, 'cyan')).toContain('width:100%');
    expect(meter(-1, 'cyan')).toContain('width:0%');
    expect(meter(0.255, 'cyan')).toContain('width:26%');
  });

  it('colours freshness by how fresh the crate is', () => {
    expect(freshMeter(90)).toContain('green');
    expect(freshMeter(45)).toContain('amber');
    expect(freshMeter(10)).toContain('red');
  });

  it('draws one star per level, filled up to the current level', () => {
    const h = stars(2, 4);
    expect(h.match(/<svg/g)).toHaveLength(4);
    expect(h.match(/#ffd83a/g)).toHaveLength(2);
  });

  it('only renders the optional parts of cards and items that are given', () => {
    expect(card({ tone: 'blue', art: '', name: 'Sails' })).not.toContain('card-foot');
    expect(card({ tone: 'blue', art: '', name: 'Sails', tag: 'New', foot: 'x' })).toContain('card-foot');
    expect(item({ title: 'Gull' })).not.toContain('item-sub');
    expect(item({ title: 'Gull', state: 'locked' })).toContain('locked');
  });

  it('draws a slider that reports its setting and shows a whole percent', () => {
    const h = slider({ id: 'music', value: 0.5, label: 'Music' });
    expect(h).toContain('type="range"');
    expect(h).toContain('data-slider="music"');
    expect(h).toContain('value="50"');
    expect(h).toContain('--fill:50%');
    expect(h).toContain('50%</span>');
    expect(h).toContain('aria-label="Music"');
  });

  it('keeps slider values between 0 and 100', () => {
    expect(percent(1.4)).toBe(100);
    expect(percent(-2)).toBe(0);
    expect(percent(0.334)).toBe(33);
    expect(slider({ id: 'a', value: 9, label: 'A' })).toContain('value="100"');
  });

  it('dims a slider that is switched off', () => {
    expect(slider({ id: 'a', value: 0.2, label: 'A', off: true })).toContain('dim');
    expect(slider({ id: 'a', value: 0.2, label: 'A' })).not.toContain('dim');
  });

  it('draws a tick box as one button with an action and a tick when on', () => {
    const on = tick({ label: 'Herring', on: true, act: 'smoke', a: 'herring' });
    expect(on).toContain('data-act="smoke"');
    expect(on).toContain('data-a="herring"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('class="tick ol on"');
    expect(on).toContain('<svg');
    const off = tick({ label: 'Cod', on: false, act: 'smoke', a: 'cod', off: true });
    expect(off).toContain('aria-checked="false"');
    expect(off).not.toContain('<svg');
    expect(off).toContain('off');
  });
});

describe('text field', () => {
  const field = (value: string) => textField({ id: 'boatname', value, label: 'Boat name', save: 'renameboat', a: 7, saveLabel: 'Save name' });

  it('draws a text input that carries its field id, save action, argument and the old name', () => {
    const h = field('Spray');
    expect(h).toContain('type="text"');
    expect(h).toContain('data-field="boatname"');
    expect(h).toContain('data-save="renameboat"');
    expect(h).toContain('data-a="7"');
    expect(h).toContain('data-orig="Spray"');
    expect(h).toContain('value="Spray"');
    expect(h).toContain('aria-label="Boat name"');
  });

  it('has a Save button wired to the same action, ready to press for a good name', () => {
    const h = field('Spray');
    expect(h).toContain('data-act="renameboat"');
    expect(h).not.toMatch(/class="[^"]*\boff\b/);
    expect(h).not.toContain(' bad');
  });

  it('greys out Save and shows the plain message for a name that is not allowed', () => {
    const empty = field('   ');
    expect(empty).toMatch(/class="btn[^"]*\boff\b/);
    expect(empty).toContain('Please type a name.');
    expect(field('A very very long boat name')).toContain('too long');
    expect(field('Bad <name>')).toContain('Please use only letters, numbers and spaces.');
  });

  it('makes typed text safe to put in the page', () => {
    expect(esc('Tom & "Jerry"')).toBe('Tom &amp; &quot;Jerry&quot;');
    expect(field('Tom & Co')).toContain('value="Tom &amp; Co"');
  });

  it('checks names live with the same rule the game uses', () => {
    expect(nameFeedback('Seagull Bay')).toEqual({ ok: true, message: '' });
    expect(nameFeedback('').ok).toBe(false);
    expect(nameFeedback('x'.repeat(17)).message).toContain('16');
    expect(nameFeedback("Mum's boat!").ok).toBe(true);
  });
});

describe('main action button', () => {
  it('is large, marked as the hero and shows the Enter key while it can be pressed', () => {
    const h = button({ label: 'Send out', act: 'send', hero: true });
    expect(h).toMatch(/class="[^"]*\bhero\b/);
    expect(h).toMatch(/class="[^"]*\blg\b/);
    expect(h).toContain('Enter');
  });
  it('drops the shine and the key when it is greyed out', () => {
    const h = button({ label: 'Too dark', act: 'send', hero: true, off: true });
    expect(h).not.toMatch(/\bhero\b/);
    expect(h).not.toContain('Enter');
  });
});

describe('locked things', () => {
  const base = { money: 100, rank: 1 };

  it('says which rank is needed and which one the player is', () => {
    const h = lockNote({ ...base, cost: 900, needRank: 2 });
    expect(h).toContain('Needs rank: Small Company (you are Boat Owner)');
    expect(h).toContain('lock rank');
    expect(h).toContain('900');
    expect(h).not.toContain('meter');
  });

  it('says how much money is missing and draws a bar towards it', () => {
    const h = lockNote({ ...base, cost: 220, reason: 'Not enough money' });
    expect(h).toContain('You need $120 more');
    expect(h).toContain('$100 of $220');
    expect(h).toContain('width:45%');
  });

  it('puts rank before money, and passes other reasons through', () => {
    expect(lockInfo({ ...base, cost: 5000, needRank: 3 }).kind).toBe('rank');
    expect(lockInfo({ ...base, cost: 50, reason: 'Buy the smaller one first' })).toEqual({ kind: 'other', why: 'Buy the smaller one first' });
    expect(lockInfo({ ...base, needRank: 1 }).kind).toBe('other');
  });

  it('draws a padlock', () => {
    expect(lockNote({ ...base, reason: 'Nope' })).toContain('<svg');
  });

  it('builds a buy label with a dash and the price, and level dots', () => {
    expect(buyLabel('Upgrade', 1300)).toContain('Upgrade — ');
    expect(buyLabel('Upgrade', 1300)).toContain('1,300');
    const d = levelDots(2, 3);
    expect(d.match(/<i/g)).toHaveLength(3);
    expect(d.match(/class="on"/g)).toHaveLength(2);
  });
});
