import type { Camera } from '../core/Camera';
import { Pool, type Poolable } from '../core/Pool';

// Réglages purement visuels (aucun effet sur le jeu).
const POOL_SIZE = 64;
/** s : durée de l'anneau d'explosion */
const RING_LIFETIME = 0.25;
/** L'anneau part de cette fraction du rayon et grandit jusqu'au rayon complet */
const RING_START = 0.4;
const RING_WIDTH = 3;

/** Un anneau d'explosion qui s'agrandit et s'efface. */
class Ring implements Poolable {
  active = false;
  x = 0;
  y = 0;
  radius = 0;
  age = 0;
  color = '';
}

/** Effets visuels éphémères (explosions). En pool, comme le reste : aucune allocation en jeu. */
export class EffectsSystem {
  private readonly rings = new Pool(POOL_SIZE, () => new Ring());

  /** Réserve pleine : l'effet est sauté (purement visuel, rien n'est perdu). */
  explosion(x: number, y: number, radius: number, color: string): void {
    const ring = this.rings.acquire();
    if (!ring) return;
    ring.x = x;
    ring.y = y;
    ring.radius = radius;
    ring.age = 0;
    ring.color = color;
  }

  get activeCount(): number {
    return this.rings.activeCount;
  }

  update(dt: number): void {
    for (const ring of this.rings.items) {
      if (!ring.active) continue;
      ring.age += dt;
      if (ring.age >= RING_LIFETIME) this.rings.release(ring);
    }
  }

  /** À appeler entre `camera.begin` et `camera.end` (coordonnées monde). */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.lineWidth = RING_WIDTH;
    for (const ring of this.rings.items) {
      if (!ring.active) continue;
      if (ring.x + ring.radius < camera.left || ring.x - ring.radius > camera.right) continue;
      if (ring.y + ring.radius < camera.top || ring.y - ring.radius > camera.bottom) continue;
      const t = ring.age / RING_LIFETIME; // 0 → 1
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = ring.color;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius * (RING_START + (1 - RING_START) * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
