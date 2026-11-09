import { formatTime } from './formatTime';

/** Écran de mort simple (l'écran Game Over complet arrive en Phase 4). */
export class DeathOverlay {
  constructor(
    private readonly el: HTMLElement,
    private readonly infoEl: HTMLElement,
  ) {}

  show(survivedSeconds: number, kills: number): void {
    this.infoEl.textContent = `Survécu ${formatTime(survivedSeconds)} · ${kills} kills`;
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
