import { Game } from './core/Game';
import { Renderer } from './core/Renderer';
import { DebugOverlay } from './core/DebugOverlay';
import { DemoScene } from './scenes/DemoScene';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Élément #${id} introuvable`);
  return el;
}

const renderer = new Renderer(getElement('game', HTMLCanvasElement));
const debug = new DebugOverlay(getElement('debug-overlay', HTMLDivElement));
const game = new Game(renderer, debug);

game.setScene(new DemoScene());
game.start();
