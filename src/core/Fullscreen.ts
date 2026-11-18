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
  constructor(private readonly doc: FullscreenDocument) {}

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
