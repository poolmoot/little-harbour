import { describe, expect, it } from 'vitest';
import { button, card, freshMeter, item, meter, money, mult, percent, slider, stars, tick } from './components';

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
