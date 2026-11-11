import type { Input } from '../core/Input';
import type { Scene } from '../core/Scene';
import { CONTROLS } from '../data/controls';
import type { Hud } from '../ui/Hud';
import type { MenuOverlay } from '../ui/MenuOverlay';

/** Comme pour GameScene : seulement les méthodes utilisées, pour tester sans navigateur. */
export interface MenuSceneDeps {
  input: Pick<Input, 'wasPressed'>;
  menuOverlay: Pick<MenuOverlay, 'show' | 'hide' | 'takePlay'>;
  hud: Pick<Hud, 'setVisible'>;
  /** Lance une partie : main.ts crée une GameScene neuve. */
  onPlay: () => void;
}

/** Écran d'accueil. Tout est en HTML : la scène ne fait qu'attendre "Jouer". */
export class MenuScene implements Scene {
  constructor(private readonly deps: MenuSceneDeps) {}

  enter(): void {
    // Le HUD n'a rien à afficher hors d'une partie.
    this.deps.hud.setVisible(false);
    this.deps.menuOverlay.show();
  }

  exit(): void {
    this.deps.menuOverlay.hide();
  }

  update(): void {
    const { input, menuOverlay } = this.deps;
    // `takePlay` d'abord : il vide le clic mémorisé même si on joue au clavier.
    const clicked = menuOverlay.takePlay();
    if (clicked || input.wasPressed(CONTROLS.confirm)) this.deps.onPlay();
  }

  /** Rien à dessiner : le menu HTML couvre le canvas (déjà effacé par la boucle). */
  render(): void {}
}
