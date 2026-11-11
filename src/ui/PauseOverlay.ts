/** Ce que le joueur peut demander depuis le menu pause. */
export type PauseAction = 'resume' | 'restart' | 'menu';

/**
 * Menu pause en HTML par-dessus le canvas. Comme les autres menus, un clic est seulement
 * mémorisé : la scène le lit pendant son update (`takeAction`).
 */
export class PauseOverlay {
  private action: PauseAction | null = null;

  constructor(
    private readonly el: HTMLElement,
    buttons: Readonly<Record<PauseAction, HTMLButtonElement>>,
  ) {
    buttons.resume.addEventListener('click', () => (this.action = 'resume'));
    buttons.restart.addEventListener('click', () => (this.action = 'restart'));
    buttons.menu.addEventListener('click', () => (this.action = 'menu'));
  }

  setVisible(visible: boolean): void {
    // Un clic d'une pause précédente ne doit pas resservir à la suivante.
    this.action = null;
    this.el.hidden = !visible;
  }

  /** L'action cliquée depuis la dernière lecture, ou null. */
  takeAction(): PauseAction | null {
    const action = this.action;
    this.action = null;
    return action;
  }
}
