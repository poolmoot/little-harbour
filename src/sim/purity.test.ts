import { describe, expect, it } from 'vitest';

// The rules must stay pure: nothing in src/sim may import drawing, UI, Three.js or anything outside the sim.
describe('sim stays pure', () => {
  const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const files = Object.keys(sources);

  it('finds the sim files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const f of files) {
    it(`${f} only imports from inside the sim`, () => {
      const text = sources[f];
      const specs = [...text.matchAll(/^\s*(?:import|export)\b[^'"\n]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      const sideEffect = [...text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      for (const s of [...specs, ...sideEffect]) {
        const ok = s.startsWith('./') || (f.endsWith('.test.ts') && s === 'vitest');
        expect(ok, `${f} imports "${s}"`).toBe(true);
      }
    });
  }
});
