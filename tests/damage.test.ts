import { describe, expect, it } from 'vitest';
import { computeDamage, MIN_DAMAGE } from '../src/data/combat';
import { PLAYER_BASE } from '../src/data/player';
import { Player } from '../src/entities/Player';
import { damageEnemy } from '../src/systems/damage';
import { Enemy } from '../src/entities/Enemy';
import { Weapon } from '../src/entities/Weapon';
import { ENEMY_TYPES } from '../src/data/enemies';
import { WEAPONS } from '../src/data/weapons';

describe('computeDamage', () => {
  it('retire l’armure aux dégâts', () => {
    expect(computeDamage(10, 3)).toBe(7);
    expect(computeDamage(10, 0)).toBe(10);
  });

  it('fait toujours au moins MIN_DAMAGE, même avec beaucoup d’armure', () => {
    expect(computeDamage(3, 3)).toBe(MIN_DAMAGE);
    expect(computeDamage(3, 50)).toBe(MIN_DAMAGE);
  });
});

describe('Player — PV', () => {
  it('commence avec tous ses PV', () => {
    const p = new Player();
    expect(p.hp).toBe(PLAYER_BASE.maxHp);
    expect(p.isDead).toBe(false);
  });

  it('un coup retire des PV et déclenche le flash', () => {
    const p = new Player();
    expect(p.takeHit(10)).toBe(true);
    expect(p.hp).toBe(PLAYER_BASE.maxHp - 10);
    expect(p.hitFlashTimer).toBeGreaterThan(0);
  });

  it('pas d’invincibilité : des coups successifs portent tous', () => {
    const p = new Player();
    p.takeHit(10);
    p.takeHit(10);
    p.takeHit(10);
    expect(p.hp).toBe(PLAYER_BASE.maxHp - 30);
  });

  it('le flash s’éteint tout seul', () => {
    const p = new Player();
    p.takeHit(10);
    for (let i = 0; i < 30; i++) p.update(1 / 60, 0, 0);
    expect(p.hitFlashTimer).toBe(0);
  });

  it('meurt à 0 PV sans descendre en négatif', () => {
    const p = new Player();
    p.hp = 3;
    p.takeHit(10);
    expect(p.hp).toBe(0);
    expect(p.isDead).toBe(true);
  });
});

describe('arrondi des dégâts', () => {
  it('arrondit chaque coup à l’entier supérieur (un petit bonus en % compte toujours)', () => {
    const weapon = new Weapon(WEAPONS.arcaneBolt);
    const enemy = new Enemy();
    enemy.spawn(ENEMY_TYPES.tank, 0, 0);
    const hp = enemy.hp;
    damageEnemy(weapon, enemy, 14.42, { onHit: () => {}, onKill: () => {} }, 1, 0);
    expect(hp - enemy.hp).toBe(15);
  });

  it('ne compte pas un point de trop sur une erreur de virgule', () => {
    const weapon = new Weapon(WEAPONS.arcaneBolt);
    const enemy = new Enemy();
    enemy.spawn(ENEMY_TYPES.tank, 0, 0);
    const hp = enemy.hp;
    damageEnemy(
      weapon,
      enemy,
      (0.1 * 3 * 10 * 16) / 3,
      { onHit: () => {}, onKill: () => {} },
      1,
      0,
    );
    expect(hp - enemy.hp).toBe(16);
  });
});
