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
import type { MusicControl } from '../core/MusicPlayer';
import type { MusicName } from '../data/audio';
import type { ProfileOverlay } from '../ui/ProfileOverlay';
import { Rng } from '../core/math';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/Renderer';
import { frameAt, type SpriteAtlas } from '../core/SpriteAtlas';
import { MENU_BACKDROP } from '../data/sprites';
import { buildFloor } from './floor';
import { applyOptionsAction } from './options';

/** Seed fixe du sol du menu : le même décor à chaque retour au menu. */
const MENU_FLOOR_SEED = 0x6d656e75;
/** Couleur de fond tant que les sprites ne sont pas chargés */
const MENU_BG = '#14121a';

/** Comme pour GameScene : seulement les méthodes utilisées, pour tester sans navigateur. */
export interface MenuSceneDeps {
  input: Pick<Input, 'wasPressed'>;
  menuOverlay: Pick<MenuOverlay, 'show' | 'hide' | 'takeAction' | 'setPlayReady'>;
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
  /** Atlas des sprites, lu à chaque frame (il peut finir de charger après l'ouverture du menu) */
  sprites?: () => SpriteAtlas | null;
  /** Musique. Absente (tests) : menu muet. */
  music?: MusicControl<MusicName>;
  /**
   * Vrai quand sprites et effets ont fini de charger (ou échoué : formes simples). Tant que c'est
   * faux, « Jouer » est grisé : sinon toute la partie serait en formes simples. Absent : prêt.
   */
  assetsReady?: () => boolean;
}

/** Les écrans du menu. Un seul visible à la fois. */
/** Touches 1 à 8 de l'écran de choix du perso, dans l'ordre de CHARACTERS. */
const CHARACTER_KEYS = [
  CONTROLS.choice1,
  CONTROLS.choice2,
  CONTROLS.choice3,
  CONTROLS.choice4,
  CONTROLS.choice5,
  CONTROLS.choice6,
  CONTROLS.choice7,
  CONTROLS.choice8,
] as const;

export type MenuScreen = 'main' | 'characters' | 'options' | 'profile' | 'shop';

/** Écran d'accueil, choix du perso, Options et Profil. Tout est en HTML : la scène lit les clics et les touches. */
export class MenuScene implements Scene {
  private screen: MenuScreen = 'main';
  /** s depuis l'ouverture du menu (anime le fond) */
  private elapsed = 0;
  /** Sol du fond, préparé une fois quand l'atlas est prêt ; motif et vignette créés au 1er dessin */
  private floor: HTMLCanvasElement | null = null;
  private floorPattern: CanvasPattern | null = null;
  private vignette: CanvasGradient | null = null;

  constructor(private readonly deps: MenuSceneDeps) {}

  /** L'écran affiché (pour les tests). */
  get currentScreen(): MenuScreen {
    return this.screen;
  }

  enter(): void {
    // Le HUD n'a rien à afficher hors d'une partie.
    this.deps.hud.setVisible(false);
    this.deps.music?.play('menu');
    this.open('main');
  }

  exit(): void {
    this.deps.menuOverlay.hide();
    this.deps.optionsOverlay.hide();
    this.deps.profileOverlay.hide();
    this.deps.characterOverlay.hide();
    this.deps.shopOverlay.hide();
  }

  update(dt = 0): void {
    this.elapsed += dt;
    const sprites = this.deps.sprites?.();
    if (!this.floor && sprites)
      this.floor = buildFloor(sprites, new Rng(MENU_FLOOR_SEED), MENU_BACKDROP.floorDarken);
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

  /**
   * Fond animé, sous les écrans HTML du menu : sol qui défile, démons qui passent, bords
   * assombris. Tout est calculé à partir du temps : rien n'est modifié ici (hors caches de dessin).
   */
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = MENU_BG;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const sprites = this.deps.sprites?.();
    if (this.floor) {
      this.floorPattern ??= ctx.createPattern(this.floor, 'repeat');
      if (this.floorPattern) {
        // Le motif suit la translation : on le décale, puis on remplit tout l'écran.
        const ox = (this.elapsed * MENU_BACKDROP.scrollX) % this.floor.width;
        const oy = (this.elapsed * MENU_BACKDROP.scrollY) % this.floor.height;
        ctx.save();
        ctx.translate(-ox, -oy);
        ctx.fillStyle = this.floorPattern;
        ctx.fillRect(ox, oy, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.restore();
      }
    }
    if (sprites) this.renderWalkers(ctx, sprites);
    this.vignette ??= makeVignette(ctx);
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /** Démons qui traversent l'écran en boucle, chacun à sa vitesse et sur sa ligne. */
  private renderWalkers(ctx: CanvasRenderingContext2D, sprites: SpriteAtlas): void {
    const margin = 120; // ils entrent et sortent hors de l'écran
    const span = LOGICAL_WIDTH + margin * 2;
    for (const w of MENU_BACKDROP.walkers) {
      const frame = frameAt(
        sprites.animation(w.anim),
        this.elapsed + w.offset * 0.01,
        MENU_BACKDROP.frameTime,
      );
      if (!frame) continue;
      const travelled = (this.elapsed * Math.abs(w.speed) + w.offset) % span;
      const x = w.speed > 0 ? travelled - margin : LOGICAL_WIDTH + margin - travelled;
      sprites.draw(ctx, frame, x, w.y, w.scale, w.speed < 0);
    }
  }

  private updateMain(): void {
    const { input, menuOverlay } = this.deps;
    const ready = this.deps.assetsReady?.() ?? true;
    // Le bouton suit l'état du chargement (le DOM n'est touché qu'au changement, voir MenuOverlay).
    menuOverlay.setPlayReady(ready);
    // `takeAction` d'abord : il vide le clic mémorisé même si on joue au clavier.
    const action = menuOverlay.takeAction();
    if (action === 'options' || action === 'profile' || action === 'shop') this.open(action);
    else if (ready && (action === 'play' || input.wasPressed(CONTROLS.confirm)))
      this.open('characters');
  }

  /** Choix du perso : clic ou 1 à 8 ; un perso verrouillé ne se lance pas. Échap = retour. */
  private updateCharacters(): void {
    const { input, characterOverlay, profile } = this.deps;
    let index = characterOverlay.takeChoice();
    for (let k = 0; index === null && k < CHARACTER_KEYS.length; k++) {
      const keys = CHARACTER_KEYS[k];
      if (keys && input.wasPressed(keys)) index = k;
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
    } else if (applyOptionsAction(action, settings)) {
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

/** Bords assombris : transparent au centre, noir sur les côtés. */
function makeVignette(ctx: CanvasRenderingContext2D): CanvasGradient {
  const cx = LOGICAL_WIDTH / 2;
  const cy = LOGICAL_HEIGHT / 2;
  const g = ctx.createRadialGradient(cx, cy, LOGICAL_HEIGHT * 0.25, cx, cy, LOGICAL_WIDTH * 0.62);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, `rgba(0, 0, 0, ${MENU_BACKDROP.vignette})`);
  return g;
}
