/**
 * Plein écran du navigateur (Fullscreen API).
 *
 * Le navigateur n'accepte `requestFullscreen()` que pendant un clic ou un appui de touche du
 * joueur (« activation utilisateur ») : on l'appelle donc directement dans le gestionnaire de
 * l'événement, pas plus tard dans l'update. Pour la même raison, le plein écran ne se
 * sauvegarde pas : au chargement de la page, aucun clic ne permettrait de le rétablir.
 */

/** Ce dont on a besoin du document : permet de tester avec un faux document. */
export interface FullscreenDocument {
  readonly fullscreenElement: Element | null;
  readonly fullscreenEnabled: boolean;
  readonly documentElement: Pick<Element, 'requestFullscreen'>;
  exitFullscreen(): Promise<void>;
}

export class Fullscreen {
  /** Plein écran perdu pendant une partie (Échap), à remettre quand le joueur reprend */
  private lost = false;

  constructor(private readonly doc: FullscreenDocument) {}

  /** Vrai s'il faudra remettre le plein écran à la reprise. */
  get wantsRestore(): boolean {
    return this.lost;
  }

  /**
   * Le navigateur a quitté le plein écran sur Échap (on ne peut pas l'en empêcher : c'est sa
   * touche de sécurité). On le notera pour le remettre au prochain clic ou appui du joueur.
   */
  rememberToRestore(): void {
    this.lost = true;
  }

  forgetRestore(): void {
    this.lost = false;
  }

  /**
   * Remet le plein écran s'il a été perdu. À appeler dans un gestionnaire de clic ou de touche
   * (pas Échap : le navigateur ne compte pas Échap comme une activation utilisateur).
   */
  restoreIfLost(): void {
    if (!this.lost) return;
    this.lost = false;
    if (this.isAvailable && !this.isActive)
      this.doc.documentElement.requestFullscreen().catch(() => {});
  }

  get isActive(): boolean {
    return this.doc.fullscreenElement !== null;
  }

  /** Faux si le navigateur l'interdit (ex. cadre itch sans `allowfullscreen`). */
  get isAvailable(): boolean {
    return this.doc.fullscreenEnabled;
  }

  /** Entre ou sort du plein écran. À appeler dans un gestionnaire de clic ou de touche. */
  toggle(): void {
    if (!this.isAvailable) return;
    // Un refus (pas d'activation utilisateur…) rejette la promesse : on l'ignore, le jeu continue
    // simplement en fenêtre.
    if (this.isActive) this.doc.exitFullscreen().catch(() => {});
    else this.doc.documentElement.requestFullscreen().catch(() => {});
  }
}
