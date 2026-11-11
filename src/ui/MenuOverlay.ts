/**
 * Menu principal en HTML. Comme pour le level up, un clic est seulement mémorisé :
 * c'est la scène qui le lit pendant son update (`takePlay`), la logique reste dans la game loop.
 */
export class MenuOverlay {
  private playClicked = false;

  constructor(
    private readonly el: HTMLElement,
    playButton: HTMLButtonElement,
  ) {
    playButton.addEventListener('click', () => (this.playClicked = true));
  }

  show(): void {
    this.playClicked = false;
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Vrai une seule fois après un clic sur "Jouer". */
  takePlay(): boolean {
    const clicked = this.playClicked;
    this.playClicked = false;
    return clicked;
  }
}
