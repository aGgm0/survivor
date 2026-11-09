import { formatTime } from './formatTime';

/** Écran de mort simple (l'écran Game Over complet arrive en Phase 4). */
export class DeathOverlay {
  constructor(
    private readonly el: HTMLElement,
    private readonly timeEl: HTMLElement,
  ) {}

  show(survivedSeconds: number): void {
    this.timeEl.textContent = `Survécu ${formatTime(survivedSeconds)}`;
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
