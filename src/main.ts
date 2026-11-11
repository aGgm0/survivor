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

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Élément #${id} introuvable`);
  return el;
}

const renderer = new Renderer(getElement('game', HTMLCanvasElement));
const debug = new DebugOverlay(getElement('debug-overlay', HTMLDivElement));
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
);
const levelUpOverlay = new LevelUpOverlay(
  getElement('levelup-overlay', HTMLDivElement),
  getElement('levelup-title', HTMLParagraphElement),
  getElement('levelup-choices', HTMLDivElement),
);
const menuOverlay = new MenuOverlay(
  getElement('menu-overlay', HTMLDivElement),
  getElement('menu-play', HTMLButtonElement),
);
const hud = new Hud({
  root: getElement('hud', HTMLDivElement),
  timer: getElement('hud-timer', HTMLDivElement),
  level: getElement('hud-level', HTMLDivElement),
  xpFill: getElement('hud-xpfill', HTMLDivElement),
  hpFill: getElement('hud-hpfill', HTMLDivElement),
  hpText: getElement('hud-hptext', HTMLSpanElement),
  kills: getElement('hud-kills', HTMLDivElement),
  weapons: getElement('hud-weapons', HTMLDivElement),
  passives: getElement('hud-passives', HTMLDivElement),
});
const game = new Game(renderer, debug, input);

/**
 * Lance une partie neuve. "Rejouer" rappelle cette fonction : on recrée une scène entière
 * plutôt que de remettre à zéro l'ancienne, ce qui garantit qu'aucun état ne fuit d'une partie
 * à l'autre (ennemis, timer, PV...).
 */
function startRun(): void {
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
      onRestart: startRun,
      onMenu: showMenu,
    },
    seed,
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
  game.setScene(new MenuScene({ input, menuOverlay, hud, onPlay: startRun }));
}

showMenu();
game.start();
