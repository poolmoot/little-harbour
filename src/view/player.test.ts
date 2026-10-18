import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Player } from './player';
import type { World } from './world';

const open = { resolve: (_px: number, _pz: number, nx: number, nz: number) => ({ x: nx, z: nz }) } as unknown as World;
const wallAt = (zWall: number) => ({ resolve: (_px: number, pz: number, nx: number, nz: number) => (nz < zWall ? { x: nx, z: pz } : { x: nx, z: nz }) }) as unknown as World;

function run(p: Player, frames: number, move: { x: number; z: number }): number[] {
  const speeds: number[] = [];
  for (let i = 0; i < frames; i++) { p.update(1 / 60, move, false, false); speeds.push(p.speed); }
  return speeds;
}

describe('player movement', () => {
  it('eases up to full speed and stops without sliding', () => {
    const p = new Player(new THREE.Scene(), open);
    const up = run(p, 60, { x: 0, z: -1 });
    expect(up[0]).toBeLessThan(2);                 // not instant
    expect(up[up.length - 1]).toBeGreaterThan(5.1); // but quick
    const z0 = p.pos.z;
    const down = run(p, 30, { x: 0, z: 0 });
    expect(down[down.length - 1]).toBe(0);
    expect(Math.abs(p.pos.z - z0)).toBeLessThan(0.5);
  });

  it('is as fast diagonally as straight', () => {
    const a = new Player(new THREE.Scene(), open), b = new Player(new THREE.Scene(), open);
    run(a, 60, { x: 0, z: -1 });
    run(b, 60, { x: Math.SQRT1_2, z: -Math.SQRT1_2 });
    expect(b.speed).toBeCloseTo(a.speed, 1);
  });

  it('turns over several frames, not at once', () => {
    const p = new Player(new THREE.Scene(), open);
    run(p, 20, { x: 1, z: 0 });
    const before = p.facing;
    p.update(1 / 60, { x: -1, z: 0 }, false, false);
    expect(Math.abs(p.facing - before)).toBeLessThan(0.3);
  });

  it('stands still without jitter when pushing into a wall', () => {
    const p = new Player(new THREE.Scene(), wallAt(-3));
    p.pos.set(0, 0, -3);
    const speeds = run(p, 90, { x: 0, z: -1 });
    expect(Math.max(...speeds)).toBeLessThan(0.05);
    expect(p.pos.z).toBeCloseTo(-3, 6);
  });
});
