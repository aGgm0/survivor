import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { FURNITURE } from '../src/data/furniture';
import { emptyProfile, recordRun } from '../src/data/profile';
import { WEAPONS } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { damageEnemy } from '../src/systems/damage';
import { PickupSystem } from '../src/systems/PickupSystem';
import { SpawnSystem } from '../src/systems/SpawnSystem';
import type { RunReport } from '../src/types/RunReport';
import { WeaponSystem } from '../src/systems/WeaponSystem';
import { MovementSystem } from '../src/systems/MovementSystem';
import { Projectile } from '../src/entities/Projectile';

const CRATE = ENEMY_TYPES.crate;

describe('mobilier', () => {
  it('apparaît toutes les 15 s, 8 au maximum', () => {
    // Grande réserve : les vagues remplissent aussi le pool pendant ces 5 minutes simulées.
    const pool = new Pool(5000, (i) => new Enemy(i));
    const spawner = new SpawnSystem(pool, new Rng(1));
    const crates = () => pool.items.filter((e) => e.active && e.type === CRATE).length;
    // On ne compte que le mobilier (les vagues font aussi apparaître des ennemis).
    spawner.update(FURNITURE.spawnInterval - 0.5, 1, 0, 0);
    expect(crates()).toBe(0);
    spawner.update(0.5, 2, 0, 0);
    expect(crates()).toBe(1);
    for (let i = 0; i < 20; i++) spawner.update(FURNITURE.spawnInterval, 3 + i, 0, 0);
    expect(crates()).toBe(FURNITURE.maxActive);
  });

  it('ne bouge pas, ne fait pas de dégâts, ne recule pas', () => {
    expect(CRATE).toMatchObject({ speed: 0, contactDamage: 0, knockbackImmune: true, prop: true });
  });

  it('la visée automatique l’ignore (le Trait ne gâche pas de tir dessus)', () => {
    const enemies = new Pool(10, (i) => new Enemy(i));
    enemies.acquire()?.spawn(CRATE, 50, 0);
    const collisions = new CollisionSystem(10);
    collisions.rebuild(enemies);
    const system = new WeaponSystem(10, collisions, new Pool(5, () => new Projectile()), {
      onHit: () => {},
      onKill: () => {},
    });
    expect(system.findNearest(0, 0, 500)).toBeNull();
  });

  it('le casser ne compte ni comme kill ni dans le damage meter', () => {
    const crate = new Enemy(0);
    crate.spawn(CRATE, 0, 0);
    const weapon = new Weapon(WEAPONS.arcaneBolt);
    let killed = false;
    damageEnemy(weapon, crate, 50, { onHit: () => {}, onKill: () => (killed = true) }, 1, 0);
    expect(killed).toBe(true); // la scène lâche le butin
    expect(weapon.kills).toBe(0);
    expect(weapon.totalDamage).toBe(0);
  });
});

describe('pièces et nourriture', () => {
  const player = { x: 0, y: 0, radius: 16, pickupRadius: 60 };

  it('attirées dans le rayon de ramassage, puis ramassées', () => {
    const pickups = new PickupSystem();
    pickups.drop('gold', 3, 40, 0);
    pickups.drop('food', 20, 0, 40);
    pickups.drop('gold', 5, 500, 0); // trop loin
    let gold = 0;
    let heal = 0;
    for (let i = 0; i < 60; i++) {
      pickups.update(1 / 60, player);
      gold += pickups.gold;
      heal += pickups.heal;
    }
    expect(gold).toBe(3);
    expect(heal).toBe(20);
    expect(pickups.activeCount).toBe(1);
  });
});

describe('or au profil', () => {
  it('l’or d’une partie terminée s’ajoute au total', () => {
    const report: RunReport = {
      character: '',
      passives: [],
      victory: false,
      endless: false,
      time: 100,
      kills: 0,
      gold: 42,
      level: 1,
      challenges: [],
      maxedAt: null,
      weapons: [],
    };
    const profile = emptyProfile();
    recordRun(profile, report);
    recordRun(profile, report);
    expect(profile.gold).toBe(84);
  });
});

describe('mobilier — immobile', () => {
  it('ne glisse pas, même dans une case du pool qui avait un ennemi rapide avant', () => {
    const pool = new Pool(10, (i) => new Enemy(i));
    const collisions = new CollisionSystem(10);
    const movement = new MovementSystem(10, collisions);
    // Un rapide fonce vers le joueur, puis meurt : sa case du pool est réutilisée par une caisse.
    const fast = pool.acquire();
    if (!fast) throw new Error();
    fast.spawn(ENEMY_TYPES.fast, 300, 0);
    for (let i = 0; i < 30; i++) {
      collisions.rebuild(pool);
      movement.update(pool, 0, 0, 1 / 60);
    }
    pool.release(fast);
    const crate = pool.acquire();
    if (!crate) throw new Error();
    crate.spawn(CRATE, 200, 0);
    for (let i = 0; i < 60; i++) {
      collisions.rebuild(pool);
      movement.update(pool, 0, 0, 1 / 60);
    }
    expect(crate.x).toBe(200);
    expect(crate.y).toBe(0);
  });

  it('laissé très loin derrière : il disparaît au lieu de revenir devant', () => {
    const pool = new Pool(10, (i) => new Enemy(i));
    const spawner = new SpawnSystem(pool, new Rng(1));
    const crate = pool.acquire();
    if (!crate) throw new Error();
    crate.spawn(CRATE, 5000, 0);
    spawner.update(1 / 60, 1, 0, 0);
    expect(crate.active).toBe(false);
  });
});
