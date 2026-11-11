/** Fréquence de rafraîchissement du texte : modifier le DOM à chaque frame coûte cher pour rien. */
const REFRESH_INTERVAL = 0.5;

/** F3 fait défiler ces modes. Les hitboxes sont à part car leur dessin coûte cher et fausse les FPS. */
const enum DebugMode {
  Off,
  Stats,
  StatsAndHitboxes,
}
const MODE_COUNT = 3;

/**
 * Overlay debug en HTML. F3 : éteint → stats → stats + hitboxes.
 * Affiche FPS (rendu), UPS (updates logiques) et des valeurs libres fournies par le jeu
 * via `setStat` (core/ ne connaît pas le gameplay).
 */
export class DebugOverlay {
  private frames = 0;
  private updates = 0;
  private elapsed = 0;
  private mode = DebugMode.Off;
  private readonly stats = new Map<string, number | string>();

  /**
   * @param fpsEl petit compteur FPS permanent, indépendant de F3 (réglage du joueur).
   */
  constructor(
    private readonly el: HTMLElement,
    private readonly fpsEl: HTMLElement | null = null,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'F3') return;
      // F3 ouvre la recherche dans certains navigateurs : on l'empêche.
      e.preventDefault();
      this.mode = ((this.mode + 1) % MODE_COUNT) as DebugMode;
      this.el.hidden = this.mode === DebugMode.Off;
    });
  }

  /** Vrai quand le jeu doit dessiner les hitboxes (3e mode de F3). */
  get showHitboxes(): boolean {
    return this.mode === DebugMode.StatsAndHitboxes;
  }

  setFpsCounterVisible(visible: boolean): void {
    if (this.fpsEl) this.fpsEl.hidden = !visible;
  }

  /** Valeur affichée sous les FPS. Appelable à chaque frame : seul l'affichage est limité. */
  setStat(label: string, value: number | string): void {
    this.stats.set(label, value);
  }

  countUpdate(): void {
    this.updates++;
  }

  countFrame(frameTime: number): void {
    this.frames++;
    this.elapsed += frameTime;
    if (this.elapsed < REFRESH_INTERVAL) return;

    const fps = Math.round(this.frames / this.elapsed);
    if (this.fpsEl && !this.fpsEl.hidden) this.fpsEl.textContent = `${fps} FPS`;
    if (!this.el.hidden) {
      const ups = Math.round(this.updates / this.elapsed);
      let text = `FPS ${fps}${this.showHitboxes ? ' (hitboxes)' : ''}\nUPS ${ups}`;
      for (const [label, value] of this.stats) text += `\n${label} ${value}`;
      this.el.textContent = text;
    }
    this.frames = 0;
    this.updates = 0;
    this.elapsed = 0;
  }
}
