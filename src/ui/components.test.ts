import { describe, expect, it } from 'vitest';
import { button, card, freshMeter, item, meter, money, mult, stars } from './components';

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
});
