import { describe, expect, it } from 'vitest';
import { clamp, lerp, normalizeInto, pickWeighted, Rng } from '../src/core/math';

describe('pickWeighted', () => {
  const entries = [
    ['a', 3],
    ['b', 1],
  ] as const;

  it('choisit selon la position du tirage dans le total des poids', () => {
    expect(pickWeighted(entries, 0)).toBe('a');
    expect(pickWeighted(entries, 0.74)).toBe('a');
    expect(pickWeighted(entries, 0.75)).toBe('b');
    expect(pickWeighted(entries, 0.999)).toBe('b');
  });

  it('respecte les proportions sur beaucoup de tirages', () => {
    const rng = new Rng(1);
    let a = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) if (pickWeighted(entries, rng.next()) === 'a') a++;
    expect(a / n).toBeGreaterThan(0.72);
    expect(a / n).toBeLessThan(0.78);
  });
});

describe('normalizeInto', () => {
  it('ramène la diagonale à une longueur de 1', () => {
    const out = normalizeInto(1, 1, { x: 0, y: 0 });
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
    expect(out.x).toBeCloseTo(Math.SQRT1_2);
  });

  it('laisse un axe simple intact', () => {
    expect(normalizeInto(0, -1, { x: 0, y: 0 })).toEqual({ x: 0, y: -1 });
  });

  it('renvoie (0, 0) pour un vecteur nul, sans division par zéro', () => {
    expect(normalizeInto(0, 0, { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
  });
});

describe('clamp', () => {
  it('borne la valeur entre min et max', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('interpole entre a et b', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 1)).toBe(100);
  });
});

describe('Rng', () => {
  it('la même seed donne la même suite', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('deux seeds différentes donnent des suites différentes', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('next() reste dans [0, 1[', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('int() respecte les bornes incluses et les atteint', () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(1, 3);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
      seen.add(n);
    }
    expect(seen).toEqual(new Set([1, 2, 3]));
  });
});
