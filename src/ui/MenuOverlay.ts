/** Ce que le joueur peut demander depuis le menu principal. */
export type MenuAction = 'play' | 'options';

/**
 * Menu principal en HTML. Comme pour le level up, un clic est seulement mémorisé :
 * c'est la scène qui le lit pendant son update (`takeAction`), la logique reste dans la game loop.
 */
export class MenuOverlay {
  private action: MenuAction | null = null;

  constructor(
    private readonly el: HTMLElement,
    buttons: Readonly<Record<MenuAction, HTMLButtonElement>>,
  ) {
    buttons.play.addEventListener('click', () => (this.action = 'play'));
    buttons.options.addEventListener('click', () => (this.action = 'options'));
  }

  show(): void {
    this.action = null;
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** L'action cliquée depuis la dernière lecture, ou null. */
  takeAction(): MenuAction | null {
    const action = this.action;
    this.action = null;
    return action;
  }
}
