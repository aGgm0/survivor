import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { KNOCKBACK } from '../src/data/combat';
import { ENEMY_TYPES, type EnemyType } from '../src/data/enemies';
import { PASSIVES } from '../src/data/upgrades';
import { WEAPONS, type WeaponDef } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Player } from '../src/entities/Player';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { applyKnockback } from '../src/systems/damage';
import { ProjectileSystem } from '../src/systems/ProjectileSystem';
import { applyUpgrade, availableUpgrades } from '../src/systems/upgrades';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const DT = 1 / 60;
const NO_MODS = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };

function enemyOf(type: EnemyType): Enemy {
  const e = new Enemy(0);
  e.spawn(type, 0, 0);
  return e;
}

describe('applyKnockback', () => {
  it('pousse dans la direction donnée, à la force donnée (ennemi de référence)', () => {
    const e = enemyOf(ENEMY_TYPES.basic);
    applyKnockback(e, 100, 1, 0);
    expect(e.vx).toBeCloseTo(100);
    expect(e.vy).toBeCloseTo(0);
  });

  it('plus l’ennemi est lourd, moins il recule ; le boss recule à peine', () => {
    const recoil = (type: EnemyType) => {
      const e = enemyOf(type);
      applyKnockback(e, 100, 1, 0);
      return e.vx;
    };
    expect(recoil(ENEMY_TYPES.fast)).toBeGreaterThan(recoil(ENEMY_TYPES.basic));
    expect(recoil(ENEMY_TYPES.fast)).toBeLessThanOrEqual(100 * KNOCKBACK.maxFactor); // plafonné
    expect(recoil(ENEMY_TYPES.tank)).toBeLessThan(recoil(ENEMY_TYPES.basic) / 2);
    expect(recoil(ENEMY_TYPES.boss)).toBeLessThan(recoil(ENEMY_TYPES.basic) / 10);
  });
});

describe('recul par arme', () => {
  it('Orbes > Trait arcanique > Aura', () => {
    const kb = (def: WeaponDef) => new Weapon(def).knockback;
    expect(kb(WEAPONS.runicOrbs)).toBeGreaterThan(kb(WEAPONS.arcaneBolt));
    expect(kb(WEAPONS.arcaneBolt)).toBeGreaterThan(kb(WEAPONS.burningAura));
  });

  it('le passif Impact augmente le recul de toutes les armes', () => {
    const build = {
      player: new Player(),
      weapons: [new Weapon(WEAPONS.arcaneBolt)],
      passiveLevels: new Map(),
    };
    const impact = availableUpgrades(build).find(
      (o) => o.kind === 'passive' && o.passive.id === 'impact',
    );
    if (!impact) throw new Error('pas de passif Impact');
    applyUpgrade(impact, build);
    const weapon = build.weapons[0] as Weapon;
    weapon.recompute(build.player);
    const amount = PASSIVES.find((p) => p.id === 'impact')?.amount ?? 0;
    expect(weapon.knockback).toBeCloseTo(WEAPONS.arcaneBolt.knockback * (1 + amount));
  });

  it('un projectile repousse l’ennemi dans son sens de déplacement', () => {
    const enemies = new Pool(10, (i) => new Enemy(i));
    const tank = enemies.acquire();
    tank?.spawn(ENEMY_TYPES.tank, 200, 0);
    const projectiles = new Pool(10, () => new Projectile());
    const collisions = new CollisionSystem(10);
    const events = { onHit: () => {}, onKill: () => {} };
    const weapons = new WeaponSystem(10, collisions, projectiles, events);
    const flight = new ProjectileSystem(10, collisions, events);
    const bolt = new Weapon(WEAPONS.arcaneBolt);
    for (let i = 0; i < 40 && tank?.vx === 0; i++) {
      collisions.rebuild(enemies);
      weapons.update(DT, [bolt], 0, 0, i * DT);
      flight.update(DT, projectiles);
    }
    expect(tank?.vx).toBeGreaterThan(0); // poussé vers la droite (le tir allait vers +x)
  });

  it('l’aura repousse vers l’extérieur, depuis le joueur', () => {
    const enemies = new Pool(10, (i) => new Enemy(i));
    const e = enemies.acquire();
    e?.spawn(ENEMY_TYPES.tank, -50, 0); // à gauche du joueur
    const collisions = new CollisionSystem(10);
    collisions.rebuild(enemies);
    const system = new WeaponSystem(10, collisions, new Pool(1, () => new Projectile()), {
      onHit: () => {},
      onKill: () => {},
    });
    const aura = new Weapon(WEAPONS.burningAura);
    aura.recompute(NO_MODS);
    system.update(DT, [aura], 0, 0, DT);
    expect(e?.vx).toBeLessThan(0); // poussé vers la gauche, loin du joueur
  });
});
