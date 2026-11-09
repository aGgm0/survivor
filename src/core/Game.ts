import type { Renderer } from './Renderer';
import type { Scene } from './Scene';
import type { DebugOverlay } from './DebugOverlay';
import type { Input } from './Input';

/** 60 updates de logique par seconde, quel que soit le FPS de l'écran. */
export const FIXED_STEP = 1 / 60;
/**
 * Limite du temps rattrapé en une frame. Sans ça, après 10 s d'onglet en pause,
 * la boucle voudrait faire 600 updates d'un coup et le jeu gèlerait ("spiral of death").
 */
const MAX_FRAME_TIME = 0.25;

/**
 * Game loop à pas fixe (fixed timestep).
 *
 * requestAnimationFrame appelle `frame()` au rythme de l'écran (60, 144 Hz...).
 * On ajoute le temps écoulé dans un "accumulateur", puis on consomme cet
 * accumulateur par tranches de FIXED_STEP. Résultat : la logique avance toujours
 * par pas identiques, donc le jeu se comporte pareil sur toutes les machines.
 */
export class Game {
  private scene: Scene | null = null;
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  constructor(
    private readonly renderer: Renderer,
    private readonly debug: DebugOverlay,
    private readonly input: Input,
  ) {
    // Onglet caché → on arrête la boucle. Au retour, on repart d'un temps propre
    // pour ne pas "rattraper" les secondes passées ailleurs.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.scene?.onHidden?.();
        this.stop();
      } else {
        this.start();
      }
    });
  }

  setScene(scene: Scene): void {
    this.scene?.exit();
    this.scene = scene;
    scene.enter();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  // Fonction fléchée : `this` reste lié quand rAF l'appelle, sans recréer de closure à chaque frame.
  private readonly frame = (now: number): void => {
    if (!this.running) return;

    const frameTime = Math.min((now - this.lastTime) / 1000, MAX_FRAME_TIME);
    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= FIXED_STEP) {
      this.scene?.update(FIXED_STEP);
      this.input.endUpdate();
      this.debug.countUpdate();
      this.accumulator -= FIXED_STEP;
    }

    // Interpolation : l'accumulateur contient le temps "pas encore simulé".
    // alpha = 0,4 → on est à 40 % du chemin vers la prochaine update, donc on dessine
    // les entités à 40 % entre leur position précédente et l'actuelle. Mouvement fluide à 144/240 Hz.
    const alpha = this.accumulator / FIXED_STEP;

    this.renderer.clear();
    this.scene?.render(this.renderer.ctx, alpha);
    this.debug.countFrame(frameTime);

    requestAnimationFrame(this.frame);
  };
}
