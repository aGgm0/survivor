/** Une scène = un écran du jeu (menu, partie, game over...). Une seule est active à la fois. */
export interface Scene {
  enter(): void;
  exit(): void;
  /** Logique uniquement. `dt` est en secondes et vaut toujours le pas fixe. */
  update(dt: number): void;
  /**
   * Dessin uniquement : ne doit jamais modifier l'état du jeu.
   * `alpha` (0 à 1) = où on en est entre la dernière update et la suivante,
   * pour dessiner les positions interpolées.
   */
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  /** Optionnel : l'onglet vient d'être caché (la boucle s'arrête juste après). */
  onHidden?(): void;
  /** Optionnel : le joueur vient de quitter le plein écran. */
  onFullscreenExit?(): void;
}
