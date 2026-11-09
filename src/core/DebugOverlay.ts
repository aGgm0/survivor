/** Fréquence de rafraîchissement du texte : modifier le DOM à chaque frame coûte cher pour rien. */
const REFRESH_INTERVAL = 0.5;

/** Overlay debug en HTML, affiché/caché avec F3. Affiche FPS (rendu) et UPS (updates logiques). */
export class DebugOverlay {
  private frames = 0;
  private updates = 0;
  private elapsed = 0;

  constructor(private readonly el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'F3') return;
      // F3 ouvre la recherche dans certains navigateurs : on l'empêche.
      e.preventDefault();
      this.el.hidden = !this.el.hidden;
    });
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
      this.el.textContent = `FPS ${fps}\nUPS ${ups}`;
    }
    this.frames = 0;
    this.updates = 0;
    this.elapsed = 0;
  }
}
