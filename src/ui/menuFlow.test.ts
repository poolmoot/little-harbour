import { describe, expect, it } from 'vitest';
import { escapeAction, isHalted, isMenuKind } from './menuFlow';

describe('menu flow', () => {
  it('pauses on Esc when nothing is open, and resumes on the next Esc', () => {
    expect(escapeAction('play', null)).toBe('pause');
    expect(escapeAction('paused', 'pause')).toBe('resume');
  });

  it('closes an ordinary window first, without pausing', () => {
    expect(escapeAction('play', 'market')).toBe('close');
    expect(escapeAction('play', 'logbook')).toBe('close');
  });

  it('steps back out of settings and how to play, from either menu', () => {
    expect(escapeAction('paused', 'settings')).toBe('back');
    expect(escapeAction('title', 'howto')).toBe('back');
    expect(escapeAction('title', 'privacy')).toBe('back');
    expect(escapeAction('title', 'terms')).toBe('back');
  });

  it('does nothing on the title screen itself', () => {
    expect(escapeAction('title', 'title')).toBe('none');
  });

  it('halts the world on the title screen and while paused only', () => {
    expect(isHalted('title')).toBe(true);
    expect(isHalted('paused')).toBe(true);
    expect(isHalted('play')).toBe(false);
  });

  it('tells menu screens from game windows', () => {
    expect(isMenuKind('pause')).toBe(true);
    expect(isMenuKind('market')).toBe(false);
    expect(isMenuKind(null)).toBe(false);
  });
});
