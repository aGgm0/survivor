import { Game } from './core/Game';
import { Fullscreen } from './core/Fullscreen';
import { CONTROLS, RESUME_FULLSCREEN_KEY } from './data/controls';
import { GAME_VERSION } from './data/version';
import { Renderer } from './core/Renderer';
import { DebugOverlay } from './core/DebugOverlay';
import { Input } from './core/Input';
import { GameScene } from './scenes/GameScene';
import { PauseOverlay } from './ui/PauseOverlay';
import { EndOverlay } from './ui/EndOverlay';
import { Hud } from './ui/Hud';
import { LevelUpOverlay } from './ui/LevelUpOverlay';
import { MenuOverlay } from './ui/MenuOverlay';
import { MenuScene } from './scenes/MenuScene';
import { OptionsOverlay } from './ui/OptionsOverlay';
import { SaveStore } from './core/SaveStore';
import { SETTINGS_KEY, parseSettings, serializeSettings } from './data/settings';
import { PROFILE_KEY, parseProfile, recordRun, serializeProfile } from './data/profile';
import { ProfileOverlay } from './ui/ProfileOverlay';
import { DevPanel } from './ui/DevPanel';
import { CharacterOverlay } from './ui/CharacterOverlay';
import { ShopOverlay } from './ui/ShopOverlay';
import { DEFAULT_CHARACTER, newUnlocks, type CharacterDef } from './data/characters';
import type { RunReport } from './types/RunReport';
import { SpriteAtlas } from './core/SpriteAtlas';
import {
  ATLAS_URLS,
  CHARACTER_SPRITES,
  EFFECT_DIRS,
  FX_ATLAS_URLS,
  HP_BAR_URLS,
  type EffectName,
} from './data/sprites';
import { loadImage } from './core/loadImage';
import type { HpBarSkin } from './scenes/game/hpBar';
import { EffectSheet } from './core/EffectSheet';
import { AudioEngine } from './core/AudioEngine';
import {
  SFX,
  SFX_COMPRESSOR,
  SFX_DIR,
  SFX_EXTENSION,
  SFX_BASE_VOLUME,
  MUSIC,
  MUSIC_BASE_VOLUME,
  MUSIC_DIR,
  MUSIC_EXTENSION,
  MUSIC_FADE,
  MUSIC_PAUSE_DUCK,
  type SfxName,
} from './data/audio';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Élément #${id} introuvable`);
  return el;
}

// Réglages : lus une fois au lancement (sauvegarde validée champ par champ), puis partagés.
const store = SaveStore.fromBrowser();
const settings = parseSettings(store.load(SETTINGS_KEY));
const profile = parseProfile(store.load(PROFILE_KEY));

const renderer = new Renderer(
  getElement('game', HTMLCanvasElement),
  getElement('ui', HTMLDivElement),
);
const debug = new DebugOverlay(
  getElement('debug-overlay', HTMLDivElement),
  getElement('fps-counter', HTMLDivElement),
);
const input = new Input(window);
const fullscreen = new Fullscreen(document);
const pauseOverlay = new PauseOverlay(
  getElement('pause-overlay', HTMLDivElement),
  {
    resume: getElement('pause-resume', HTMLButtonElement),
    options: getElement('pause-options', HTMLButtonElement),
    restart: getElement('pause-restart', HTMLButtonElement),
    menu: getElement('pause-menu', HTMLButtonElement),
  },
  () => fullscreen.forgetRestore(),
);
const endOverlay = new EndOverlay(
  getElement('end-overlay', HTMLDivElement),
  getElement('end-title', HTMLParagraphElement),
  getElement('end-info', HTMLParagraphElement),
  getElement('end-meter', HTMLDivElement),
  getElement('end-unlocks', HTMLParagraphElement),
  {
    continue: getElement('end-continue', HTMLButtonElement),
    restart: getElement('end-restart', HTMLButtonElement),
    menu: getElement('end-menu', HTMLButtonElement),
  },
);
const levelUpOverlay = new LevelUpOverlay(
  getElement('levelup-overlay', HTMLDivElement),
  getElement('levelup-title', HTMLParagraphElement),
  getElement('levelup-choices', HTMLDivElement),
  getElement('levelup-reroll', HTMLButtonElement),
);
const menuOverlay = new MenuOverlay(getElement('menu-overlay', HTMLDivElement), {
  play: getElement('menu-play', HTMLButtonElement),
  options: getElement('menu-options', HTMLButtonElement),
  profile: getElement('menu-profile', HTMLButtonElement),
  shop: getElement('menu-shop', HTMLButtonElement),
});
const shopOverlay = new ShopOverlay(
  getElement('shop-overlay', HTMLDivElement),
  getElement('shop-gold', HTMLParagraphElement),
  getElement('shop-list', HTMLDivElement),
  getElement('shop-back', HTMLButtonElement),
);
const characterOverlay = new CharacterOverlay(
  getElement('character-overlay', HTMLDivElement),
  getElement('character-cards', HTMLDivElement),
  getElement('character-back', HTMLButtonElement),
);
const profileOverlay = new ProfileOverlay(
  getElement('profile-overlay', HTMLDivElement),
  getElement('profile-summary', HTMLDivElement),
  getElement('profile-weapons', HTMLDivElement),
  getElement('profile-back', HTMLButtonElement),
);
// Version affichée dans le menu et sur l'écran de fin (fixe pour tout le build).
for (const el of document.querySelectorAll('.game-version')) el.textContent = `v${GAME_VERSION}`;

