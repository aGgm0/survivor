import type { Input } from '../core/Input';
import type { Scene } from '../core/Scene';
import { CONTROLS } from '../data/controls';
import { CHARACTERS, isUnlocked, type CharacterDef } from '../data/characters';
import type { Profile } from '../data/profile';
import type { CharacterOverlay } from '../ui/CharacterOverlay';
import type { ShopOverlay } from '../ui/ShopOverlay';
import { buyShopItem } from '../data/shop';
import type { Settings } from '../data/settings';
import type { Hud } from '../ui/Hud';
import type { MenuOverlay } from '../ui/MenuOverlay';
import type { OptionsOverlay } from '../ui/OptionsOverlay';
import type { ProfileOverlay } from '../ui/ProfileOverlay';

/** Comme pour GameScene : seulement les méthodes utilisées, pour tester sans navigateur. */
export interface MenuSceneDeps {
  input: Pick<Input, 'wasPressed'>;
  menuOverlay: Pick<MenuOverlay, 'show' | 'hide' | 'takeAction'>;
  optionsOverlay: Pick<OptionsOverlay, 'show' | 'hide' | 'refresh' | 'takeAction'>;
  profileOverlay: Pick<ProfileOverlay, 'show' | 'hide' | 'takeBack'>;
  characterOverlay: Pick<CharacterOverlay, 'show' | 'hide' | 'takeChoice' | 'takeBack'>;
  shopOverlay: Pick<ShopOverlay, 'show' | 'hide' | 'refresh' | 'takeAction'>;
  hud: Pick<Hud, 'setVisible'>;
  /** Réglages partagés par tout le jeu : la scène les modifie sur place. */
  settings: Settings;
  /** Statistiques du joueur ; la boutique y dépense l'or */
  profile: Profile;
  /** Appelé après un achat : main.ts sauvegarde le profil. */
  onProfileChanged: () => void;
  /** Appelé après chaque changement de réglage : main.ts sauvegarde et applique. */
  onSettingsChanged: () => void;
  /** Lance une partie avec ce perso : main.ts crée une GameScene neuve. */
  onPlay: (character: CharacterDef) => void;
}

/** Les écrans du menu. Un seul visible à la fois. */
export type MenuScreen = 'main' | 'characters' | 'options' | 'profile' | 'shop';

/** Écran d'accueil, choix du perso, Options et Profil. Tout est en HTML : la scène lit les clics et les touches. */
export class MenuScene implements Scene {
  private screen: MenuScreen = 'main';

  constructor(private readonly deps: MenuSceneDeps) {}

  /** L'écran affiché (pour les tests). */
  get currentScreen(): MenuScreen {
    return this.screen;
  }

  enter(): void {
    // Le HUD n'a rien à afficher hors d'une partie.
    this.deps.hud.setVisible(false);
    this.open('main');
  }

  exit(): void {
    this.deps.menuOverlay.hide();
    this.deps.optionsOverlay.hide();
    this.deps.profileOverlay.hide();
    this.deps.characterOverlay.hide();
    this.deps.shopOverlay.hide();
  }

  update(): void {
    switch (this.screen) {
      case 'main':
        return this.updateMain();
      case 'characters':
        return this.updateCharacters();
      case 'options':
        return this.updateOptions();
      case 'profile':
        return this.updateProfile();
      case 'shop':
        return this.updateShop();
    }
  }

  /** Rien à dessiner : le menu HTML couvre le canvas (déjà effacé par la boucle). */
  render(): void {}

  private updateMain(): void {
    const { input, menuOverlay } = this.deps;
    // `takeAction` d'abord : il vide le clic mémorisé même si on joue au clavier.
    const action = menuOverlay.takeAction();
    if (action === 'options' || action === 'profile' || action === 'shop') this.open(action);
    else if (action === 'play' || input.wasPressed(CONTROLS.confirm)) this.open('characters');
  }

  /** Choix du perso : clic ou 1-2-3-4 ; un perso verrouillé ne se lance pas. Échap = retour. */
  private updateCharacters(): void {
    const { input, characterOverlay, profile } = this.deps;
    let index = characterOverlay.takeChoice();
    if (index === null) {
      if (input.wasPressed(CONTROLS.choice1)) index = 0;
      else if (input.wasPressed(CONTROLS.choice2)) index = 1;
      else if (input.wasPressed(CONTROLS.choice3)) index = 2;
      else if (input.wasPressed(CONTROLS.choice4)) index = 3;
    }
    const character = index === null ? undefined : CHARACTERS[index];
    if (character && isUnlocked(character, profile)) {
      this.deps.onPlay(character);
    } else if (characterOverlay.takeBack() || input.wasPressed(CONTROLS.back)) {
      this.open('main');
    }
  }

  private updateOptions(): void {
    const { input, optionsOverlay, settings } = this.deps;
    const action = optionsOverlay.takeAction();
    if (action?.kind === 'back' || input.wasPressed(CONTROLS.back)) {
      this.open('main');
    } else if (action?.kind === 'toggle') {
      settings[action.key] = !settings[action.key];
      optionsOverlay.refresh(settings);
      this.deps.onSettingsChanged();
    }
  }

  /** Boutique : achat (si assez d'or), sauvegarde, liste à jour. Échap ou Retour = menu. */
  private updateShop(): void {
    const { input, shopOverlay, profile } = this.deps;
    const action = shopOverlay.takeAction();
    if (action?.kind === 'back' || input.wasPressed(CONTROLS.back)) {
      this.open('main');
    } else if (action?.kind === 'buy' && buyShopItem(profile, action.id)) {
      this.deps.onProfileChanged();
      shopOverlay.refresh(profile);
    }
  }

  private updateProfile(): void {
    const back = this.deps.profileOverlay.takeBack();
    if (back || this.deps.input.wasPressed(CONTROLS.back)) this.open('main');
  }

  /** Affiche un écran et masque les autres. */
  private open(screen: MenuScreen): void {
    const { menuOverlay, optionsOverlay, profileOverlay, characterOverlay, shopOverlay } =
      this.deps;
    this.screen = screen;
    menuOverlay.hide();
    optionsOverlay.hide();
    profileOverlay.hide();
    characterOverlay.hide();
    shopOverlay.hide();
    if (screen === 'main') menuOverlay.show();
    else if (screen === 'shop') shopOverlay.show(this.deps.profile);
    else if (screen === 'characters') characterOverlay.show(CHARACTERS, this.deps.profile);
    else if (screen === 'options') optionsOverlay.show(this.deps.settings);
    else profileOverlay.show(this.deps.profile);
  }
}
