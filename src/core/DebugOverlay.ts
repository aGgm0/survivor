/** Fréquence de rafraîchissement du texte : modifier le DOM à chaque frame coûte cher pour rien. */
const REFRESH_INTERVAL = 0.5;

/**
 * Overlay debug en HTML, affiché/caché avec F3. Affiche FPS (rendu), UPS (updates logiques)
 * et des valeurs libres fournies par le jeu via `setStat` (core/ ne connaît pas le gameplay).
 */
export class DebugOverlay {
  private frames = 0;
  private updates = 0;
  private elapsed = 0;
  private readonly stats = new Map<string, number | string>();

  constructor(private readonly el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'F3') return;
      // F3 ouvre la recherche dans certains navigateurs : on l'empêche.
      e.preventDefault();
      this.el.hidden = !this.el.hidden;
    });
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

    if (!this.el.hidden) {
      const fps = Math.round(this.frames / this.elapsed);
      const ups = Math.round(this.updates / this.elapsed);
      let text = `FPS ${fps}\nUPS ${ups}`;
      for (const [label, value] of this.stats) text += `\n${label} ${value}`;
      this.el.textContent = text;
    }
    this.frames = 0;
    this.updates = 0;
    this.elapsed = 0;
  }
}
