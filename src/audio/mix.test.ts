import { describe, expect, it } from 'vitest';
import { ambienceTargets, dayness, pierness, smoothstep } from './mix';

const calm = { rain: 0, storm: 0, fog: 0 };

describe('ambience mix', () => {
  it('smoothstep clamps and eases', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('day is bright at noon, dark at midnight, in between at dawn', () => {
    expect(dayness(12)).toBe(1);
    expect(dayness(0)).toBe(0);
    expect(dayness(23)).toBe(0);
    expect(dayness(6.5)).toBeGreaterThan(0);
    expect(dayness(6.5)).toBeLessThan(1);
    expect(dayness(19.2)).toBeGreaterThan(0);
    expect(dayness(19.2)).toBeLessThan(1);
  });

  it('pier is 0 in town and 1 at the pier end', () => {
    expect(pierness(6)).toBe(0);
    expect(pierness(-10)).toBe(1);
    expect(pierness(-2)).toBeGreaterThan(0);
  });

  it('sea is louder on the pier than in town, and quieter at night', () => {
    const town = ambienceTargets(0, 6, 12, calm).sea;
    const pier = ambienceTargets(0, -14, 12, calm).sea;
    const night = ambienceTargets(0, -14, 1, calm).sea;
    expect(pier).toBeGreaterThan(town);
    expect(night).toBeLessThan(pier);
  });

  it('murmur is strongest by the market, by day only', () => {
    expect(ambienceTargets(-8, 5, 12, calm).murmur).toBeGreaterThan(0.9);
    expect(ambienceTargets(0, -14, 12, calm).murmur).toBe(0);
    expect(ambienceTargets(-8, 5, 1, calm).murmur).toBe(0);
  });

  it('gulls by day, crickets at night, neither in a storm', () => {
    expect(ambienceTargets(0, 6, 12, calm).gulls).toBe(1);
    expect(ambienceTargets(0, 6, 12, calm).crickets).toBe(0);
    expect(ambienceTargets(0, 6, 1, calm).crickets).toBe(1);
    expect(ambienceTargets(0, 6, 1, calm).gulls).toBe(0);
    const storm = { rain: 1, storm: 1, fog: 0 };
    expect(ambienceTargets(0, 6, 12, storm).gulls).toBe(0);
    expect(ambienceTargets(0, 6, 1, storm).crickets).toBe(0);
  });
});
