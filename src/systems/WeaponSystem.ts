import type { Pool } from '../core/Pool';
import { weaponRange } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Weapon } from '../entities/Weapon';
import type { CollisionSystem } from './CollisionSystem';

/** Tir automatique : chaque arme prête vise l'ennemi le plus proche à portée. */
export class WeaponSystem {
  /** Résultats de requête réutilisés : pas d'allocation. */
  private readonly candidates: Enemy[];

  constructor(
    capacity: number,
    private readonly collisions: CollisionSystem,
    private readonly projectiles: Pool<Projectile>,
  ) {
    this.candidates = new Array<Enemy>(capacity);
  }

  /** `collisions.rebuild()` doit avoir été appelé dans cette update (grille à jour). */
  update(dt: number, weapons: readonly Weapon[], fromX: number, fromY: number): void {
    for (const weapon of weapons) {
      weapon.cooldownTimer -= dt;
      if (weapon.cooldownTimer > 0) continue;

      const target = this.findNearest(fromX, fromY, weaponRange(weapon.def));
      if (!target) {
        // Personne à portée : l'arme reste prête (sans accumuler de tirs en retard).
        weapon.cooldownTimer = 0;
        continue;
      }
      if (this.fire(weapon, fromX, fromY, target)) weapon.cooldownTimer = weapon.def.cooldown;
    }
  }

  /**
   * Ennemi actif le plus proche dans `range`, ou null.
   * La grille ne renvoie que les ennemis des cases autour : pas besoin de parcourir tout le pool.
   */
  findNearest(x: number, y: number, range: number): Enemy | null {
    const count = this.collisions.queryNeighbors(x, y, range, this.candidates);
    let best: Enemy | null = null;
    // On compare les distances AU CARRÉ : même classement, sans racine carrée.
    let bestDistSq = range * range;
    for (let i = 0; i < count; i++) {
      const e = this.candidates[i];
      if (!e?.active) continue;
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

  private fire(weapon: Weapon, x: number, y: number, target: Enemy): boolean {
    const projectile = this.projectiles.acquire();
    if (!projectile) return false; // réserve pleine : on retentera à la prochaine update
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    projectile.launch(weapon, x, y, dx / dist, dy / dist);
    return true;
  }
}
