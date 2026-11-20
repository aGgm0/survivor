import { describe, expect, it } from 'vitest';
import { runSim } from '../sim/runSim';

// Bornes larges : on vérifie que le bot joue vraiment (pas que le jeu est équilibré). Les mesures
// d'équilibrage se font avec `npm run sim`, beaucoup plus long.
describe('bot de simulation', () => {
  it('survit à la première minute et monte de niveau', () => {
    for (const seed of [1, 2]) {
      const r = runSim(seed, undefined, 60);
      expect(r.alive).toBe(true);
      expect(r.time).toBeGreaterThanOrEqual(60);
      expect(r.level).toBeGreaterThanOrEqual(2);
    }
  });

  it('même seed = même partie (reproductible)', () => {
    const a = runSim(3, undefined, 30);
    const b = runSim(3, undefined, 30);
    expect(b.level).toBe(a.level);
    expect(b.minHpShare).toBe(a.minHpShare);
  });
});
