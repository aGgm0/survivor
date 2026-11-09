import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES, type EnemyType } from '../src/data/enemies';
import { WEAPONS, weaponRange } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { ProjectileSystem } from '../src/systems/ProjectileSystem';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const DT = 1 / 60;
const BOLT = WEAPONS.arcaneBolt;

function setup(spawns: [EnemyType, number, number][] = []) {
  const enemies = new Pool(100, (i) => new Enemy(i));
  for (const [type, x, y] of spawns) enemies.acquire()?.spawn(type, x, y);
  const projectiles = new Pool(50, () => new Projectile());
  const collisions = new CollisionSystem(100);
  const killed: Enemy[] = [];
  const weaponSystem = new WeaponSystem(100, collisions, projectiles);
  const projectileSystem = new ProjectileSystem(100, collisions, (e) => {
    killed.push(e);
    enemies.release(e);
  });
  const weapon = new Weapon(BOLT);
  /** Simule `seconds` secondes de combat, joueur immobile en (0, 0). */
  const run = (seconds: number) => {
    for (let t = 0; t < Math.round(seconds / DT); t++) {
      collisions.rebuild(enemies);
      weaponSystem.update(DT, [weapon], 0, 0);
      projectileSystem.update(DT, projectiles);
    }
  };
  const active = <T extends { active: boolean }>(pool: Pool<T>) =>
    pool.items.filter((x) => x.active);
  return { enemies, projectiles, collisions, weaponSystem, weapon, killed, run, active };
}

describe('WeaponSystem — ciblage', () => {
  it('vise l’ennemi le plus proche à portée', () => {
    const { enemies, collisions, weaponSystem, active } = setup([
      [ENEMY_TYPES.basic, 300, 0],
      [ENEMY_TYPES.basic, -120, 50],
      [ENEMY_TYPES.basic, 0, 400],
    ]);
    collisions.rebuild(enemies);
    expect(weaponSystem.findNearest(0, 0, 1000)).toBe(active(enemies)[1]);
  });

  it('ignore les ennemis hors de portée', () => {
    const { enemies, collisions, weaponSystem } = setup([[ENEMY_TYPES.basic, 900, 0]]);
    collisions.rebuild(enemies);
    expect(weaponSystem.findNearest(0, 0, 500)).toBeNull();
  });
});

describe('WeaponSystem — tir', () => {
  it('ne tire pas sans cible, mais reste prête', () => {
    const { projectiles, weapon, run } = setup();
    run(3);
    expect(projectiles.activeCount).toBe(0);
    expect(weapon.cooldownTimer).toBeLessThanOrEqual(0);
  });

  it('tire immédiatement dès qu’une cible arrive, puis respecte le cooldown', () => {
    const { enemies, projectiles, run } = setup();
    run(2); // pas de cible pendant 2 s
    enemies.acquire()?.spawn(ENEMY_TYPES.tank, weaponRange(BOLT) - 50, 0);
    run(DT);
    expect(projectiles.activeCount).toBe(1); // tir immédiat, pas de "rattrapage" des 2 s
    run(BOLT.cooldown - 3 * DT);
    expect(projectiles.activeCount).toBe(1); // pas de 2e tir avant le cooldown
  });

  it('le projectile part vers la cible', () => {
    const { enemies, projectiles, run, active } = setup();
    enemies.acquire()?.spawn(ENEMY_TYPES.tank, 0, 400);
    run(DT);
    const p = active(projectiles)[0];
    if (!p) throw new Error();
    expect(p.vx).toBeCloseTo(0);
    expect(p.vy).toBeCloseTo(BOLT.projectileSpeed);
  });
});

describe('ProjectileSystem', () => {
  it('un rapide (5 PV) meurt en un coup et est compté', () => {
    const { killed, weapon, run, enemies } = setup([[ENEMY_TYPES.fast, 200, 0]]);
    run(0.9);
    expect(killed).toHaveLength(1);
    expect(enemies.activeCount).toBe(0);
    expect(weapon.kills).toBe(1);
  });

  it('un basique (20 PV) encaisse exactement 2 coups', () => {
    const { killed, run, active, enemies } = setup([[ENEMY_TYPES.basic, 200, 0]]);
    run(0.9); // 1er coup
    expect(killed).toHaveLength(0);
    expect(active(enemies)[0]?.hp).toBe(ENEMY_TYPES.basic.hp - BOLT.damage);
    run(1); // 2e coup
    expect(killed).toHaveLength(1);
  });

  it('un tank (60 PV) encaisse plusieurs coups avant de mourir', () => {
    const { killed, run, active, enemies } = setup([[ENEMY_TYPES.tank, 200, 0]]);
    run(2.5);
    expect(killed).toHaveLength(0);
    expect(active(enemies)[0]?.hp).toBeLessThan(ENEMY_TYPES.tank.hp);
    run(5);
    expect(killed).toHaveLength(1);
  });

  it('damage meter : seuls les dégâts utiles sont comptés (pas l’excédent)', () => {
    const { weapon, run } = setup([[ENEMY_TYPES.fast, 200, 0]]); // 5 PV, l'arme fait 10
    run(1);
    expect(weapon.totalDamage).toBe(ENEMY_TYPES.fast.hp);
  });

  it('le projectile disparaît après sa durée de vie s’il ne touche rien', () => {
    const { projectiles, run, enemies, active } = setup([[ENEMY_TYPES.basic, 300, 0]]);
    run(DT); // tir
    const target = active(enemies)[0];
    if (target) enemies.release(target); // la cible disparaît : le projectile file dans le vide
    run(BOLT.projectileLifetime + 0.1);
    expect(projectiles.activeCount).toBe(0);
  });

  it('un projectile ne touche qu’un seul ennemi', () => {
    // Deux rapides (morts en 1 coup) collés, dans l'axe du tir.
    const { killed, run } = setup([
      [ENEMY_TYPES.fast, 200, 0],
      [ENEMY_TYPES.fast, 212, 0],
    ]);
    run(0.6); // un seul tir a eu le temps de partir et d'arriver
    expect(killed).toHaveLength(1);
  });
});
