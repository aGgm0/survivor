import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { ParticleSystem } from '../src/systems/ParticleSystem';

const BURST = { count: 10, speedMin: 100, speedMax: 200, size: 4, life: 0.5 };

describe('ParticleSystem', () => {
  it('une gerbe ajoute ses éclats, qui disparaissent à la fin de leur vie', () => {
    const ps = new ParticleSystem(100, new Rng(1), 5);
    ps.burst(0, 0, BURST, '#fff');
    expect(ps.activeCount).toBe(10);
    for (let i = 0; i < 40; i++) ps.update(1 / 60); // 0,66 s > durée de vie max (0,5 s)
    expect(ps.activeCount).toBe(0);
  });

  it('réserve pleine : les éclats en trop sont sautés, sans planter', () => {
    const ps = new ParticleSystem(15, new Rng(1), 5);
    ps.burst(0, 0, BURST, '#fff');
    ps.burst(0, 0, BURST, '#fff');
    expect(ps.activeCount).toBe(15);
  });

  it('nombre d’éclats imposé (ex. selon la taille de l’ennemi)', () => {
    const ps = new ParticleSystem(100, new Rng(1), 5);
    ps.burst(0, 0, BURST, '#fff', 3);
    expect(ps.activeCount).toBe(3);
  });

  it('a son propre aléatoire : ne consomme pas celui du jeu', () => {
    const game = new Rng(42);
    const ps = new ParticleSystem(100, new Rng(7), 5);
    const before = new Rng(42).next();
    ps.burst(0, 0, BURST, '#fff');
    expect(game.next()).toBe(before);
  });
});
