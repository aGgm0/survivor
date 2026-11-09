/**
 * État du clavier, lu par la logique du jeu.
 *
 * On stocke `event.code` (position physique de la touche) et pas `event.key`
 * (lettre imprimée) : "KeyW" désigne la touche Z sur un AZERTY et W sur un QWERTY,
 * donc une seule config marche pour les deux claviers.
 */
export class Input {
  private readonly held = new Set<string>();
  /** Touches enfoncées depuis la dernière update (pour les actions "une fois", comme la pause). */
  private readonly pressed = new Set<string>();

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      // `repeat` = événement auto-répété quand on garde la touche enfoncée : ce n'est pas un nouvel appui.
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    // Si on alt-tab en tenant une touche, le keyup n'arrive jamais : sans ça,
    // le joueur continuerait d'avancer tout seul au retour.
    target.addEventListener('blur', () => {
      this.held.clear();
      this.pressed.clear();
    });
  }

  /** Vrai si au moins une des touches est maintenue. */
  isDown(codes: readonly string[]): boolean {
    for (const code of codes) if (this.held.has(code)) return true;
    return false;
  }

  /** Vrai si au moins une des touches vient d'être appuyée (une seule fois par appui). */
  wasPressed(codes: readonly string[]): boolean {
    for (const code of codes) if (this.pressed.has(code)) return true;
    return false;
  }

  /**
   * Appelé par Game après chaque update. Les appuis sont gardés jusqu'à ce qu'une
   * update les ait vus : une frame à 240 Hz peut ne contenir aucune update.
   */
  endUpdate(): void {
    this.pressed.clear();
  }
}
