import { Rng } from '../core/math';
import type { Pool } from '../core/Pool';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Weapon } from '../entities/Weapon';
import { behaviorOf } from '../weapons/registry';
import type { WeaponUpdateContext } from '../weapons/WeaponBehavior';
import type { CollisionSystem } from './CollisionSystem';
import type { HitEvents } from './damage';

/**
 * Fait agir chaque arme du joueur. Ce que fait une arme dépend de son type (projectile, aura,
 * orbite, mêlée) et vit dans son module (src/weapons/) : ce système ne fait que leur passer
 * le contexte de l'update.
 */
export class WeaponSystem {
  /** Contexte passé aux armes : un seul objet, mis à jour à chaque update (pas d'allocation). */
  private readonly ctx: WeaponUpdateContext;

  constructor(
    capacity: number,
    private readonly collisions: CollisionSystem,
    projectiles: Pool<Projectile>,
    events: HitEvents,
    rng: Rng = new Rng(0),
  ) {
    this.ctx = {
      dt: 0,
      now: 0,
      x: 0,
      y: 0,
      facingX: 1,
      facingY: 0,
      collisions,
      projectiles,
      events,
      rng,
      // Résultats de requête réutilisés : pas d'allocation.
      candidates: new Array<Enemy>(capacity),
      findNearest: (x, y, range) => this.findNearest(x, y, range),
    };
  }

  /**
   * `collisions.rebuild()` doit avoir été appelé dans cette update (grille à jour).
   * `now` = temps de partie (s), pour les délais de re-touche des orbes.
   * (`facingX`, `facingY`) : direction regardée par le joueur (longueur 1), pour l'Épée.
   */
  update(
    dt: number,
    weapons: readonly Weapon[],
    fromX: number,
    fromY: number,
    now: number,
    facingX = 1,
    facingY = 0,
  ): void {
    const ctx = this.ctx;
    ctx.dt = dt;
    ctx.now = now;
    ctx.x = fromX;
    ctx.y = fromY;
    ctx.facingX = facingX;
    ctx.facingY = facingY;
    for (const weapon of weapons) behaviorOf(weapon.def).update(weapon, weapon.def, ctx);
  }

  /**
   * Ennemi actif le plus proche dans `range`, ou null.
   * La grille ne renvoie que les ennemis des cases autour : pas besoin de parcourir tout le pool.
   */
  findNearest(x: number, y: number, range: number): Enemy | null {
    const candidates = this.ctx.candidates;
    const count = this.collisions.queryNeighbors(x, y, range, candidates);
    let best: Enemy | null = null;
    // On compare les distances AU CARRÉ : même classement, sans racine carrée.
    let bestDistSq = range * range;
    for (let i = 0; i < count; i++) {
      const e = candidates[i];
      // La visée automatique ignore le mobilier (on ne gâche pas un tir sur un tonneau).
      if (!e?.active || e.type.prop) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = e;
      }
    }
    return best;
  }
}