const optionsOverlay = new OptionsOverlay(
  getElement('options-overlay', HTMLDivElement),
  getElement('options-list', HTMLDivElement),
  getElement('options-back', HTMLButtonElement),
  fullscreen,
);
const hud = new Hud({
  root: getElement('hud', HTMLDivElement),
  timer: getElement('hud-timer', HTMLDivElement),
  level: getElement('hud-level', HTMLDivElement),
  xpFill: getElement('hud-xpfill', HTMLDivElement),
  hpFill: getElement('hud-hpfill', HTMLDivElement),
  hpText: getElement('hud-hptext', HTMLSpanElement),
  kills: getElement('hud-kills', HTMLDivElement),
  gold: getElement('hud-gold', HTMLDivElement),
  endless: getElement('hud-endless', HTMLDivElement),
  test: getElement('hud-test', HTMLDivElement),
  weapons: getElement('hud-weapons', HTMLDivElement),
  passives: getElement('hud-passives', HTMLDivElement),
  boss: getElement('hud-boss', HTMLDivElement),
  bossFill: getElement('hud-bossfill', HTMLDivElement),
  bossTrail: getElement('hud-bosstrail', HTMLDivElement),
  lowHp: getElement('hud-lowhp', HTMLDivElement),
});
const game = new Game(renderer, debug, input);

// Plein écran (touche F) : demandé pendant l'appui lui-même, sinon le navigateur refuse
// (voir core/Fullscreen.ts). Hors de la game loop, mais ça ne touche à aucun état de jeu.
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if ((CONTROLS.fullscreen as readonly string[]).includes(e.code)) fullscreen.toggle();
  // Reprendre avec P après une sortie du plein écran : on le remet pendant l'appui (Échap ne
  // le peut pas, le navigateur ne le compte pas comme une activation utilisateur).
  else if (e.code === RESUME_FULLSCREEN_KEY) fullscreen.restoreIfLost();
});
getElement('pause-resume', HTMLButtonElement).addEventListener('click', () =>
  fullscreen.restoreIfLost(),
);
document.addEventListener('fullscreenchange', () => {
  optionsOverlay.setFullscreen(fullscreen.isActive);
  // Sortir du plein écran (souvent avec Échap, que le jeu ne reçoit alors pas) met la partie
  // en pause : sinon on reprendrait la main en pleine horde. Le plein écran sera remis à la
  // reprise (clic sur « Reprendre » ou P).
  if (!fullscreen.isActive && game.notifyFullscreenExit()) {
    fullscreen.rememberToRestore();
    pauseOverlay.setResumeFullscreen(true);
  }
});

// Menu de test (F2) : seulement avec `npm run dev`. Dans le build, `import.meta.env.DEV` vaut
// false et Vite retire ce code : un joueur ne peut pas l'ouvrir.
const devPanel = import.meta.env.DEV
  ? new DevPanel(getElement('dev-panel', HTMLDivElement))
  : undefined;

/**
 * Lance une partie neuve. "Rejouer" rappelle cette fonction : on recrée une scène entière
 * plutôt que de remettre à zéro l'ancienne, ce qui garantit qu'aucun état ne fuit d'une partie
 * à l'autre (ennemis, timer, PV...). Le perso choisi est gardé pour "Rejouer".
 */
let character: CharacterDef = DEFAULT_CHARACTER;

// Sprites : chargés en arrière-plan pendant que le menu s'affiche (le jeu n'attend pas).
// Une partie lancée avant la fin du chargement, ou une image introuvable : formes simples.
let sprites: SpriteAtlas | null = null;
const spritesLoading = SpriteAtlas.load(ATLAS_URLS.image, ATLAS_URLS.list)
  .then((atlas) => {
    sprites = atlas;
  })
  .catch((error: unknown) => {
    console.warn('Sprites non chargés, formes simples à la place :', error);
  });
let fx: SpriteAtlas | null = null;
const fxLoading = SpriteAtlas.load(FX_ATLAS_URLS.image, FX_ATLAS_URLS.list)
  .then((atlas) => {
    fx = atlas;
  })
  .catch((error: unknown) => {
    console.warn('Effets non chargés, formes simples à la place :', error);
  });
let effects: Record<EffectName, EffectSheet> | null = null;
const effectNames = Object.keys(EFFECT_DIRS) as EffectName[];
const effectsLoading = Promise.all(effectNames.map((name) => EffectSheet.load(EFFECT_DIRS[name])))
  .then((sheets) => {
    effects = Object.fromEntries(effectNames.map((name, i) => [name, sheets[i]])) as Record<
      EffectName,
      EffectSheet
    >;
  })
  .catch((error: unknown) => {
    console.warn('Effets PVFX non chargés, formes simples à la place :', error);
  });
