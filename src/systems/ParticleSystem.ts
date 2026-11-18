import type { Camera } from '../core/Camera';
import { lerp, type Rng } from '../core/math';
import { Pool, type Poolable } from '../core/Pool';
import type { BurstSettings } from '../data/feel';

/** Un éclat : un petit carré qui part, ralentit et rétrécit. */
class Particle implements Poolable {
  active = false;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  /** s restantes, et durée totale (pour la taille qui diminue) */
  life = 0;
  maxLife = 0;
  size = 0;
  color = '';
}

/**
 * Particules purement visuelles (morts d'ennemis, caisses, level up). En pool : aucune
 * allocation en jeu. Elles ont leur propre aléatoire : les tirer avec celui du jeu changerait
 * la suite de la partie (même seed → même partie).
 */
export class ParticleSystem {
  private readonly particles: Pool<Particle>;

  constructor(
    poolSize: number,
    private readonly rng: Rng,
    /** Freinage (1/s) */
    private readonly drag: number,
  ) {
    this.particles = new Pool(poolSize, () => new Particle());
  }

  get activeCount(): number {
    return this.particles.activeCount;
  }

  /**
   * Gerbe de `count` éclats autour de (x, y), dans toutes les directions. `ring` : directions
   * réparties régulièrement (anneau) au lieu d'être tirées au hasard. Réserve pleine : le reste
   * est sauté (purement visuel, rien n'est perdu).
   */
  burst(
    x: number,
    y: number,
    burst: BurstSettings,
    color: string,
    count = burst.count,
    ring = false,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles.acquire();
      if (!p) return;
      const angle = ring ? (i / count) * Math.PI * 2 : this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(burst.speedMin, burst.speedMax);
      p.x = p.prevX = x;
      p.y = p.prevY = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = p.life = burst.life * this.rng.range(0.6, 1);
      p.size = burst.size;
      p.color = color;
    }
  }

  /**
   * Une seule particule, à vitesse donnée (ex. étincelle qui monte d'une aura). Réserve pleine :
   * rien n'est créé. `drag` ne s'applique pas moins : elle ralentit comme les autres.
   */
  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    life: number,
    color: string,
  ): void {
    const p = this.particles.acquire();
    if (!p) return;
    p.x = p.prevX = x;
    p.y = p.prevY = y;
    p.vx = vx;
    p.vy = vy;
    p.maxLife = p.life = life;
    p.size = size;
    p.color = color;
  }

  update(dt: number): void {
    // Freinage exponentiel : indépendant du nombre d'updates par seconde.
    const keep = Math.exp(-this.drag * dt);
    for (const p of this.particles.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.release(p);
        continue;
      }
      p.prevX = p.x;
      p.prevY = p.y;
      p.vx *= keep;
      p.vy *= keep;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /** Fige les particules (pause, level up) : sans ça, l'interpolation les ferait trembler. */
  freeze(): void {
    for (const p of this.particles.items) {
      p.prevX = p.x;
      p.prevY = p.y;
    }
  }

  /** À appeler entre `camera.begin` et `camera.end` (coordonnées monde). */
  render(ctx: CanvasRenderingContext2D, alpha: number, camera: Camera): void {
    let color = '';
    for (const p of this.particles.items) {
      if (!p.active) continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      if (x < camera.left || x > camera.right || y < camera.top || y > camera.bottom) continue;
      // Rétrécit par paliers de 2 px (pixels nets, comme les sprites ×2) au lieu de s'effacer.
      const size = Math.max(2, Math.round((p.size * (p.life / p.maxLife)) / 2) * 2);
      if (p.color !== color) {
        color = p.color;
        ctx.fillStyle = color;
      }
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }
  }
}
