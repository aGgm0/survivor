import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import {
  BONUS_WAVES,
  BOSS_SPAWNS,
  ENDLESS,
  WAVES,
  endlessBossHpMult,
  endlessWave,
  waveAt,
  type MutableWave,
} from '../src/data/waves';

const BOSS_TIMES = BOSS_SPAWNS.map((b) => b.time);
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
    expect(waveAt(29.9)).toBe(WAVES[0]);
    expect(waveAt(30)).toBe(WAVES[1]);
    expect(waveAt(119.9)).toBe(WAVES[1]);
    expect(waveAt(120)).toBe(WAVES[2]);
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

  it('ouverture calme : moins d’ennemis pendant les 30 premières secondes', () => {
    expect(waveAt(0).perSecond).toBeLessThan(waveAt(30).perSecond);
  });

  it('pas de tanks pendant les 2 premières minutes, puis ils arrivent', () => {
    const { pool, spawner } = setup();
    const early = runBetween(spawner, pool, 0, 119);
    expect(early.some((e) => e.type === ENEMY_TYPES.tank)).toBe(false);
    pool.releaseAll();
    const later = runBetween(spawner, pool, 120, 200);
    expect(later.some((e) => e.type === ENEMY_TYPES.tank)).toBe(true);
  });

  it('paliers de vitesse : normaux avant 6:00, puis de plus en plus rapides', () => {
    expect(waveAt(300).speedMult).toBe(1);
    expect(waveAt(360).speedMult).toBeGreaterThan(1);
    expect(waveAt(480).speedMult).toBeGreaterThan(waveAt(360).speedMult);
    const { pool, spawner } = setup();
    // (En sautant à 8:00, le boss de 5:00 pas encore envoyé apparaît aussi : on l'écarte.)
    const late = runBetween(spawner, pool, 480, 482).filter((e) => e.type !== ENEMY_TYPES.boss);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((e) => e.speedMult === waveAt(480).speedMult)).toBe(true);
  });

  it('rush de 2:00 : des rapides en plus de la vague normale, puis plus rien après 2:30', () => {
    const rush = BONUS_WAVES[0];
    if (!rush) throw new Error();
    const { pool, spawner } = setup(2000);
    const during = runBetween(spawner, pool, rush.start, rush.start + 10);
    const fast = during.filter((e) => e.type === rush.type).length;
    // 10 s : ≈ 80 du rush + une partie des 25 de la vague normale
    expect(fast).toBeGreaterThanOrEqual(rush.perSecond * 10);
    expect(during.length).toBeGreaterThanOrEqual(
      (rush.perSecond + waveAt(rush.start).perSecond) * 10 - 2,
    );

    const after = runBetween(spawner, pool, rush.end, rush.end + 10);
    expect(after.length).toBeLessThanOrEqual(waveAt(rush.end).perSecond * 10 + 1);
  });

  it('les rushs prennent les PV de la vague en cours', () => {
    const rush = BONUS_WAVES[1];
    if (!rush) throw new Error();
    const { pool, spawner } = setup(2000);
    const spawned = runBetween(spawner, pool, rush.start, rush.start + 5);
    const rushers = spawned.filter((e) => e.type === rush.type);
    expect(rushers.length).toBeGreaterThan(0);
    expect(rushers.every((e) => e.xpMult === waveAt(rush.start).hpMult)).toBe(true);
  });

  it('chaque boss a ses propres multiplicateurs, pas ceux de la vague', () => {
    const { pool, spawner } = setup();
    spawner.update(1 / 60, BOSS_SPAWNS[0]?.time ?? 0, 0, 0);
    spawner.update(1 / 60, BOSS_SPAWNS[1]?.time ?? 0, 0, 0);
    const bosses = activeEnemies(pool).filter((e) => e.type === ENEMY_TYPES.boss);
    expect(bosses.map((b) => b.maxHp)).toEqual([3000, 9000]);
    expect(bosses.map((b) => b.speedMult)).toEqual([1, 1.2]);
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
  it('un boss apparaît à chaque instant prévu, une seule fois', () => {
    const { pool, spawner } = setup();
    const bosses = () => activeEnemies(pool).filter((e) => e.type === ENEMY_TYPES.boss);
    runBetween(spawner, pool, 0, (BOSS_TIMES[0] ?? 0) - 1);
    expect(bosses()).toHaveLength(0);
    pool.releaseAll(); // on vide pour ne pas saturer la réserve
    runBetween(spawner, pool, (BOSS_TIMES[0] ?? 0) - 1, (BOSS_TIMES[0] ?? 0) + 30);
    expect(bosses()).toHaveLength(1);
    expect(bosses()[0]?.hp).toBe(ENEMY_TYPES.boss.hp * (BOSS_SPAWNS[0]?.hpMult ?? 1));
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

  it('replace les ennemis trop lointains tout autour du joueur, hors écran', () => {
    const { pool, spawner } = setup();
    spawner.spawnBatch(40, 0, 0, 0);
    const enemies = activeEnemies(pool);
    // Toute la horde est restée loin derrière, à gauche (le joueur a fui vers la droite).
    for (const e of enemies) e.teleport(-5000, 0);
    spawner.update(0, 0, 0, 0);
    let ahead = 0;
    let behind = 0;
    for (const e of enemies) {
      expect(Math.hypot(e.x, e.y)).toBeCloseTo(SPAWN_RADIUS); // sur le cercle, hors écran
      if (e.x > 0) ahead++;
      else behind++;
    }
    // Redistribués de tous les côtés, pas tous en face.
    expect(ahead).toBeGreaterThan(5);
    expect(behind).toBeGreaterThan(5);
  });

  it('un boss ou un élite trop lointain revient pile en face (menace jamais perdue de vue)', () => {
    const { pool, spawner } = setup();
    for (const type of [ENEMY_TYPES.boss, ENEMY_TYPES.basicElite]) {
      const e = pool.acquire();
      if (!e) throw new Error();
      e.spawn(type, -5000, 0);
      spawner.update(0, 0, 0, 0);
      expect(e.x).toBeCloseTo(SPAWN_RADIUS);
      expect(e.y).toBeCloseTo(0);
    }
  });

  it('ne replace pas un ennemi juste hors écran', () => {
    const { pool, spawner } = setup();
    const e = pool.acquire();
    if (!e) throw new Error();
    e.spawn(ENEMY_TYPES.basic, -SPAWN_RADIUS * 1.2, 0);
    spawner.update(0, 0, 0, 0);
    expect(e.x).toBeCloseTo(-SPAWN_RADIUS * 1.2);
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

describe('mode sans fin', () => {
  const last = WAVES[WAVES.length - 1]!;
  const out = (): MutableWave => ({ perSecond: 0, weights: [], hpMult: 0, speedMult: 0 });

  it('au début du sans fin : la dernière vague telle quelle', () => {
    const w = endlessWave(last, 0, out());
    expect(w.perSecond).toBe(last.perSecond);
    expect(w.hpMult).toBe(last.hpMult);
    expect(w.speedMult).toBe(last.speedMult);
    expect(w.weights).toBe(last.weights);
  });

  it('chaque minute : PV ×1,25 cumulés, +2 ennemis/s, +3 % de vitesse', () => {
    const w = endlessWave(last, 2, out());
    expect(w.hpMult).toBeCloseTo(last.hpMult * 1.25 * 1.25);
    expect(w.perSecond).toBe(last.perSecond + 4);
    expect(w.speedMult).toBeCloseTo(last.speedMult * 1.06);
  });

  it('la vitesse est plafonnée', () => {
    expect(endlessWave(last, 60, out()).speedMult).toBe(ENDLESS.maxSpeedMult);
  });

  it('un boss toutes les 3 min, 50 % plus résistant à chaque fois', () => {
    expect(endlessBossHpMult(1)).toBeCloseTo((BOSS_SPAWNS[1]?.hpMult ?? 0) * 1.5);
    expect(endlessBossHpMult(2)).toBeCloseTo(endlessBossHpMult(1) * 1.5);

    const { pool, spawner } = setup(2000);
    // On saute après les boss normaux (un par update), puis on lance le sans fin à 10:00.
    for (let i = 0; i < BOSS_SPAWNS.length; i++) spawner.update(1 / 60, 600, 0, 0);
    spawner.startEndless(600);
    const bossesBefore = activeEnemies(pool).filter((e) => e.type === ENEMY_TYPES.boss).length;
    spawner.update(1 / 60, 600 + ENDLESS.bossInterval - 1, 0, 0);
    expect(activeEnemies(pool).filter((e) => e.type === ENEMY_TYPES.boss).length).toBe(
      bossesBefore,
    );
    spawner.update(1 / 60, 600 + ENDLESS.bossInterval, 0, 0);
    const bosses = activeEnemies(pool).filter((e) => e.type === ENEMY_TYPES.boss);
    expect(bosses.length).toBe(bossesBefore + 1);
    expect(bosses.some((b) => b.maxHp === ENEMY_TYPES.boss.hp * endlessBossHpMult(1))).toBe(true);
  });
});
