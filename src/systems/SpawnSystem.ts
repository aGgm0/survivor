import { pickWeighted, type Rng } from '../core/math';
import type { Pool } from '../core/Pool';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/Renderer';
import { SPAWN } from '../data/spawn';
import type { Enemy } from '../entities/Enemy';

/**
 * Rayon du cercle de spawn autour du joueur : la moitié de la diagonale de l'écran
 * (= distance centre → coin) + une marge. Tout point du cercle est donc hors écran.
 */
export const SPAWN_RADIUS = Math.hypot(LOGICAL_WIDTH, LOGICAL_HEIGHT) / 2 + SPAWN.offscreenMargin;
const RECYCLE_DISTANCE = SPAWN_RADIUS * SPAWN.recycleDistanceFactor;
const SPAWN_INTERVAL = 1 / SPAWN.perSecond;
const FLOAT_EPSILON = 1e-9;

export class SpawnSystem {
  private timer = 0;

  constructor(
    private readonly enemies: Pool<Enemy>,
    private readonly rng: Rng,
  ) {}

  update(dt: number, playerX: number, playerY: number): void {
    this.timer += dt;
    // Tolérance : 0,8333… s ajouté plusieurs fois n'est pas exact en virgule flottante, et
    // sans elle un spawn "pile à l'heure" pouvait glisser d'une update.
    while (this.timer >= SPAWN_INTERVAL - FLOAT_EPSILON) {
      this.timer -= SPAWN_INTERVAL;
      if (this.enemies.activeCount < SPAWN.maxEnemies) this.spawnOne(playerX, playerY);
    }
    this.recycleFarEnemies(playerX, playerY);
  }

  /** Fait apparaître `count` ennemis d'un coup (dans la limite du pool). */
  spawnBatch(count: number, playerX: number, playerY: number): void {
    for (let i = 0; i < count; i++) {
      if (!this.spawnOne(playerX, playerY)) return;
    }
  }

  private spawnOne(playerX: number, playerY: number): boolean {
    const enemy = this.enemies.acquire();
    if (!enemy) return false;
    const type = pickWeighted(SPAWN.weights, this.rng.next());
    const angle = this.rng.range(0, Math.PI * 2);
    enemy.spawn(
      type,
      playerX + Math.cos(angle) * SPAWN_RADIUS,
      playerY + Math.sin(angle) * SPAWN_RADIUS,
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
