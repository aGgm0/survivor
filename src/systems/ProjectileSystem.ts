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

/** px : largeur visible de l'effet d'impact d'un projectile (flèche fichée et poussière) */
const IMPACT_SIZE = 44;

/**
 * Déplace les projectiles, gère leurs impacts sur les ennemis et leur fin de vie.
 * Mutations : un projectile perforant traverse plusieurs ennemis ; un projectile
 * explosif blesse aussi les ennemis autour du point d'impact.
 */
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

      if (p.life <= 0 || this.hitEnemy(p)) {
        this.impact(p);
        projectiles.release(p);
      }
    }
  }

  /**
   * Touche un ennemi en contact (jamais deux fois le même). Renvoie vrai si le projectile
   * a fini sa course : plus de perforation restante, ou explosion.
   */
  private hitEnemy(p: Projectile): boolean {
    const reach = p.radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const count = this.collisions.queryNeighbors(p.x, p.y, reach, this.candidates);
    for (let j = 0; j < count; j++) {
      const e = this.candidates[j];
      // `active` : un ennemi tué plus tôt dans cette update est encore dans la grille.
      if (!e?.active || p.hasHit(e)) continue;
      const minDist = p.radius + e.type.radius;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > minDist * minDist) continue;
      const source = p.source;
      if (!source) return true;

      // Recul dans le sens du projectile.
      const speed = Math.hypot(p.vx, p.vy) || 1;
      damageEnemy(source, e, p.damage, this.events, p.vx / speed, p.vy / speed);

      const explosion = source.mutation?.explosion;
      if (explosion) {
        // Rayon de l'arme (passif Taille compris), pas celui de base.
        this.explode(p, e, source.explosionRadius, p.damage * explosion.damageRatio);
        return true;
      }
      p.hitEnemies[p.hitCount++] = e;
      p.pierceLeft--;
      // Un seul ennemi par update : un perforant en traverse un autre à l'update suivante.
      return p.pierceLeft <= 0;
    }
    return false;
  }

  /**
   * Le projectile s'arrête (dernier ennemi traversé, ou bout de course) : son effet d'impact,
   * s'il en a un (Arc : la flèche se fiche), tourné dans le sens du tir.
   */
  private impact(p: Projectile): void {
    const def = p.source?.def;
    if (def?.kind !== 'projectile' || !def.impactEffect) return;
    this.events.onEffect?.(def.impactEffect, p.x, p.y, IMPACT_SIZE, Math.atan2(p.vy, p.vx));
  }

  /** Explosion au point d'impact : blesse tous les ennemis proches, sauf celui déjà touché. */
  private explode(p: Projectile, primary: Enemy, radius: number, damage: number): void {
    const source = p.source;
    if (!source) return;
    this.events.onExplosion?.(p.x, p.y, radius, source.color);
    const reach = radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const count = this.collisions.queryNeighbors(p.x, p.y, reach, this.candidates);
    for (let j = 0; j < count; j++) {
      const e = this.candidates[j];
      if (!e?.active || e === primary) continue;
      const touch = radius + e.type.radius; // le souffle touche le bord de l'ennemi
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > touch * touch) continue;
      // Recul depuis le centre de l'explosion.
      const dist = Math.sqrt(distSq) || 1;
      damageEnemy(source, e, damage, this.events, dx / dist, dy / dist);
    }
  }
}
