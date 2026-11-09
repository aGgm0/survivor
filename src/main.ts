import { Game } from './core/Game';
import { Renderer } from './core/Renderer';
import { DebugOverlay } from './core/DebugOverlay';
import { Input } from './core/Input';
import { GameScene } from './scenes/GameScene';
import { PauseOverlay } from './ui/PauseOverlay';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Élément #${id} introuvable`);
  return el;
}

const renderer = new Renderer(getElement('game', HTMLCanvasElement));
const debug = new DebugOverlay(getElement('debug-overlay', HTMLDivElement));
const input = new Input(window);
const pauseOverlay = new PauseOverlay(getElement('pause-overlay', HTMLDivElement));
const game = new Game(renderer, debug, input);

game.setScene(new GameScene(input, pauseOverlay));
game.start();
