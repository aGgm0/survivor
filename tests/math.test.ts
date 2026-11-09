import { describe, expect, it } from 'vitest';
import { clamp, lerp, Rng } from '../src/core/math';

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
