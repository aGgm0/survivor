import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES, type EnemyType } from '../src/data/enemies';
import { BOSS_ABILITIES, BOSS_SPAWNS, BOSS_TYPE, ELITE_SPAWNS, waveAt } from '../src/data/waves';
import { Enemy } from '../src/entities/Enemy';
import { BossAbilitySystem } from '../src/systems/BossAbilitySystem';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { MovementSystem } from '../src/systems/MovementSystem';
import { SpawnSystem, armBoss } from '../src/systems/SpawnSystem';
import { applyKnockback } from '../src/systems/damage';

const CHARGE = BOSS_ABILITIES.charge;
const SUMMON = BOSS_ABILITIES.summon;

function setup() {
  const pool = new Pool(500, (i) => new Enemy(i));
  const spawner = new SpawnSystem(pool, new Rng(1));
  const abilities = new BossAbilitySystem();
  const boss = pool.acquire();
  if (!boss) throw new Error();
  boss.spawn(BOSS_TYPE, 400, 0);
  return { pool, spawner, abilities, boss };
}

describe('mini-boss (élites)', () => {
  it('orange à 3:00, rouge à 7:00, avec les PV de la vague en cours', () => {
    expect(ELITE_SPAWNS.map((e) => [e.time, e.type.id])).toEqual([
      [180, 'fastElite'],
      [420, 'basicElite'],
    ]);
    const pool = new Pool(3000, (i) => new Enemy(i));
    const spawner = new SpawnSystem(pool, new Rng(2));
    spawner.jumpTo(180);
    spawner.update(1 / 60, 180, 0, 0);
    const fast = pool.items.find((e) => e.active && e.type === ENEMY_TYPES.fastElite);
    expect(fast?.maxHp).toBeCloseTo(300 * waveAt(180).hpMult);
    spawner.jumpTo(420);
    spawner.update(1 / 60, 420, 0, 0);
    const red = pool.items.find((e) => e.active && e.type === ENEMY_TYPES.basicElite);
    expect(red?.maxHp).toBeCloseTo(1150 * waveAt(420).hpMult);
  });

  it('plus forts que leur version normale', () => {
    const { fast, fastElite, basic, basicElite } = ENEMY_TYPES;
    expect(fastElite.hp).toBe(fast.hp * 60);
    expect(basicElite.hp).toBe(basic.hp * 50);
    expect(fastElite.contactDamage).toBe(fast.contactDamage * 4);
    expect(basicElite.contactDamage).toBe(basic.contactDamage * 4);
    expect(fastElite.radius).toBe(fast.radius * 1.8);
  });

  it('reculent 50 % moins que leur version normale', () => {
    const recoil = (type: EnemyType) => {
      const e = new Enemy(0);
      e.spawn(type, 0, 0);
      applyKnockback(e, 100, 1, 0);
      return e.vx;
    };
    expect(recoil(ENEMY_TYPES.fastElite)).toBeCloseTo(recoil(ENEMY_TYPES.fast) * 0.5);
    expect(recoil(ENEMY_TYPES.basicElite)).toBeCloseTo(recoil(ENEMY_TYPES.basic) * 0.5);
  });
});

describe('capacité : charge', () => {
  it('annonce (arrêt, direction fixée vers le joueur), puis ligne droite, puis repos', () => {
    const { pool, spawner, abilities, boss } = setup();
    armBoss(boss, 0, false, 1);
    abilities.update(pool, CHARGE.firstDelay - 0.01, 0, 0, spawner);
    expect(boss.chargeState).toBe('none');

    abilities.update(pool, CHARGE.firstDelay, 0, 0, spawner);
    expect(boss.chargeState).toBe('windup');
    expect(boss.chargeDirX).toBeCloseTo(-1); // le joueur est à gauche du boss

    abilities.update(pool, CHARGE.firstDelay + CHARGE.windup, 0, 0, spawner);
    expect(boss.chargeState).toBe('dash');
    const end = CHARGE.firstDelay + CHARGE.windup + CHARGE.duration;
    abilities.update(pool, end, 0, 0, spawner);
    expect(boss.chargeState).toBe('none');
    expect(boss.nextChargeAt).toBeCloseTo(end + CHARGE.interval);
  });

  it('immobile pendant l’annonce, puis fonce à 4× sa vitesse', () => {
    const { pool, boss } = setup();
    const collisions = new CollisionSystem(500);
    const movement = new MovementSystem(500, collisions);
    boss.chargeDirX = -1;
    boss.chargeDirY = 0;
    boss.chargeState = 'windup';
    collisions.rebuild(pool);
    movement.update(pool, 0, 0, 1 / 60);
    expect(boss.vx).toBeCloseTo(0); // (-1 × 0 = -0 : toBe ferait la différence)
    boss.chargeState = 'dash';
    collisions.rebuild(pool);
    movement.update(pool, 0, 0, 1 / 60);
    expect(boss.vx).toBeCloseTo(-BOSS_TYPE.speed * CHARGE.speedMult);
  });
});

describe('capacité : invocation', () => {
  it('boss de 9:00 : après l’annonce, 5 basiques et 2 basiques élites autour de lui', () => {
    const { pool, spawner, abilities, boss } = setup();
    armBoss(boss, 0, true, 1);
    abilities.update(pool, SUMMON.firstDelay, 0, 0, spawner);
    expect(boss.summonAt).toBeCloseTo(SUMMON.firstDelay + SUMMON.cast);
    expect(pool.activeCount).toBe(1); // rien tant que l'annonce n'est pas finie

    abilities.update(pool, SUMMON.firstDelay + SUMMON.cast, 0, 0, spawner);
    const minions = pool.items.filter((e) => e.active && e !== boss);
    expect(minions.filter((e) => e.type === ENEMY_TYPES.basic)).toHaveLength(SUMMON.basics);
    expect(minions.filter((e) => e.type === ENEMY_TYPES.basicElite)).toHaveLength(SUMMON.elites);
    for (const m of minions) {
      expect(Math.hypot(m.x - boss.x, m.y - boss.y)).toBeCloseTo(SUMMON.radius);
    }
  });

  it('le boss de 5:00 n’invoque pas ; celui de 9:00 si', () => {
    const pool = new Pool(3000, (i) => new Enemy(i));
    const spawner = new SpawnSystem(pool, new Rng(3));
    for (const b of BOSS_SPAWNS) spawner.update(1 / 60, b.time, 0, 0);
    const bosses = pool.items.filter((e) => e.active && e.type === BOSS_TYPE);
    const first = bosses.find((b) => b.bossIndex === 0);
    const second = bosses.find((b) => b.bossIndex === 1);
    expect(first?.nextSummonAt).toBe(Infinity);
    expect(second?.nextSummonAt).toBeLessThan(Infinity);
    expect(first?.nextChargeAt).toBeLessThan(Infinity);
  });

  it('boss du sans fin : capacités 10 % plus fréquentes à chaque boss', () => {
    const { boss } = setup();
    armBoss(boss, 0, true, 0.81);
    expect(boss.nextChargeAt).toBeCloseTo(CHARGE.firstDelay * 0.81);
    expect(boss.abilityRate).toBe(0.81);
  });
});
