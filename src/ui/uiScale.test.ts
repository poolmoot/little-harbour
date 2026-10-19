import { describe, expect, it } from 'vitest';
import { uiZoom } from './uiScale';

describe('ui scale', () => {
  it('never shrinks below the designed size', () => {
    expect(uiZoom(800, 600)).toBe(1);
  });
  it('grows with the smaller of the two window sides', () => {
    expect(uiZoom(1920, 1080)).toBeCloseTo(1080 / 760, 3);
    expect(uiZoom(2560, 900)).toBeCloseTo(900 / 760, 3);
  });
  it('stops at its limit on very large screens', () => {
    expect(uiZoom(5120, 2880)).toBe(1.6);
    expect(uiZoom(5120, 2880, 1.45)).toBe(1.45);
  });
});
