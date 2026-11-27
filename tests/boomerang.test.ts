import { describe, expect, it } from 'vitest';
import { PLAIN_ENEMY_TYPES as ENEMY_TYPES } from '../sim/plainEnemies';
import { Pool } from '../src/core/Pool';
import { WEAPONS } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { WeaponSystem } from '../src/systems/WeaponSystem';
import { FLIGHT_STRIDE } from '../src/weapons/boomerang';

const NO_MODS = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };
const DT = 1 / 60;

/** Un ennemi immobile et costaud à (`x`, 0), une hache, le joueur en (0, 0). */
function setup(x: number) {
  const enemies = new Pool(10, (i) => new Enemy(i));
  const e = enemies.acquire();
  if (!e) throw new Error();
  e.spawn(ENEMY_TYPES.basic, x, 0);
  e.hp = 10_000;
  const collisions = new CollisionSystem(10);
  const hits: number[] = [];
  const system = new WeaponSystem(10, collisions, new Pool(1, () => new Projectile()), {
    onHit: (_e, damage) => hits.push(damage),
    onKill: () => {},
  });
  const axe = new Weapon(WEAPONS.throwingAxe);
  axe.recompute(NO_MODS);
  /** Joue `seconds` s ; l'ennemi est remis en place (le recul le pousserait). */
  const run = (seconds: number, playerX = 0) => {
    for (let t = 0; t < seconds; t += DT) {
      e.x = x;
      e.y = 0;
      collisions.rebuild(enemies);
      system.update(DT, [axe], playerX, 0, t);
    }
  };
  return { axe, hits, run };
}

describe('Hache de lancer', () => {
  it('avec un nombre pair de haches, l’une part toujours droit sur la cible', () => {
    const { axe, hits, run } = setup(150);
    axe.level = 3; // 2 haches
    axe.recompute(NO_MODS);
    expect(axe.count).toBe(2);
    run(0.5); // aller seulement (300 px à 420 px/s ≈ 0,71 s)
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('touche une fois à l’aller et une fois au retour, puis revient au joueur', () => {
    const { axe, hits, run } = setup(150);
    // Aller (300 px à 420 px/s ≈ 0,71 s) et retour : ~1,45 s, avant le lancer suivant (1,6 s).
    run(1.55);
    expect(hits).toHaveLength(2);
    expect(axe.flights?.some((v, i) => i % 9 === 0 && v !== 0)).toBe(false);
  });

  it('personne à portée : pas de lancer', () => {
    const { hits, run, axe } = setup(900);
    run(0.5);
    expect(hits).toHaveLength(0);
    expect(axe.cooldownTimer).toBe(0);
  });

  it('Haches jumelles : 6 haches tout autour, la 1re droit sur la cible', () => {
    const { axe, run } = setup(150); // cible à droite (angle 0)
    axe.level = 5;
    axe.mutation = WEAPONS.throwingAxe.mutations[0];
    axe.recompute(NO_MODS);
    expect(axe.count).toBe(6);
    run(DT); // un lancer
    const angles: number[] = [];
    const f = axe.flights;
    if (!f) throw new Error();
    for (let o = 0; o < f.length; o += FLIGHT_STRIDE) {
      if (f[o] === 0) continue;
      const deg = (Math.atan2(f[o + 6] ?? 0, f[o + 5] ?? 0) * 180) / Math.PI;
      angles.push(Math.round((deg + 360) % 360));
    }
    expect(angles.sort((a, b) => a - b)).toEqual([0, 60, 120, 180, 240, 300]);
  });

  it('Hache du bourreau : plus grosse et plus lente', () => {
    const big = new Weapon(WEAPONS.throwingAxe);
    big.level = 5;
    big.mutation = WEAPONS.throwingAxe.mutations[1];
    big.recompute(NO_MODS);
    expect(big.radius).toBeCloseTo((14 + 3) * 1.6);
    expect(big.projectileSpeed).toBeCloseTo(420 * 0.7);
  });
});
