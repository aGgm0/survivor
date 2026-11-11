import type { Input } from '../core/Input';
import type { Scene } from '../core/Scene';
import { CONTROLS } from '../data/controls';
import type { Settings } from '../data/settings';
import type { Hud } from '../ui/Hud';
import type { MenuOverlay } from '../ui/MenuOverlay';
import type { OptionsOverlay } from '../ui/OptionsOverlay';

/** Comme pour GameScene : seulement les méthodes utilisées, pour tester sans navigateur. */
export interface MenuSceneDeps {
  input: Pick<Input, 'wasPressed'>;
  menuOverlay: Pick<MenuOverlay, 'show' | 'hide' | 'takeAction'>;
  optionsOverlay: Pick<OptionsOverlay, 'show' | 'hide' | 'refresh' | 'takeAction'>;
  hud: Pick<Hud, 'setVisible'>;
  /** Réglages partagés par tout le jeu : la scène les modifie sur place. */
  settings: Settings;
  /** Appelé après chaque changement de réglage : main.ts sauvegarde et applique. */
  onSettingsChanged: () => void;
  /** Lance une partie : main.ts crée une GameScene neuve. */
  onPlay: () => void;
}

/** Écran d'accueil et écran Options. Tout est en HTML : la scène lit les clics et les touches. */
export class MenuScene implements Scene {
  private inOptions = false;

  constructor(private readonly deps: MenuSceneDeps) {}

  /** Vrai quand l'écran Options est ouvert (pour les tests). */
  get isInOptions(): boolean {
    return this.inOptions;
  }

  enter(): void {
    // Le HUD n'a rien à afficher hors d'une partie.
    this.deps.hud.setVisible(false);
    this.deps.optionsOverlay.hide();
    this.deps.menuOverlay.show();
  }

  exit(): void {
    this.deps.menuOverlay.hide();
    this.deps.optionsOverlay.hide();
  }

  update(): void {
    if (this.inOptions) this.updateOptions();
    else this.updateMain();
  }

  /** Rien à dessiner : le menu HTML couvre le canvas (déjà effacé par la boucle). */
  render(): void {}

  private updateMain(): void {
    const { input, menuOverlay } = this.deps;
    // `takeAction` d'abord : il vide le clic mémorisé même si on joue au clavier.
    const action = menuOverlay.takeAction();
    if (action === 'options') this.setOptionsOpen(true);
    else if (action === 'play' || input.wasPressed(CONTROLS.confirm)) this.deps.onPlay();
  }

  private updateOptions(): void {
    const { input, optionsOverlay, settings } = this.deps;
    const action = optionsOverlay.takeAction();
    if (action?.kind === 'back' || input.wasPressed(CONTROLS.back)) {
      this.setOptionsOpen(false);
    } else if (action?.kind === 'toggle') {
      settings[action.key] = !settings[action.key];
      optionsOverlay.refresh(settings);
      this.deps.onSettingsChanged();
    }
  }

  private setOptionsOpen(open: boolean): void {
    this.inOptions = open;
    if (open) {
      this.deps.menuOverlay.hide();
      this.deps.optionsOverlay.show(this.deps.settings);
    } else {
      this.deps.optionsOverlay.hide();
      this.deps.menuOverlay.show();
    }
  }
}
