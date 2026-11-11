import { Game } from './core/Game';
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
import { CharacterOverlay } from './ui/CharacterOverlay';
import { DEFAULT_CHARACTER, newUnlocks, type CharacterDef } from './data/characters';
import type { RunReport } from './systems/runReport';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Élément #${id} introuvable`);
  return el;
}

// Réglages : lus une fois au lancement (sauvegarde validée champ par champ), puis partagés.
const store = SaveStore.fromBrowser();
const settings = parseSettings(store.load(SETTINGS_KEY));
const profile = parseProfile(store.load(PROFILE_KEY));

const renderer = new Renderer(getElement('game', HTMLCanvasElement));
const debug = new DebugOverlay(
  getElement('debug-overlay', HTMLDivElement),
  getElement('fps-counter', HTMLDivElement),
);
const input = new Input(window);
const pauseOverlay = new PauseOverlay(getElement('pause-overlay', HTMLDivElement), {
  resume: getElement('pause-resume', HTMLButtonElement),
  restart: getElement('pause-restart', HTMLButtonElement),
  menu: getElement('pause-menu', HTMLButtonElement),
});
const endOverlay = new EndOverlay(
  getElement('end-overlay', HTMLDivElement),
  getElement('end-title', HTMLParagraphElement),
  getElement('end-info', HTMLParagraphElement),
  getElement('end-meter', HTMLDivElement),
  getElement('end-hint', HTMLParagraphElement),
  getElement('end-unlocks', HTMLParagraphElement),
);
const levelUpOverlay = new LevelUpOverlay(
  getElement('levelup-overlay', HTMLDivElement),
  getElement('levelup-title', HTMLParagraphElement),
  getElement('levelup-choices', HTMLDivElement),
);
const menuOverlay = new MenuOverlay(getElement('menu-overlay', HTMLDivElement), {
  play: getElement('menu-play', HTMLButtonElement),
  options: getElement('menu-options', HTMLButtonElement),
  profile: getElement('menu-profile', HTMLButtonElement),
});
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
const optionsOverlay = new OptionsOverlay(
  getElement('options-overlay', HTMLDivElement),
  getElement('options-list', HTMLDivElement),
  getElement('options-back', HTMLButtonElement),
);
const hud = new Hud({
  root: getElement('hud', HTMLDivElement),
  timer: getElement('hud-timer', HTMLDivElement),
  level: getElement('hud-level', HTMLDivElement),
  xpFill: getElement('hud-xpfill', HTMLDivElement),
  hpFill: getElement('hud-hpfill', HTMLDivElement),
  hpText: getElement('hud-hptext', HTMLSpanElement),
  kills: getElement('hud-kills', HTMLDivElement),
  endless: getElement('hud-endless', HTMLDivElement),
  weapons: getElement('hud-weapons', HTMLDivElement),
  passives: getElement('hud-passives', HTMLDivElement),
});
const game = new Game(renderer, debug, input);

/**
 * Lance une partie neuve. "Rejouer" rappelle cette fonction : on recrée une scène entière
 * plutôt que de remettre à zéro l'ancienne, ce qui garantit qu'aucun état ne fuit d'une partie
 * à l'autre (ennemis, timer, PV...). Le perso choisi est gardé pour "Rejouer".
 */
let character: CharacterDef = DEFAULT_CHARACTER;

function startRun(chosen: CharacterDef = character): void {
  character = chosen;
  // `>>> 0` : seed entière positive. Une nouvelle seed à chaque partie.
  const seed = Date.now() >>> 0;
  const scene = new GameScene(
    {
      input,
      pauseOverlay,
      endOverlay,
      levelUpOverlay,
      hud,
      debug,
      settings,
      onRestart: () => startRun(),
      onMenu: showMenu,
      onRunEnd,
      unlocksFor: (report) => newUnlocks(profile, report).map((c) => c.name),
    },
    seed,
    { startWeapon: character.weapon },
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
      hud,
      settings,
      profile,
      onSettingsChanged,
      onPlay: startRun,
    }),
  );
}

/** Les réglages qui ne sont pas lus en direct par la partie s'appliquent ici. */
function applySettings(): void {
  debug.setFpsCounterVisible(settings.fpsCounter);
}

/** Un réglage vient de changer (écran Options) : on l'applique et on le sauvegarde. */
function onSettingsChanged(): void {
  applySettings();
  store.save(SETTINGS_KEY, serializeSettings(settings));
}

/** Partie terminée (mort ou victoire) : on l'ajoute au profil et on sauvegarde aussitôt. */
function onRunEnd(report: RunReport): void {
  recordRun(profile, report);
  store.save(PROFILE_KEY, serializeProfile(profile));
}

applySettings();
showMenu();
game.start();
