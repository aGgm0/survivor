import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { DamageNumberSystem } from '../src/systems/DamageNumberSystem';

const DT = 1 / 60;
const active = (s: DamageNumberSystem) => s.numbers.items.filter((n) => n.active);

describe('DamageNumberSystem', () => {
  it('affiche la valeur en texte, près du point d’impact', () => {
    const s = new DamageNumberSystem(new Rng(1));
    s.spawn(100, 50, 10);
    const n = active(s)[0];
    expect(n?.text).toBe('10');
    expect(Math.abs((n?.x ?? 0) - 100)).toBeLessThanOrEqual(10);
    expect(n?.y).toBe(50);
  });

  it('monte puis disparaît après sa durée de vie', () => {
    const s = new DamageNumberSystem(new Rng(1));
    s.spawn(0, 0, 5);
    for (let i = 0; i < 10; i++) s.update(DT);
    expect(active(s)[0]?.y).toBeLessThan(0);
    for (let i = 0; i < 60; i++) s.update(DT);
    expect(s.numbers.activeCount).toBe(0);
  });

  it('réutilise le même texte pour une même valeur (pas de nouvelle chaîne)', () => {
    const s = new DamageNumberSystem(new Rng(1));
    s.spawn(0, 0, 10);
    s.spawn(0, 0, 10);
    const [a, b] = active(s);
    expect(a?.text).toBe(b?.text);
  });

  it('réserve pleine : ignore les nouveaux nombres sans planter', () => {
    const s = new DamageNumberSystem(new Rng(1));
    for (let i = 0; i < 1000; i++) s.spawn(0, 0, 1);
    expect(s.numbers.activeCount).toBe(s.numbers.capacity);
  });
});
