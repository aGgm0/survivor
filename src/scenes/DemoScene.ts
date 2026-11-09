import type { Scene } from '../core/Scene';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/Renderer';

// Scène temporaire de la Phase 0 : un carré qui rebondit, pour vérifier que la
// boucle, le dt et la mise à l'échelle marchent. Sera remplacée par GameScene en Phase 1.
const SQUARE_SIZE = 40;
const SQUARE_SPEED_X = 300; // px/s
const SQUARE_SPEED_Y = 200; // px/s

export class DemoScene implements Scene {
  private x = LOGICAL_WIDTH / 2;
  private y = LOGICAL_HEIGHT / 2;
  private vx = SQUARE_SPEED_X;
  private vy = SQUARE_SPEED_Y;

  enter(): void {}
  exit(): void {}

  update(dt: number): void {
    // Vitesse en px/s × dt en s = déplacement en px. Jamais de vitesse "par frame".
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // On recale dans les bords ET on force le sens de la vitesse : inverser seulement
    // la vitesse peut laisser le carré coincé hors limite (il s'inverse à chaque update).
    const half = SQUARE_SIZE / 2;
    if (this.x < half) {
      this.x = half;
      this.vx = Math.abs(this.vx);
    } else if (this.x > LOGICAL_WIDTH - half) {
      this.x = LOGICAL_WIDTH - half;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y < half) {
      this.y = half;
      this.vy = Math.abs(this.vy);
    } else if (this.y > LOGICAL_HEIGHT - half) {
      this.y = LOGICAL_HEIGHT - half;
      this.vy = -Math.abs(this.vy);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Bordure : permet de voir les limites de la zone 1280×720 dans le letterbox.
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, LOGICAL_WIDTH - 2, LOGICAL_HEIGHT - 2);

    ctx.fillStyle = '#8a6cff';
    ctx.fillRect(this.x - SQUARE_SIZE / 2, this.y - SQUARE_SIZE / 2, SQUARE_SIZE, SQUARE_SIZE);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('Phase 0 — F3 pour l’overlay debug', 16, LOGICAL_HEIGHT - 16);
  }
}
