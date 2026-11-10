import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { STATUS } from '../src/data/status';
import { WEAPONS } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Weapon } from '../src/entities/Weapon';
import type { HitKind } from '../src/systems/damage';
import { applyPoison, applySlow, slowFactor, StatusSystem } from '../src/systems/status';

function setup() {
  const pool = new Pool(10, (i) => new Enemy(i));
  const e = pool.acquire();
  if (!e) throw new Error();
  e.spawn(ENEMY_TYPES.tank, 0, 0); // 60 PV
  const hits: [number, HitKind][] = [];
  const killed: Enemy[] = [];
  const system = new StatusSystem({
    onHit: (_e, damage, kind) => hits.push([damage, kind]),
    onKill: (dead) => {
      killed.push(dead);
      pool.release(dead);
    },
  });
  /**
   * Simule de `from` à `to` s par pas de 1/60 s. Le temps de chaque pas est calculé (et non
   * additionné) : 180 additions de 1/60 donnent 2,9999… et rateraient le tick de 3 s.
   */
  const run = (from: number, to: number) => {
    const steps = Math.round((to - from) * 60);
    for (let i = 1; i <= steps; i++) system.update(pool, from + i / 60);
  };
  return { pool, e, hits, killed, run, source: new Weapon(WEAPONS.burningAura) };
}

describe('ralentissement', () => {
  it('ralentit pendant la durée, puis plus rien', () => {
    const { e } = setup();
    applySlow(e, 0.3, 2, 10);
    expect(slowFactor(e, 10)).toBeCloseTo(0.7);
    expect(slowFactor(e, 11.9)).toBeCloseTo(0.7);
    expect(slowFactor(e, 12)).toBe(1);
  });

  it('pas de cumul : on garde le plus fort et la fin la plus tardive', () => {
    const { e } = setup();
    applySlow(e, 0.3, 2, 0);
    applySlow(e, 0.1, 5, 1);
    expect(slowFactor(e, 1)).toBeCloseTo(0.7); // le 30 % reste
    expect(slowFactor(e, 5.5)).toBeCloseTo(0.7);
    expect(slowFactor(e, 6)).toBe(1);
  });

  it('un nouveau ralentissement après la fin du précédent repart de zéro', () => {
    const { e } = setup();
    applySlow(e, 0.5, 1, 0);
    applySlow(e, 0.1, 1, 5);
    expect(slowFactor(e, 5)).toBeCloseTo(0.9);
  });
});

describe('poison', () => {
  it('inflige dps × tick toutes les 0,5 s, en vert, attribué à l’arme', () => {
    const { e, hits, run, source } = setup();
    applyPoison(e, 6, 3, source, 0);
    run(0, 3);
    expect(hits).toHaveLength(3 / STATUS.poisonTick);
    expect(hits.every(([d, k]) => d === 6 * STATUS.poisonTick && k === 'poison')).toBe(true);
    expect(e.hp).toBe(ENEMY_TYPES.tank.hp - 6 * 3);
    expect(source.totalDamage).toBe(6 * 3); // damage meter
  });

  it('ne repousse pas l’ennemi', () => {
    const { e, run, source } = setup();
    applyPoison(e, 6, 1, source, 0);
    run(0, 1);
    expect([e.vx, e.vy]).toEqual([0, 0]);
  });

  it('se renouvelle sans cumuler les dégâts', () => {
    const { e, hits, run, source } = setup();
    applyPoison(e, 6, 1, source, 0);
    run(0, 0.8);
    applyPoison(e, 6, 1, source, 0.8); // renouvelé avant la fin : dure jusqu'à 1,8 s
    run(0.8, 3);
    // Ticks à 0,5 / 1,0 / 1,5 s (le suivant, 2,0 s, dépasse 1,8 s) : 3 ticks de 3 = 9.
    // Deux poisons en parallèle en auraient fait plus.
    expect(hits).toHaveLength(3);
    expect(hits.reduce((s, [d]) => s + d, 0)).toBe(9);
  });

  it('peut tuer : le kill compte pour l’arme qui a empoisonné', () => {
    const { e, killed, run, source } = setup();
    e.hp = 5;
    applyPoison(e, 20, 3, source, 0);
    run(0, 1);
    expect(killed).toEqual([e]);
    expect(source.kills).toBe(1);
  });
});
