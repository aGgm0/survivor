/** Une scène = un écran du jeu (menu, partie, game over...). Une seule est active à la fois. */
export interface Scene {
  enter(): void;
  exit(): void;
  /** Logique uniquement. `dt` est en secondes et vaut toujours le pas fixe. */
  update(dt: number): void;
  /** Dessin uniquement : ne doit jamais modifier l'état du jeu. */
  render(ctx: CanvasRenderingContext2D): void;
}
