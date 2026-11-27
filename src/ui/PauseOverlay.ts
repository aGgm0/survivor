const RESUME_LABEL = 'Reprendre';
// Pas d'Échap ici : le navigateur ne laisse pas Échap remettre le plein écran.
const RESUME_FULLSCREEN_LABEL = 'Reprendre en plein écran';

/** Ce que le joueur peut demander depuis le menu pause. */
export type PauseAction = 'resume' | 'options' | 'restart' | 'menu';

/**
 * Menu pause en HTML par-dessus le canvas. Comme les autres menus, un clic est seulement
 * mémorisé : la scène le lit pendant son update (`takeAction`).
 */
export class PauseOverlay {
  private action: PauseAction | null = null;

  /**
   * `onHide` : appelé quand le menu pause se ferme (reprise, rejouer, options...) : main.ts y
   * oublie le plein écran à remettre.
   */
  constructor(
    private readonly el: HTMLElement,
    private readonly buttons: Readonly<Record<PauseAction, HTMLButtonElement>>,
    private readonly onHide: () => void = () => {},
  ) {
    buttons.resume.addEventListener('click', () => (this.action = 'resume'));
    buttons.options.addEventListener('click', () => (this.action = 'options'));
    buttons.restart.addEventListener('click', () => (this.action = 'restart'));
    buttons.menu.addEventListener('click', () => (this.action = 'menu'));
  }

  setVisible(visible: boolean): void {
    // Un clic d'une pause précédente ne doit pas resservir à la suivante.
    this.action = null;
    this.el.hidden = !visible;
    if (!visible) {
      this.setResumeFullscreen(false);
      this.onHide();
    }
  }

  /** Pause venue d'une sortie du plein écran : « Reprendre » le remettra (clic ou P). */
  setResumeFullscreen(on: boolean): void {
    this.buttons.resume.textContent = on ? RESUME_FULLSCREEN_LABEL : RESUME_LABEL;
  }

  /** L'action cliquée depuis la dernière lecture, ou null. */
  takeAction(): PauseAction | null {
    const action = this.action;
    this.action = null;
    return action;
  }
}
