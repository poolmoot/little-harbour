import { describe, expect, it } from 'vitest';
import { keyBelongsToField } from './input';

describe('keys while a form control has the keyboard', () => {
  it('lets a text field keep every key, including Esc', () => {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyL', 'KeyM', 'ArrowLeft', 'Space', 'Escape']) {
      expect(keyBelongsToField({ tagName: 'INPUT', type: 'text' }, code)).toBe(true);
    }
  });
  it('lets a slider keep its keys except Esc, which still reaches the game', () => {
    expect(keyBelongsToField({ tagName: 'INPUT', type: 'range' }, 'ArrowLeft')).toBe(true);
    expect(keyBelongsToField({ tagName: 'INPUT', type: 'range' }, 'Escape')).toBe(false);
  });
  it('does not block keys on the page itself or on buttons', () => {
    expect(keyBelongsToField(null, 'KeyW')).toBe(false);
    expect(keyBelongsToField({ tagName: 'BODY' }, 'KeyW')).toBe(false);
    expect(keyBelongsToField({ tagName: 'BUTTON' }, 'KeyE')).toBe(false);
  });
});
