import { pickWeighted, type Rng } from '../core/math';
import type { Pool } from '../core/Pool';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/Renderer';
import type { EnemyType } from '../data/enemies';
import { SPAWN } from '../data/spawn';
import { BOSS_TIMES, BOSS_TYPE, waveAt, type WaveDef } from '../data/waves';
import type { Enemy } from '../entities/Enemy';

/**
 * Rayon du cercle de spawn autour du joueur : la moitié de la diagonale de l'écran
 * (= distance centre → coin) + une marge. Tout point du cercle est donc hors écran.
 */
export const SPAWN_RADIUS = Math.hypot(LOGICAL_WIDTH, LOGICAL_HEIGHT) / 2 + SPAWN.offscreenMargin;
const RECYCLE_DISTANCE = SPAWN_RADIUS * SPAWN.recycleDistanceFactor;
const FLOAT_EPSILON = 1e-9;

/** Fait apparaître les ennemis selon la vague en cours, et les boss à leurs instants. */
export class SpawnSystem {
  private timer = 0;
  /** Prochain boss de BOSS_TIMES à faire apparaître */
  private nextBoss = 0;

  constructor(
    private readonly enemies: Pool<Enemy>,
    private readonly rng: Rng,
  ) {}

  /** `now` = temps de partie (s) : détermine la vague active et l'arrivée des boss. */
  update(dt: number, now: number, playerX: number, playerY: number): void {
    const wave = waveAt(now);
    const interval = 1 / wave.perSecond;
    this.timer += dt;
    // Tolérance : un intervalle comme 0,4 s ajouté plusieurs fois n'est pas exact en virgule
    // flottante, et sans elle un spawn "pile à l'heure" pouvait glisser d'une update.
    while (this.timer >= interval - FLOAT_EPSILON) {
      this.timer -= interval;
      if (this.enemies.activeCount < SPAWN.maxEnemies) this.spawnFromWave(wave, playerX, playerY);
    }

    const bossTime = BOSS_TIMES[this.nextBoss];
    if (bossTime !== undefined && now >= bossTime) {
      this.nextBoss++;
      this.spawnAt(BOSS_TYPE, 1, playerX, playerY);
    }

    this.recycleFarEnemies(playerX, playerY);
  }

  /** Debug (F4) : fait apparaître `count` ennemis d'un coup, tirés selon la vague en cours. */
  spawnBatch(count: number, now: number, playerX: number, playerY: number): void {
    const wave = waveAt(now);
    for (let i = 0; i < count; i++) {
      if (!this.spawnFromWave(wave, playerX, playerY)) return;
    }
  }

  private spawnFromWave(wave: WaveDef, playerX: number, playerY: number): boolean {
    const type = pickWeighted(wave.weights, this.rng.next());
    return this.spawnAt(type, wave.hpMult, playerX, playerY);
  }

  /** Place un ennemi sur le cercle de spawn, hors écran. Faux si la réserve est vide. */
  private spawnAt(type: EnemyType, hpMult: number, playerX: number, playerY: number): boolean {
    const enemy = this.enemies.acquire();
    if (!enemy) return false;
    const angle = this.rng.range(0, Math.PI * 2);
    enemy.spawn(
      type,
      playerX + Math.cos(angle) * SPAWN_RADIUS,
      playerY + Math.sin(angle) * SPAWN_RADIUS,
      hpMult,
    );
    return true;
  }

  /**
   * Map infinie : si le joueur fuit, des ennemis restent loin derrière. Plutôt que de
   * les laisser occuper le pool pour rien, on les "retourne" de l'autre côté du joueur,
   * sur le cercle de spawn : ils réapparaissent hors écran, devant lui.
   */
  private recycleFarEnemies(playerX: number, playerY: number): void {
    const items = this.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active) continue;
      const dx = e.x - playerX;
      const dy = e.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= RECYCLE_DISTANCE) continue;
      // Direction opposée (-dx, -dy), ramenée à la longueur SPAWN_RADIUS.
      const k = SPAWN_RADIUS / dist;
      e.teleport(playerX - dx * k, playerY - dy * k);
    }
  }
}
