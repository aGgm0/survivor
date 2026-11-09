import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { SPAWN } from '../src/data/spawn';
import { Enemy } from '../src/entities/Enemy';
import { SPAWN_RADIUS, SpawnSystem } from '../src/systems/SpawnSystem';

function setup(capacity = 50) {
  const pool = new Pool(capacity, (i) => new Enemy(i));
  const spawner = new SpawnSystem(pool, new Rng(42));
  return { pool, spawner };
}

function activeEnemies(pool: Pool<Enemy>): Enemy[] {
  return pool.items.filter((e) => e.active);
}

describe('SpawnSystem', () => {
  it('fait apparaître `perSecond` ennemis par seconde', () => {
    const { pool, spawner } = setup();
    spawner.update(1, 0, 0);
    expect(pool.activeCount).toBe(SPAWN.perSecond);
  });

  it('fait apparaître les ennemis sur le cercle hors écran', () => {
    const { pool, spawner } = setup();
    spawner.spawnBatch(20, 100, -50);
    for (const e of activeEnemies(pool)) {
      expect(Math.hypot(e.x - 100, e.y + 50)).toBeCloseTo(SPAWN_RADIUS);
    }
  });

  it('respecte la capacité du pool', () => {
    const { pool, spawner } = setup(10);
    spawner.spawnBatch(100, 0, 0);
    expect(pool.activeCount).toBe(10);
  });

  it('replace un ennemi trop lointain de l’autre côté du joueur', () => {
    const { pool, spawner } = setup();
    spawner.spawnBatch(1, 0, 0);
    const e = activeEnemies(pool)[0];
    if (!e) throw new Error();
    e.teleport(-5000, 0); // le joueur a fui loin vers la droite
    spawner.update(0, 0, 0);
    expect(e.x).toBeCloseTo(SPAWN_RADIUS);
    expect(e.y).toBeCloseTo(0);
  });

  it('la même seed donne les mêmes spawns', () => {
    const a = setup();
    const b = setup();
    a.spawner.spawnBatch(10, 0, 0);
    b.spawner.spawnBatch(10, 0, 0);
    const pos = (p: Pool<Enemy>) => activeEnemies(p).map((e) => [e.x, e.y, e.type.id]);
    expect(pos(a.pool)).toEqual(pos(b.pool));
  });
});
