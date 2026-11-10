import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { BOSS_TIMES, WAVES, waveAt } from '../src/data/waves';
import { Enemy } from '../src/entities/Enemy';
import { SPAWN_RADIUS, SpawnSystem } from '../src/systems/SpawnSystem';

function setup(capacity = 1000) {
  const pool = new Pool(capacity, (i) => new Enemy(i));
  const spawner = new SpawnSystem(pool, new Rng(42));
  return { pool, spawner };
}

function activeEnemies(pool: Pool<Enemy>): Enemy[] {
  return pool.items.filter((e) => e.active);
}

/** Simule de `from` à `to` secondes par pas de 1 s. Renvoie les ennemis apparus pendant ce temps. */
function runBetween(spawner: SpawnSystem, pool: Pool<Enemy>, from: number, to: number): Enemy[] {
  const before = new Set(activeEnemies(pool));
  for (let t = from; t < to; t++) spawner.update(1, t + 1, 0, 0);
  return activeEnemies(pool).filter((e) => !before.has(e));
}

describe('waveAt', () => {
  it('renvoie la vague de chaque tranche de temps', () => {
    expect(waveAt(0)).toBe(WAVES[0]);
    expect(waveAt(119.9)).toBe(WAVES[0]);
    expect(waveAt(120)).toBe(WAVES[1]);
    expect(waveAt(599)).toBe(WAVES[WAVES.length - 1]);
    expect(waveAt(5000)).toBe(WAVES[WAVES.length - 1]); // après 10 min : la dernière
  });
});

describe('SpawnSystem — vagues', () => {
  it('suit le rythme de la vague en cours', () => {
    const { pool, spawner } = setup();
    const first = runBetween(spawner, pool, 0, 10);
    expect(first.filter((e) => e.type !== ENEMY_TYPES.boss)).toHaveLength(
      Math.round(waveAt(0).perSecond * 10),
    );
  });

  it('pas de tanks pendant les 2 premières minutes, puis ils arrivent', () => {
    const { pool, spawner } = setup();
    const early = runBetween(spawner, pool, 0, 119);
    expect(early.some((e) => e.type === ENEMY_TYPES.tank)).toBe(false);
    pool.releaseAll();
    const later = runBetween(spawner, pool, 120, 200);
    expect(later.some((e) => e.type === ENEMY_TYPES.tank)).toBe(true);
  });

  it('paliers de vitesse : normaux avant 6:00, +15 % à 6:00, +30 % à 8:00', () => {
    expect(waveAt(300).speedMult).toBe(1);
    expect(waveAt(360).speedMult).toBe(1.15);
    expect(waveAt(480).speedMult).toBe(1.3);
    const { pool, spawner } = setup();
    // (En sautant à 8:00, le boss de 5:00 pas encore envoyé apparaît aussi : on l'écarte.)
    const late = runBetween(spawner, pool, 480, 482).filter((e) => e.type !== ENEMY_TYPES.boss);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((e) => e.speedMult === 1.3)).toBe(true);
  });

  it('le boss garde sa vitesse de base, même à 9:00', () => {
    const { pool, spawner } = setup();
    spawner.update(1 / 60, BOSS_TIMES[1] ?? 0, 0, 0);
    const boss = activeEnemies(pool).find((e) => e.type === ENEMY_TYPES.boss);
    expect(boss?.speedMult).toBe(1);
  });

  it('la fin de partie envoie surtout des petits, de plus en plus vite', () => {
    const counts = WAVES.map((w) => w.perSecond);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1] ?? 0); // le rythme ne baisse jamais
    }
    const last = WAVES[WAVES.length - 1];
    const tankShare =
      (last?.weights.find(([t]) => t === ENEMY_TYPES.tank)?.[1] ?? 0) /
      (last?.weights.reduce((s, [, w]) => s + w, 0) ?? 1);
    expect(tankShare).toBeLessThanOrEqual(0.1);
  });

  it('les PV suivent le multiplicateur de la vague', () => {
    const { pool, spawner } = setup();
    const late = runBetween(spawner, pool, 480, 490);
    const basic = late.find((e) => e.type === ENEMY_TYPES.basic);
    expect(basic?.maxHp).toBe(ENEMY_TYPES.basic.hp * waveAt(480).hpMult);
    expect(basic?.hp).toBe(basic?.maxHp);
  });

  it('F4 (debug) tire selon la vague en cours', () => {
    const { pool, spawner } = setup();
    spawner.spawnBatch(200, 0, 0, 0);
    expect(activeEnemies(pool).some((e) => e.type === ENEMY_TYPES.tank)).toBe(false);
  });
});

describe('SpawnSystem — boss', () => {
  it('un boss apparaît à chaque instant de BOSS_TIMES, une seule fois', () => {
    const { pool, spawner } = setup();
    const bosses = () => activeEnemies(pool).filter((e) => e.type === ENEMY_TYPES.boss);
    runBetween(spawner, pool, 0, (BOSS_TIMES[0] ?? 0) - 1);
    expect(bosses()).toHaveLength(0);
    pool.releaseAll(); // on vide pour ne pas saturer la réserve
    runBetween(spawner, pool, (BOSS_TIMES[0] ?? 0) - 1, (BOSS_TIMES[0] ?? 0) + 30);
    expect(bosses()).toHaveLength(1);
    expect(bosses()[0]?.hp).toBe(ENEMY_TYPES.boss.hp); // PV du brief, sans multiplicateur
    pool.releaseAll();
    runBetween(spawner, pool, (BOSS_TIMES[1] ?? 0) - 1, (BOSS_TIMES[1] ?? 0) + 1);
    expect(bosses()).toHaveLength(1);
  });

  it('le boss apparaît même si la limite d’ennemis est atteinte', () => {
    const { pool, spawner } = setup();
    spawner.spawnBatch(600, 0, 0, 0);
    spawner.update(1 / 60, BOSS_TIMES[0] ?? 0, 0, 0);
    expect(activeEnemies(pool).some((e) => e.type === ENEMY_TYPES.boss)).toBe(true);
  });
});

describe('SpawnSystem — placement', () => {
  it('fait apparaître les ennemis sur le cercle hors écran', () => {
    const { pool, spawner } = setup();
    spawner.spawnBatch(20, 0, 100, -50);
    for (const e of activeEnemies(pool)) {
      expect(Math.hypot(e.x - 100, e.y + 50)).toBeCloseTo(SPAWN_RADIUS);
    }
  });

  it('respecte la capacité du pool', () => {
    const { pool, spawner } = setup(10);
    spawner.spawnBatch(100, 0, 0, 0);
    expect(pool.activeCount).toBe(10);
  });

  it('replace un ennemi trop lointain de l’autre côté du joueur', () => {
    const { pool, spawner } = setup();
    spawner.spawnBatch(1, 0, 0, 0);
    const e = activeEnemies(pool)[0];
    if (!e) throw new Error();
    e.teleport(-5000, 0); // le joueur a fui loin vers la droite
    spawner.update(0, 0, 0, 0);
    expect(e.x).toBeCloseTo(SPAWN_RADIUS);
    expect(e.y).toBeCloseTo(0);
  });

  it('la même seed donne les mêmes spawns', () => {
    const a = setup();
    const b = setup();
    a.spawner.spawnBatch(10, 0, 0, 0);
    b.spawner.spawnBatch(10, 0, 0, 0);
    const pos = (p: Pool<Enemy>) => activeEnemies(p).map((e) => [e.x, e.y, e.type.id]);
    expect(pos(a.pool)).toEqual(pos(b.pool));
  });
});
