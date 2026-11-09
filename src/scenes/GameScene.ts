import { Camera } from '../core/Camera';
import type { Input } from '../core/Input';
import type { Scene } from '../core/Scene';
import { CONTROLS } from '../data/controls';
import { Player } from '../entities/Player';
import type { PauseOverlay } from '../ui/PauseOverlay';

/** px entre deux lignes de la grille de fond */
const GRID_SIZE = 64;
const GRID_COLOR = '#2c2c3d';

/** La partie en cours. Map infinie : pas de bords, le joueur va où il veut. */
export class GameScene implements Scene {
  private readonly player = new Player();
  private readonly camera = new Camera();
  private paused = false;

  constructor(
    private readonly input: Input,
    private readonly pauseOverlay: PauseOverlay,
  ) {}

  enter(): void {
    this.setPaused(false);
  }

  exit(): void {
    this.setPaused(false);
  }

  update(dt: number): void {
    if (this.input.wasPressed(CONTROLS.pause)) this.setPaused(!this.paused);

    if (this.paused) {
      // Le joueur ne bouge plus : sans ça, l'interpolation le ferait osciller
      // entre son ancienne et sa nouvelle position pendant toute la pause.
      this.player.syncPrevious();
      return;
    }

    const axisX =
      Number(this.input.isDown(CONTROLS.right)) - Number(this.input.isDown(CONTROLS.left));
    const axisY = Number(this.input.isDown(CONTROLS.down)) - Number(this.input.isDown(CONTROLS.up));
    this.player.update(dt, axisX, axisY);
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    // La caméra est un réglage d'affichage, pas de l'état de jeu : la placer ici
    // sur la position interpolée évite que le joueur "tremble" par rapport au décor.
    this.camera.lookAt(this.player.renderX(alpha), this.player.renderY(alpha));

    this.camera.begin(ctx);
    this.renderGrid(ctx);
    this.player.render(ctx, alpha);
    this.camera.end(ctx);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.pauseOverlay.setVisible(paused);
  }

  /** Ne dessine que les lignes visibles : la grille paraît infinie sans rien coûter. */
  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const cam = this.camera;
    const startX = Math.floor(cam.left / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(cam.top / GRID_SIZE) * GRID_SIZE;

    // Un seul chemin pour toutes les lignes = un seul appel de dessin (stroke).
    ctx.beginPath();
    for (let x = startX; x <= cam.right; x += GRID_SIZE) {
      ctx.moveTo(x, cam.top);
      ctx.lineTo(x, cam.bottom);
    }
    for (let y = startY; y <= cam.bottom; y += GRID_SIZE) {
      ctx.moveTo(cam.left, y);
      ctx.lineTo(cam.right, y);
    }
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
