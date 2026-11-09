import { formatTime } from './formatTime';

/** HUD en HTML par-dessus le canvas : timer, barre d'XP et niveau. */
export class Hud {
  private shownSeconds = -1;
  private shownLevel = -1;
  /** Largeur de la barre affichée, en dixièmes de % (évite de toucher au DOM pour rien) */
  private shownFill = -1;

  constructor(
    private readonly timerEl: HTMLElement,
    private readonly levelEl: HTMLElement,
    private readonly xpFillEl: HTMLElement,
  ) {}

  setTime(seconds: number): void {
    // On ne touche au DOM que quand la seconde affichée change (1 fois/s au lieu de 240).
    const whole = Math.floor(seconds);
    if (whole === this.shownSeconds) return;
    this.shownSeconds = whole;
    this.timerEl.textContent = formatTime(whole);
  }

  /** `progress` : remplissage de la barre d'XP, de 0 à 1. */
  setProgress(level: number, progress: number): void {
    if (level !== this.shownLevel) {
      this.shownLevel = level;
      this.levelEl.textContent = `Niv ${level}`;
    }
    const fill = Math.round(Math.min(1, Math.max(0, progress)) * 1000);
    if (fill !== this.shownFill) {
      this.shownFill = fill;
      this.xpFillEl.style.width = `${fill / 10}%`;
    }
  }
}
