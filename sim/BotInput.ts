// Faux clavier du bot : il « tient » des touches de déplacement, que GameScene lit comme
// celles d'un joueur (input.isDown).

import { CONTROLS } from '../src/data/controls';

export class BotInput {
  private readonly held = new Set<string>();

  /** Touches tenues, au format attendu par GameScene. */
  readonly isDown = (codes: readonly string[]): boolean => codes.some((c) => this.held.has(c));

  /** Direction de -1 à 1 sur chaque axe (0 = aucune touche). */
  setDirection(x: -1 | 0 | 1, y: -1 | 0 | 1): void {
    this.held.clear();
    if (x > 0) this.held.add(CONTROLS.right[0]);
    if (x < 0) this.held.add(CONTROLS.left[0]);
    if (y > 0) this.held.add(CONTROLS.down[0]);
    if (y < 0) this.held.add(CONTROLS.up[0]);
  }
}
