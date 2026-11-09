import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './Renderer';

/**
 * Caméra 2D. Les entités ont des coordonnées "monde" ; la caméra décale le dessin
 * pour que le point qu'elle regarde (x, y) apparaisse au centre de l'écran.
 */
export class Camera {
  /** Point du monde au centre de l'écran. */
  x = 0;
  y = 0;

  /** Bords du monde visibles à l'écran (pour ne dessiner que ce qui se voit). */
  get left(): number {
    return this.x - LOGICAL_WIDTH / 2;
  }
  get top(): number {
    return this.y - LOGICAL_HEIGHT / 2;
  }
  get right(): number {
    return this.x + LOGICAL_WIDTH / 2;
  }
  get bottom(): number {
    return this.y + LOGICAL_HEIGHT / 2;
  }

  lookAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** À partir d'ici, on dessine en coordonnées monde. Toujours fermer avec `end()`. */
  begin(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(-this.left, -this.top);
  }

  /** Retour aux coordonnées écran (pour dessiner du texte fixe par-dessus, par exemple). */
  end(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
