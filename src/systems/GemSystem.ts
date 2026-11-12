import type { Camera } from '../core/Camera';
import { Pool } from '../core/Pool';
import { GEM_MAGNET, GEM_POOL_SIZE, GEM_TIERS, RELOCATED_GEM_XP_FACTOR } from '../data/xp';
import { Gem } from '../entities/Gem';
import type { SpriteAtlas } from '../core/SpriteAtlas';
import { GEM_SCALE, GEM_SPRITES } from '../data/sprites';

/** Ce dont les gemmes ont besoin côté joueur. */
export interface Collector {
  x: number;
  y: number;
  radius: number;
  /** px : les gemmes dans ce rayon sont attirées */
  pickupRadius: number;
}

/** Gemmes d'XP : apparition, aimant, ramassage, rendu. */
export class GemSystem {
  readonly gems = new Pool(GEM_POOL_SIZE, () => new Gem());

  /**
   * Lâche une gemme en (x, y). Réserve pleine : on prend la gemme la plus éloignée du joueur
   * (celle qu'il a le moins de chances d'aller chercher) et on la déplace ici, en y ajoutant
   * la nouvelle valeur. Sa propre valeur est réduite (RELOCATED_GEM_XP_FACTOR) : l'XP se
   * rapproche du joueur, mais ce raccourci a un prix.
   */
  drop(x: number, y: number, value: number, playerX: number, playerY: number): void {
    const gem = this.gems.acquire();
    if (gem) {
      gem.drop(x, y, value);
      return;
    }
    const farthest = this.findFarthest(playerX, playerY);
    if (farthest) farthest.drop(x, y, farthest.value * RELOCATED_GEM_XP_FACTOR + value);
  }

  /** Déplace les gemmes attirées et renvoie l'XP ramassée pendant cette update. */
  update(dt: number, collector: Collector): number {
    let collected = 0;
    const pickupSq = collector.pickupRadius * collector.pickupRadius;
    const items = this.gems.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g?.active) continue;
      g.prevX = g.x;
      g.prevY = g.y;

      const dx = collector.x - g.x;
      const dy = collector.y - g.y;
      const distSq = dx * dx + dy * dy;
      if (!g.attracted) {
        if (distSq > pickupSq) continue; // gemme immobile, hors de portée
        g.attracted = true;
        g.speed = GEM_MAGNET.startSpeed;
      }

      g.speed += GEM_MAGNET.acceleration * dt;
      const dist = Math.sqrt(distSq);
      const step = g.speed * dt;
      // Ramassée quand elle atteint le joueur (ou l'atteindrait pendant ce pas).
      if (dist <= collector.radius || step >= dist) {
        collected += g.value;
        this.gems.release(g);
        continue;
      }
      g.x += (dx / dist) * step;
      g.y += (dy / dist) * step;
    }
    return collected;
  }

  /** Fige les gemmes (pause, mort) : sans ça l'interpolation les ferait trembler. */
  freeze(): void {
    for (const g of this.gems.items) {
      g.prevX = g.x;
      g.prevY = g.y;
    }
  }

  /**
   * Gemmes : sprite de leur palier si l'atlas des effets est chargé, sinon losanges groupés par
   * palier (un chemin + un fill par couleur).
   */
  render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    camera: Camera,
    fx?: SpriteAtlas | null,
  ): void {
    if (fx && this.renderSprites(ctx, alpha, camera, fx)) return;
    const items = this.gems.items;
    for (let t = 0; t < GEM_TIERS.length; t++) {
      const tier = GEM_TIERS[t];
      const next = GEM_TIERS[t + 1];
      if (!tier) continue;
      const s = tier.size;
      ctx.beginPath();
      for (let i = 0; i < items.length; i++) {
        const g = items[i];
        if (!g?.active || g.value < tier.minValue) continue;
        if (next && g.value >= next.minValue) continue; // appartient au palier suivant
        const x = g.renderX(alpha);
        const y = g.renderY(alpha);
        if (x + s < camera.left || x - s > camera.right) continue;
        if (y + s < camera.top || y - s > camera.bottom) continue;
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
      }
      ctx.fillStyle = tier.color;
      ctx.fill();
    }
  }

  /** Renvoie faux si un sprite de gemme manque (on retombe alors sur les losanges). */
  private renderSprites(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    camera: Camera,
    fx: SpriteAtlas,
  ): boolean {
    const items = this.gems.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g?.active) continue;
      // Palier = le plus haut dont la valeur minimale est atteinte.
      let t = 0;
      while (t + 1 < GEM_TIERS.length && g.value >= (GEM_TIERS[t + 1]?.minValue ?? Infinity)) t++;
      const frame = fx.animation(GEM_SPRITES[t] ?? GEM_SPRITES[0])[0];
      if (!frame) return false;
      const x = g.renderX(alpha);
      const y = g.renderY(alpha);
      const half = (frame.h * GEM_SCALE) / 2;
      if (x + half < camera.left || x - half > camera.right) continue;
      if (y + half < camera.top || y - half > camera.bottom) continue;
      fx.draw(ctx, frame, x, y + half, GEM_SCALE, false);
    }
    return true;
  }

  /** Ne sert que quand la réserve est pleine : parcourir les 1000 gemmes est alors acceptable. */
  private findFarthest(x: number, y: number): Gem | null {
    let farthest: Gem | null = null;
    let maxDistSq = -1;
    for (const g of this.gems.items) {
      if (!g.active || g.attracted) continue; // une gemme déjà en route vers le joueur reste
      const dx = g.x - x;
      const dy = g.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        farthest = g;
      }
    }
    return farthest;
  }
}
