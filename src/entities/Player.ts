import { lerp, normalizeInto, type Vec2 } from '../core/math';
import { PLAYER_BASE } from '../data/player';

const PLAYER_COLOR = '#8a6cff';

export class Player {
  x = 0;
  y = 0;
  /** Position à l'update précédente : sert à l'interpolation au rendu. */
  prevX = 0;
  prevY = 0;
  /** Vitesse actuelle en px/s (sert à transmettre l'élan aux ennemis que le joueur bouscule). */
  vx = 0;
  vy = 0;
  speed: number = PLAYER_BASE.speed;
  readonly radius: number = PLAYER_BASE.radius;

  // Réutilisé à chaque update pour ne pas allouer d'objet.
  private readonly dir: Vec2 = { x: 0, y: 0 };

  /**
   * `axisX` / `axisY` valent -1, 0 ou 1 (directions demandées par le joueur).
   * On reçoit des nombres plutôt que l'Input : Player reste testable sans clavier.
   */
  update(dt: number, axisX: number, axisY: number): void {
    this.syncPrevious();
    // Sans normalisation, la diagonale (1, 1) a une longueur de ~1,41 : on irait 41 % plus vite.
    normalizeInto(axisX, axisY, this.dir);
    this.vx = this.dir.x * this.speed;
    this.vy = this.dir.y * this.speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** Aligne la position précédente sur l'actuelle (début d'update, pause, téléportation). */
  syncPrevious(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }

  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha);
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(this.renderX(alpha), this.renderY(alpha), this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
