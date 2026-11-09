import type { Pool } from '../core/Pool';
import { SpatialGrid } from '../core/SpatialGrid';
import { ENEMY_TYPE_LIST } from '../data/enemies';
import type { Enemy } from '../entities/Enemy';

/** Plus gros rayon d'ennemi : sert à savoir jusqu'où chercher des voisins. */
export const MAX_ENEMY_RADIUS = Math.max(...ENEMY_TYPE_LIST.map((t) => t.radius));
/** Une case doit contenir au moins un ennemi entier : 2 × le plus gros rayon. */
const CELL_SIZE = MAX_ENEMY_RADIUS * 2;
/** Marge pour compter un "contact" avec le joueur alors qu'on vient de le repousser au bord. */
const CONTACT_TOLERANCE = 1;

/** Ce dont la collision a besoin côté joueur (pas besoin de toute la classe Player). */
export interface CircleBody {
  x: number;
  y: number;
  /** vitesse en px/s */
  vx: number;
  vy: number;
  radius: number;
}

/** Grille spatiale des ennemis + contact avec le joueur. */
export class CollisionSystem {
  private readonly grid: SpatialGrid<Enemy>;

  constructor(capacity: number) {
    this.grid = new SpatialGrid(CELL_SIZE, capacity);
  }

  /** Range les ennemis actifs dans la grille. À refaire à chaque update, car tout bouge. */
  rebuild(enemies: Pool<Enemy>): void {
    this.grid.clear();
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (e?.active) this.grid.insert(e, e.x, e.y);
    }
  }

  /** Candidats voisins de (x, y) dans un rayon `radius` (distance à vérifier par l'appelant). */
  queryNeighbors(x: number, y: number, radius: number, out: Enemy[]): number {
    return this.grid.query(x, y, radius, out);
  }

  /**
   * Repousse hors du joueur les ennemis qui le chevauchent, et liste ceux qui le touchent.
   * Le joueur est prioritaire : il traverse la horde en la poussant, jamais l'inverse.
   * Boucle simple sur tous les ennemis : une distance par ennemi, c'est déjà très peu.
   */
  pushOutOfPlayer(enemies: Pool<Enemy>, player: CircleBody, touching: Enemy[]): number {
    const items = enemies.items;
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const minDist = player.radius + e.type.radius;
      const dist = Math.hypot(dx, dy);
      if (dist > minDist + CONTACT_TOLERANCE) continue;

      if (count < touching.length) touching[count++] = e;
      if (dist >= minDist) continue;

      const nx = dist === 0 ? 1 : dx / dist;
      const ny = dist === 0 ? 0 : dy / dist;
      e.x = player.x + nx * minDist;
      e.y = player.y + ny * minDist;
      // L'ennemi bousculé prend l'élan du joueur : sa vitesse "vers l'extérieur" vaut au moins
      // celle à laquelle le joueur avance vers lui (et au moins 0 : il ne rentre plus dedans).
      // Sans ça, il repartirait vers le joueur et serait re-téléporté à chaque update (saccades).
      // Ensuite, son accélération limitée le fait ralentir en douceur.
      const playerTowardEnemy = player.vx * nx + player.vy * ny;
      const enemyOutward = e.vx * nx + e.vy * ny;
      const needed = Math.max(0, playerTowardEnemy) - enemyOutward;
      if (needed > 0) {
        e.vx += needed * nx;
        e.vy += needed * ny;
      }
    }
    return count;
  }
}
