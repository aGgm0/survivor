import type { Pool } from '../core/Pool';
import type { Enemy } from '../entities/Enemy';

/** Chaque ennemi actif avance en ligne droite vers le joueur. */
export function moveEnemiesTowards(
  enemies: Pool<Enemy>,
  targetX: number,
  targetY: number,
  dt: number,
): void {
  // Boucle indexée plutôt que for...of / forEach : chemin chaud, on évite tout surcoût.
  const items = enemies.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e?.active) continue;
    e.syncPrevious();
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;
    // Ne pas dépasser la cible si elle est plus proche que le pas de cette update.
    const step = Math.min(e.type.speed * dt, dist);
    e.x += (dx / dist) * step;
    e.y += (dy / dist) * step;
  }
}
