import { Game } from './core/Game';
import { Renderer } from './core/Renderer';
import { DebugOverlay } from './core/DebugOverlay';
import { Input } from './core/Input';
import { GameScene } from './scenes/GameScene';
import { PauseOverlay } from './ui/PauseOverlay';
import { DeathOverlay } from './ui/DeathOverlay';
import { Hud } from './ui/Hud';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Élément #${id} introuvable`);
  return el;
}

const renderer = new Renderer(getElement('game', HTMLCanvasElement));
const debug = new DebugOverlay(getElement('debug-overlay', HTMLDivElement));
const input = new Input(window);
const pauseOverlay = new PauseOverlay(getElement('pause-overlay', HTMLDivElement));
const deathOverlay = new DeathOverlay(
  getElement('death-overlay', HTMLDivElement),
  getElement('death-time', HTMLParagraphElement),
);
const hud = new Hud(getElement('hud-timer', HTMLDivElement));
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
    { input, pauseOverlay, deathOverlay, hud, debug, onRestart: startRun },
    seed,
  );
  game.setScene(scene);

  // En dev uniquement (absent du build) : la scène est accessible dans la console du navigateur
  // via `__scene`, pour inspecter l'état du jeu pendant le debug.
  if (import.meta.env.DEV) {
    Object.assign(window, { __scene: scene });
  }
}

startRun();
game.start();
