import { pickWeighted, type Rng } from '../core/math';
import type { Pool } from '../core/Pool';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/Renderer';
import { ENEMY_TYPES, type EnemyType } from '../data/enemies';
import { FURNITURE } from '../data/furniture';
import { SPAWN } from '../data/spawn';
import { DEFAULT_STAGE, type StageDef } from '../data/stages';
import {
  BOSS_ABILITIES,
  ENDLESS,
  endlessBossHpMult,
  endlessWave,
  waveAt,
  type BossSpawn,
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
type SpawnParams = Pick<WaveDef, 'weights' | 'hpMult' | 'speedMult'> &
  Partial<Pick<MutableWave, 'damageMult' | 'knockbackResist' | 'slowResist'>>;

/** Fait apparaître les ennemis selon la vague en cours, et les boss à leurs instants. */
export class SpawnSystem {
  private timer = 0;
  /** Prochain boss du niveau (`stage.bosses`) à faire apparaître */
  private nextBoss = 0;
  /** Un compteur par rush du niveau (tableau typé créé une fois : pas d'allocation) */
  private readonly bonusTimers: Float64Array;
  /** s : début du mode sans fin ; null = partie normale */
  private endlessStart: number | null = null;
  /** Boss du sans fin déjà envoyés */
  private endlessBosses = 0;
  /** Prochain mini-boss du niveau (`stage.elites`) */
  private nextElite = 0;
  /** s accumulées depuis la dernière apparition de mobilier */
  private furnitureTimer = 0;
  /** Vague du sans fin, recalculée sur place à chaque update (pas d'allocation) */
  private readonly endlessCurrent: MutableWave = {
    perSecond: 0,
    weights: [],
    hpMult: 1,
    speedMult: 1,
    damageMult: 1,
    knockbackResist: 0,
    slowResist: 0,
  };

  constructor(
    private readonly enemies: Pool<Enemy>,
    private readonly rng: Rng,
    /** Niveau joué : vagues, rushs, élites et boss */
    private readonly stage: StageDef = DEFAULT_STAGE,
  ) {
    this.bonusTimers = new Float64Array(stage.bonusWaves.length);
  }

  /** Le joueur continue après la victoire : la difficulté monte à partir de `now`. */
  startEndless(now: number): void {
    this.endlessStart = now;
    this.endlessBosses = 0;
  }

  /** Vague en cours : la normale, ou celle du sans fin (stats qui montent chaque minute). */
  private currentWave(now: number): SpawnParams & { readonly perSecond: number } {
    const base = waveAt(this.stage.waves, now);
    return this.endlessStart === null
      ? base
      : endlessWave(base, (now - this.endlessStart) / 60, this.endlessCurrent);
  }

  /** `now` = temps de partie (s) : détermine la vague active et l'arrivée des boss. */
  update(dt: number, now: number, playerX: number, playerY: number): void {
    const wave = this.currentWave(now);
    const interval = 1 / wave.perSecond;
    this.timer += dt;
    // Tolérance : un intervalle comme 0,4 s ajouté plusieurs fois n'est pas exact en virgule
    // flottante, et sans elle un spawn "pile à l'heure" pouvait glisser d'une update.
    while (this.timer >= interval - FLOAT_EPSILON) {
      this.timer -= interval;
      if (this.enemies.activeCount < SPAWN.maxEnemies) this.spawnFromWave(wave, playerX, playerY);
    }

    this.updateBonusWaves(dt, now, wave, playerX, playerY);

    const boss = this.stage.bosses[this.nextBoss];
    if (boss && now >= boss.time) {
      this.nextBoss++;
      // Chaque boss a ses propres multiplicateurs (pas ceux de la vague en cours).
      const spawned = this.spawnAt(boss.type, boss.hpMult, boss.speedMult, playerX, playerY);
      if (spawned) {
        spawned.bossIndex = this.nextBoss - 1;
        applyBossSpawn(spawned, boss);
        armBoss(spawned, now, boss.summons, 1);
      }
    }
    // Mini-boss : PV et vitesse de la vague en cours (l'XP suit, comme pour les autres).
    const elite = this.stage.elites[this.nextElite];
    if (elite && now >= elite.time) {
      this.nextElite++;
      this.spawnAt(elite.type, wave.hpMult, wave.speedMult, playerX, playerY);
    }
    this.updateEndlessBosses(now, playerX, playerY);
    this.updateFurniture(dt, playerX, playerY);

    this.recycleFarEnemies(playerX, playerY);
  }

  /** Sans fin : un boss toutes les `ENDLESS.bossInterval` s, plus résistant à chaque fois. */
  private updateEndlessBosses(now: number, playerX: number, playerY: number): void {
    if (this.endlessStart === null) return;
    const next = this.endlessStart + ENDLESS.bossInterval * (this.endlessBosses + 1);
    if (now < next) return;
    this.endlessBosses++;
    // Les boss du sans fin reprennent le dernier boss du niveau.
    const lastBoss = this.lastBoss();
    if (!lastBoss) return;
    const boss = this.spawnAt(
      lastBoss.type,
      endlessBossHpMult(lastBoss, this.endlessBosses),
      lastBoss.speedMult,
      playerX,
      playerY,
    );
    if (boss) applyBossSpawn(boss, lastBoss);
    // Les deux capacités, de plus en plus fréquentes à chaque boss.
    if (boss) armBoss(boss, now, true, BOSS_ABILITIES.endlessIntervalFactor ** this.endlessBosses);
  }

  /** Mobilier : un nouveau toutes les `FURNITURE.spawnInterval` s, hors écran, s'il en manque. */
  private updateFurniture(dt: number, playerX: number, playerY: number): void {
    this.furnitureTimer += dt;
    if (this.furnitureTimer < FURNITURE.spawnInterval) return;
    this.furnitureTimer -= FURNITURE.spawnInterval;
    // Compté seulement à chaque apparition (toutes les 15 s) : parcourir le pool est alors gratuit.
    let props = 0;
    for (const e of this.enemies.items) if (e.active && e.type.prop) props++;
    if (props < FURNITURE.maxActive) this.spawnAt(ENEMY_TYPES.crate, 1, 1, playerX, playerY);
  }

  /** Rushs actifs : chacun a son propre compteur, comme la vague normale. */
  private updateBonusWaves(
    dt: number,
    now: number,
    wave: SpawnParams,
    playerX: number,
    playerY: number,
  ): void {
    const bonusWaves = this.stage.bonusWaves;
    for (let i = 0; i < bonusWaves.length; i++) {
      const bonus = bonusWaves[i];
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

  /**
   * Menu de test : saut dans le temps. Les boss prévus AVANT `now` sont sautés (sinon aller à
   * 9:00 ferait apparaître aussi celui de 5:00) ; celui prévu pile à `now` arrivera.
   */
  jumpTo(now: number): void {
    this.nextBoss = 0;
    while ((this.stage.bosses[this.nextBoss]?.time ?? Infinity) < now) this.nextBoss++;
    this.nextElite = 0;
    while ((this.stage.elites[this.nextElite]?.time ?? Infinity) < now) this.nextElite++;
  }

  /** Menu de test : un boss tout de suite, comme le dernier boss prévu (charge + invocation). */
  spawnBoss(playerX: number, playerY: number, now: number): void {
    const last = this.lastBoss();
    if (!last) return;
    const boss = this.spawnAt(last.type, last.hpMult, last.speedMult, playerX, playerY);
    if (boss) applyBossSpawn(boss, last);
    if (boss) armBoss(boss, now, true, 1);
  }

  /** Dernier boss prévu par le niveau (modèle des boss du sans fin et du menu de test). */
  private lastBoss(): BossSpawn | undefined {
    return this.stage.bosses[this.stage.bosses.length - 1];
  }

  /** Menu de test : un mini-boss tout de suite (index dans `stage.elites`). */
  spawnElite(index: number, playerX: number, playerY: number, now: number): void {
    const elite = this.stage.elites[index];
    if (!elite) return;
    const wave = waveAt(this.stage.waves, now);
    this.spawnAt(elite.type, wave.hpMult, wave.speedMult, playerX, playerY);
  }

  /**
   * Invocation d'un boss : des basiques et des basiques élites en cercle autour de (x, y),
   * avec les PV et la vitesse de la vague en cours. Respecte le plafond d'ennemis.
   */
  summonAround(x: number, y: number, now: number): void {
    const wave = this.currentWave(now);
    const { basics, elites, radius } = BOSS_ABILITIES.summon;
    const total = basics + elites;
    for (let i = 0; i < total; i++) {
      if (this.enemies.activeCount >= SPAWN.maxEnemies) return;
      const e = this.enemies.acquire();
      if (!e) return;
      const angle = (i / total) * Math.PI * 2;
      const type = i < elites ? ENEMY_TYPES.basicElite : ENEMY_TYPES.basic;
      e.spawn(
        type,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        wave.hpMult,
        wave.speedMult,
        wave.damageMult,
        wave.knockbackResist,
        wave.slowResist,
      );
      e.summoned = true;
    }
  }

  /** Debug (F4) : fait apparaître `count` ennemis d'un coup, tirés selon la vague en cours. */
  spawnBatch(count: number, now: number, playerX: number, playerY: number): void {
    const wave = waveAt(this.stage.waves, now);
    for (let i = 0; i < count; i++) {
      if (!this.spawnFromWave(wave, playerX, playerY)) return;
    }
  }

  private spawnFromWave(wave: SpawnParams, playerX: number, playerY: number): boolean {
    const type = pickWeighted(wave.weights, this.rng.next());
    return (
      this.spawnAt(
        type,
        wave.hpMult,
        wave.speedMult,
        playerX,
        playerY,
        wave.damageMult,
        wave.knockbackResist,
        wave.slowResist,
      ) !== null
    );
  }

  /** Place un ennemi sur le cercle de spawn, hors écran. null si la réserve est vide. */
  private spawnAt(
    type: EnemyType,
    hpMult: number,
    speedMult: number,
    playerX: number,
    playerY: number,
    damageMult = 1,
    knockbackResist = 0,
    slowResist = 0,
  ): Enemy | null {
    const enemy = this.enemies.acquire();
    if (!enemy) return null;
    const angle = this.rng.range(0, Math.PI * 2);
    enemy.spawn(
      type,
      playerX + Math.cos(angle) * SPAWN_RADIUS,
      playerY + Math.sin(angle) * SPAWN_RADIUS,
      hpMult,
      speedMult,
      damageMult,
      knockbackResist,
      slowResist,
    );
    return enemy;
  }

  /**
   * Map infinie : si le joueur fuit, des ennemis restent loin derrière. Plutôt que de
   * les laisser occuper le pool pour rien, on les replace sur le cercle de spawn (hors écran) :
   * - les ennemis normaux à un angle AU HASARD : la file qui suivait le joueur se redistribue
   *   tout autour de lui (sinon on pouvait tourner en rond avec la horde derrière soi) ;
   * - les boss et les élites pile EN FACE, devant le joueur : une menace ne se perd pas de vue.
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
      // Mobilier laissé loin derrière : il disparaît (un autre apparaîtra), il ne se « téléporte » pas.
      if (e.type.prop) {
        this.enemies.release(e);
        continue;
      }
      if (e.type.boss || e.type.elite) {
        // Direction opposée (-dx, -dy), ramenée à la longueur SPAWN_RADIUS.
        const k = SPAWN_RADIUS / dist;
        e.teleport(playerX - dx * k, playerY - dy * k);
      } else {
        // Aléatoire de la partie : même seed, mêmes replacements.
        const angle = this.rng.range(0, Math.PI * 2);
        e.teleport(
          playerX + Math.cos(angle) * SPAWN_RADIUS,
          playerY + Math.sin(angle) * SPAWN_RADIUS,
        );
      }
    }
  }
}

/**
 * Arme un boss qui vient d'apparaître : 1re charge (et 1re invocation s'il en a le droit) après
 * un court délai, pour que le joueur le voie arriver. `rate` < 1 = capacités plus fréquentes.
 */
export function armBoss(boss: Enemy, now: number, canSummon: boolean, rate: number): void {
  boss.abilityRate = rate;
  boss.nextChargeAt = now + BOSS_ABILITIES.charge.firstDelay * rate;
  boss.nextSummonAt = canSummon ? now + BOSS_ABILITIES.summon.firstDelay * rate : Infinity;
}

/** Réglages propres à un boss (annonce et vitesse de sa charge) ; les boss du sans fin reprennent ceux du dernier. */
function applyBossSpawn(enemy: Enemy, def: BossSpawn): void {
  enemy.chargeWindup = def.chargeWindup ?? 0;
  enemy.dashSpeedMult = def.dashSpeedMult ?? 0;
  enemy.resistancesOverride = def.resistances;
}
