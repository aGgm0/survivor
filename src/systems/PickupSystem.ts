import type { Camera } from '../core/Camera';
import { lerp } from '../core/math';
import { Pool, type Poolable } from '../core/Pool';
import { PICKUPS } from '../data/furniture';
import { GEM_MAGNET } from '../data/xp';
import type { Collector } from './GemSystem';

export type PickupKind = 'gold' | 'food';

/** Une pièce d'or ou de la nourriture au sol (lâchée par le mobilier). */
class Pickup implements Poolable {
  active = false;
  kind: PickupKind = 'gold';
  /** Or rapporté, ou PV rendus */
  value = 0;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  attracted = false;
  speed = 0;
}

/**
 * Pièces et nourriture : même aimant que les gemmes d'XP (attirées dans le rayon de ramassage,
 * puis elles accélèrent jusqu'au joueur). En pool : aucune allocation en jeu.
 */
export class PickupSystem {
  private readonly pickups = new Pool(PICKUPS.poolSize, () => new Pickup());
  /** Ramassé pendant la dernière update (lu par la scène) */
  gold = 0;
  heal = 0;

  /** Réserve pleine : l'objet est perdu (rare : 200 objets au sol, 8 meubles au maximum). */
  drop(kind: PickupKind, value: number, x: number, y: number): void {
    const p = this.pickups.acquire();
    if (!p) return;
    p.kind = kind;
    p.value = value;
    p.x = p.prevX = x;
    p.y = p.prevY = y;
    p.attracted = false;
    p.speed = 0;
  }

  update(dt: number, collector: Collector): void {
    this.gold = 0;
    this.heal = 0;
    const pickupSq = collector.pickupRadius * collector.pickupRadius;
    for (const p of this.pickups.items) {
      if (!p.active) continue;
      p.prevX = p.x;
      p.prevY = p.y;
      const dx = collector.x - p.x;
      const dy = collector.y - p.y;
      const distSq = dx * dx + dy * dy;
      if (!p.attracted) {
        if (distSq > pickupSq) continue;
        p.attracted = true;
        p.speed = GEM_MAGNET.startSpeed;
      }
      p.speed += GEM_MAGNET.acceleration * dt;
      const dist = Math.sqrt(distSq);
      const step = p.speed * dt;
      if (dist <= collector.radius || step >= dist) {
        if (p.kind === 'gold') this.gold += p.value;
        else this.heal += p.value;
        this.pickups.release(p);
        continue;
      }
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }

  /** Fige les objets (pause, fin) : sans ça, l'interpolation les ferait trembler. */
  freeze(): void {
    for (const p of this.pickups.items) {
      p.prevX = p.x;
      p.prevY = p.y;
    }
  }

  /** Objets au sol (tests, debug). */
  get activeCount(): number {
    return this.pickups.activeCount;
  }

  /** À appeler entre `camera.begin` et `camera.end` (coordonnées monde). */
  render(ctx: CanvasRenderingContext2D, alpha: number, camera: Camera): void {
    for (const kind of ['gold', 'food'] as const) {
      const radius = kind === 'gold' ? PICKUPS.goldRadius : PICKUPS.foodRadius;
      ctx.beginPath();
      for (const p of this.pickups.items) {
        if (!p.active || p.kind !== kind) continue;
        const x = lerp(p.prevX, p.x, alpha);
        const y = lerp(p.prevY, p.y, alpha);
        if (x < camera.left - radius || x > camera.right + radius) continue;
        if (y < camera.top - radius || y > camera.bottom + radius) continue;
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = kind === 'gold' ? PICKUPS.goldColor : PICKUPS.foodColor;
      ctx.fill();
    }
  }
}
