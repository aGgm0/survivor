import type { Pool } from '../core/Pool';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import { MAX_ENEMY_RADIUS, type CollisionSystem } from './CollisionSystem';

/**
 * Marge de recherche : la grille a été construite avant que les ennemis bougent dans cette
 * update (quelques px au plus). On cherche un peu plus large, puis on vérifie la vraie distance.
 */
const GRID_STALENESS_MARGIN = 8;

/** Déplace les projectiles, gère leurs impacts sur les ennemis et leur fin de vie. */
export class ProjectileSystem {
  private readonly candidates: Enemy[];

  constructor(
    capacity: number,
    private readonly collisions: CollisionSystem,
    /** Appelé quand un ennemi tombe à 0 PV (la scène le retire, compte le kill, etc.). */
    private readonly onEnemyKilled: (enemy: Enemy) => void,
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
      this.damageEnemy(p, e);
      return true;
    }
    return false;
  }

  private damageEnemy(p: Projectile, e: Enemy): void {
    // Seuls les dégâts réellement utiles comptent : 10 sur un ennemi à 3 PV = 3.
    const dealt = Math.min(p.damage, e.hp);
    e.hp -= p.damage;
    if (p.source) p.source.totalDamage += dealt;
    if (e.hp <= 0) {
      if (p.source) p.source.kills++;
      this.onEnemyKilled(e);
    }
  }
}