// Barres de PV : pack Dark Ages (ignoré par git). Absent : rectangles, sans bloquer « Jouer ».
let hpBars: HpBarSkin | null = null;
const hpBarsLoading = Promise.all([loadImage(HP_BAR_URLS.frame), loadImage(HP_BAR_URLS.fill)])
  .then(([frame, fill]) => {
    hpBars = { frame, fill };
  })
  .catch((error: unknown) => {
    console.warn('Barres de PV du pack non chargées, rectangles à la place :', error);
  });
// « Jouer » reste grisé jusqu'ici. Chaque chargement attrape déjà son erreur : un fichier manquant
// débloque quand même le bouton (partie en formes simples) au lieu de le griser pour toujours.
let assetsReady = false;
void Promise.allSettled([spritesLoading, fxLoading, effectsLoading, hpBarsLoading]).then(() => {
  assetsReady = true;
});

// Son : bruitages chargés en arrière-plan comme les sprites (un son pas encore prêt est muet),
// musiques chargées au premier besoin. Volumes appliqués par applySettings().
const sfx = new AudioEngine<SfxName>(SFX_COMPRESSOR, {
  sfx: SFX_BASE_VOLUME,
  music: MUSIC_BASE_VOLUME,
});
void sfx.load(SFX_DIR, SFX_EXTENSION, SFX);
const music = sfx.createMusicPlayer(MUSIC, (name) => `${MUSIC_DIR}${name}${MUSIC_EXTENSION}`, {
  fade: MUSIC_FADE,
  duck: MUSIC_PAUSE_DUCK,
});
music.preload('victory');
music.preload('defeat');

/** Le bouton (actif) sous un élément de la page, ou null. */
function buttonOf(target: EventTarget | null): HTMLButtonElement | null {
  const button = target instanceof Element ? target.closest('button') : null;
  return button && !button.disabled ? button : null;
}

// Sons de l'interface pour tous les boutons des menus, écoutés une seule fois sur la page
// (au lieu d'un écouteur par bouton, recréés à chaque affichage des menus).
document.addEventListener('mouseover', (event) => {
  const button = buttonOf(event.target);
  // Passer d'un morceau du bouton à un autre (icône → texte) n'est pas un nouveau survol.
  if (button && button !== buttonOf(event.relatedTarget)) sfx.play('ui-hover');
});
document.addEventListener('click', (event) => {
  const button = buttonOf(event.target);
  // Cartes de level up : le son part dans GameScene (pour que les touches 1-2-3 sonnent aussi).
  if (button && !button.classList.contains('choice')) sfx.play('ui-click');
});

function startRun(chosen: CharacterDef = character): void {
  character = chosen;
  // `>>> 0` : seed entière positive. Une nouvelle seed à chaque partie.
  const seed = Date.now() >>> 0;
  const scene = new GameScene(
    {
      input,
      pauseOverlay,
      optionsOverlay,
      onSettingsChanged,
      endOverlay,
      levelUpOverlay,
      hud,
      debug,
      settings,
      onRestart: () => startRun(),
      onMenu: showMenu,
      onRunEnd,
      devPanel,
      unlocksFor: (report) => newUnlocks(profile, report).map((c) => c.name),
      sprites,
      fx,
      effects,
      hpBars,
      sfx,
      music,
    },
    seed,
    {
      startWeapon: character.weapon,
      shopRanks: profile.shop,
      sprite: CHARACTER_SPRITES[character.id],
    },
  );
  game.setScene(scene);

  // En dev uniquement (absent du build) : la scène est accessible dans la console du navigateur
  // via `__scene`, pour inspecter l'état du jeu pendant le debug.
  if (import.meta.env.DEV) {
    Object.assign(window, { __scene: scene });
  }
}

/** Menu principal. Une scène neuve à chaque fois, comme pour les parties. */
function showMenu(): void {
  game.setScene(
    new MenuScene({
      input,
      menuOverlay,
      optionsOverlay,
      profileOverlay,
      characterOverlay,
      shopOverlay,
      hud,
      settings,
      profile,
      onSettingsChanged,
      onProfileChanged: saveProfile,
      onPlay: startRun,
      sprites: () => sprites,
      music,
      assetsReady: () => assetsReady,
    }),
  );
}

/** Les réglages qui ne sont pas lus en direct par la partie s'appliquent ici. */
function applySettings(): void {
  debug.setFpsCounterVisible(settings.fpsCounter);
  sfx.setVolumes(settings.volumeMaster, settings.volumeMusic, settings.volumeSfx);
}

/** Un réglage vient de changer (écran Options) : on l'applique et on le sauvegarde. */
function onSettingsChanged(): void {
  applySettings();
  store.save(SETTINGS_KEY, serializeSettings(settings));
}

/** Partie terminée (mort ou victoire) : on l'ajoute au profil et on sauvegarde aussitôt. */
function onRunEnd(report: RunReport): void {
  recordRun(profile, report);
  saveProfile();
}

function saveProfile(): void {
  store.save(PROFILE_KEY, serializeProfile(profile));
}

applySettings();
showMenu();
game.start();
