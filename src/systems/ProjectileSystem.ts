import type { Pool } from '../core/Pool';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import { MAX_ENEMY_RADIUS, type CollisionSystem } from './CollisionSystem';
import { damageEnemy, type HitEvents } from './damage';

/**
 * Marge de recherche : la grille a été construite avant que les ennemis bougent dans cette
 * update (quelques px au plus). On cherche un peu plus large, puis on vérifie la vraie distance.
 */
export const GRID_STALENESS_MARGIN = 8;

/** Déplace les projectiles, gère leurs impacts sur les ennemis et leur fin de vie. */
export class ProjectileSystem {
  private readonly candidates: Enemy[];

  constructor(
    capacity: number,
    private readonly collisions: CollisionSystem,
    private readonly events: HitEvents,
  ) {
    this.candidates = new Array<Enemy>(capacity);
  }

  update(dt: number, projectiles: Pool<Projectile>): void {
    const items = projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p?.active) continue;

      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0 || this.hitFirstEnemy(p)) projectiles.release(p);
    }
  }

  /** Touche le premier ennemi en contact. Renvoie vrai si le projectile a touché (et disparaît). */
  private hitFirstEnemy(p: Projectile): boolean {
    const reach = p.radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const count = this.collisions.queryNeighbors(p.x, p.y, reach, this.candidates);
    for (let j = 0; j < count; j++) {
      const e = this.candidates[j];
      // `active` : un ennemi tué plus tôt dans cette update est encore dans la grille.
      if (!e?.active) continue;
      const minDist = p.radius + e.type.radius;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > minDist * minDist) continue;
      if (p.source) damageEnemy(p.source, e, p.damage, this.events);
      return true;
    }
    return false;
  }
}
