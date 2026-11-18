/** Ce que le joueur peut demander depuis le menu principal. */
export type MenuAction = 'play' | 'options' | 'profile' | 'shop';

/**
 * Menu principal en HTML. Comme pour le level up, un clic est seulement mémorisé :
 * c'est la scène qui le lit pendant son update (`takeAction`), la logique reste dans la game loop.
 */
export class MenuOverlay {
  private action: MenuAction | null = null;
  private readonly playButton: HTMLButtonElement;
  /** Dernier état affiché (null = jamais) : le DOM n'est modifié que quand il change. */
  private playReady: boolean | null = null;

  constructor(
    private readonly el: HTMLElement,
    buttons: Readonly<Record<MenuAction, HTMLButtonElement>>,
  ) {
    this.playButton = buttons.play;
    buttons.play.addEventListener('click', () => (this.action = 'play'));
    buttons.options.addEventListener('click', () => (this.action = 'options'));
    buttons.profile.addEventListener('click', () => (this.action = 'profile'));
    buttons.shop.addEventListener('click', () => (this.action = 'shop'));
  }

  show(): void {
    this.action = null;
    this.el.hidden = false;
  }

  /** « Jouer » grisé (« Chargement… ») tant que sprites et effets ne sont pas prêts. */
  setPlayReady(ready: boolean): void {
    if (ready === this.playReady) return;
    this.playReady = ready;
    this.playButton.disabled = !ready;
    this.playButton.textContent = ready ? 'Jouer' : 'Chargement…';
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
