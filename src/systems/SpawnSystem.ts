import { pickWeighted, type Rng } from '../core/math';
import type { Pool } from '../core/Pool';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/Renderer';
import type { EnemyType } from '../data/enemies';
import { SPAWN } from '../data/spawn';
import {
  BONUS_WAVES,
  BOSS_SPAWNS,
  BOSS_TYPE,
  ENDLESS,
  WAVES,
  endlessBossHpMult,
  endlessWave,
  waveAt,
  type MutableWave,
  type WaveDef,
} from '../data/waves';
import type { Enemy } from '../entities/Enemy';

/**
 * Rayon du cercle de spawn autour du joueur : la moitié de la diagonale de l'écran
 * (= distance centre → coin) + une marge. Tout point du cercle est donc hors écran.
 */
export const SPAWN_RADIUS = Math.hypot(LOGICAL_WIDTH, LOGICAL_HEIGHT) / 2 + SPAWN.offscreenMargin;
const RECYCLE_DISTANCE = SPAWN_RADIUS * SPAWN.recycleDistanceFactor;
const FLOAT_EPSILON = 1e-9;

/** Ce qu'il faut pour faire apparaître un ennemi de vague (vague normale ou vague du sans fin). */
type SpawnParams = Pick<WaveDef, 'weights' | 'hpMult' | 'speedMult'>;

/** Fait apparaître les ennemis selon la vague en cours, et les boss à leurs instants. */
export class SpawnSystem {
  private timer = 0;
  /** Prochain boss de BOSS_SPAWNS à faire apparaître */
  private nextBoss = 0;
  /** Un compteur par rush de BONUS_WAVES (tableau typé créé une fois : pas d'allocation) */
  private readonly bonusTimers = new Float64Array(BONUS_WAVES.length);
  /** s : début du mode sans fin ; null = partie normale */
  private endlessStart: number | null = null;
  /** Boss du sans fin déjà envoyés */
  private endlessBosses = 0;
  /** Vague du sans fin, recalculée sur place à chaque update (pas d'allocation) */
  private readonly endlessCurrent: MutableWave = {
    perSecond: 0,
    weights: WAVES[0]?.weights ?? [],
    hpMult: 1,
    speedMult: 1,
  };

  constructor(
    private readonly enemies: Pool<Enemy>,
    private readonly rng: Rng,
  ) {}

  /** Le joueur continue après la victoire : la difficulté monte à partir de `now`. */
  startEndless(now: number): void {
    this.endlessStart = now;
    this.endlessBosses = 0;
  }

  /** `now` = temps de partie (s) : détermine la vague active et l'arrivée des boss. */
  update(dt: number, now: number, playerX: number, playerY: number): void {
    const base = waveAt(now);
    const wave =
      this.endlessStart === null
        ? base
        : endlessWave(base, (now - this.endlessStart) / 60, this.endlessCurrent);
    const interval = 1 / wave.perSecond;
    this.timer += dt;
    // Tolérance : un intervalle comme 0,4 s ajouté plusieurs fois n'est pas exact en virgule
    // flottante, et sans elle un spawn "pile à l'heure" pouvait glisser d'une update.
    while (this.timer >= interval - FLOAT_EPSILON) {
      this.timer -= interval;
      if (this.enemies.activeCount < SPAWN.maxEnemies) this.spawnFromWave(wave, playerX, playerY);
    }

    this.updateBonusWaves(dt, now, wave, playerX, playerY);

    const boss = BOSS_SPAWNS[this.nextBoss];
    if (boss && now >= boss.time) {
      this.nextBoss++;
      // Chaque boss a ses propres multiplicateurs (pas ceux de la vague en cours).
      this.spawnAt(BOSS_TYPE, boss.hpMult, boss.speedMult, playerX, playerY);
    }
    this.updateEndlessBosses(now, playerX, playerY);

    this.recycleFarEnemies(playerX, playerY);
  }

  /** Sans fin : un boss toutes les `ENDLESS.bossInterval` s, plus résistant à chaque fois. */
  private updateEndlessBosses(now: number, playerX: number, playerY: number): void {
    if (this.endlessStart === null) return;
    const next = this.endlessStart + ENDLESS.bossInterval * (this.endlessBosses + 1);
    if (now < next) return;
    this.endlessBosses++;
    const lastBoss = BOSS_SPAWNS[BOSS_SPAWNS.length - 1];
    this.spawnAt(
      BOSS_TYPE,
      endlessBossHpMult(this.endlessBosses),
      lastBoss?.speedMult ?? 1,
      playerX,
      playerY,
    );
  }

  /** Rushs actifs : chacun a son propre compteur, comme la vague normale. */
  private updateBonusWaves(
    dt: number,
    now: number,
    wave: SpawnParams,
    playerX: number,
    playerY: number,
  ): void {
    for (let i = 0; i < BONUS_WAVES.length; i++) {
      const bonus = BONUS_WAVES[i];
      if (!bonus || now < bonus.start || now >= bonus.end) continue;
      const interval = 1 / bonus.perSecond;
      let timer = (this.bonusTimers[i] ?? 0) + dt;
      while (timer >= interval - FLOAT_EPSILON) {
        timer -= interval;
        if (this.enemies.activeCount < SPAWN.maxEnemies) {
          this.spawnAt(bonus.type, wave.hpMult, wave.speedMult, playerX, playerY);
        }
      }
      this.bonusTimers[i] = timer;
    }
  }

  /** Debug (F4) : fait apparaître `count` ennemis d'un coup, tirés selon la vague en cours. */
  spawnBatch(count: number, now: number, playerX: number, playerY: number): void {
    const wave = waveAt(now);
    for (let i = 0; i < count; i++) {
      if (!this.spawnFromWave(wave, playerX, playerY)) return;
    }
  }

  private spawnFromWave(wave: SpawnParams, playerX: number, playerY: number): boolean {
    const type = pickWeighted(wave.weights, this.rng.next());
    return this.spawnAt(type, wave.hpMult, wave.speedMult, playerX, playerY);
  }

  /** Place un ennemi sur le cercle de spawn, hors écran. Faux si la réserve est vide. */
  private spawnAt(
    type: EnemyType,
    hpMult: number,
    speedMult: number,
    playerX: number,
    playerY: number,
  ): boolean {
    const enemy = this.enemies.acquire();
    if (!enemy) return false;
    const angle = this.rng.range(0, Math.PI * 2);
    enemy.spawn(
      type,
      playerX + Math.cos(angle) * SPAWN_RADIUS,
      playerY + Math.sin(angle) * SPAWN_RADIUS,
      hpMult,
      speedMult,
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
