import { formatTime } from './formatTime';

/** HUD en HTML par-dessus le canvas : timer de survie et XP (temporaire, en attendant la barre de la Phase 4). */
export class Hud {
  private shownSeconds = -1;
  private shownXp = -1;

  constructor(
    private readonly timerEl: HTMLElement,
    private readonly xpEl: HTMLElement,
  ) {}

  setTime(seconds: number): void {
    // On ne touche au DOM que quand la seconde affichée change (1 fois/s au lieu de 240).
    const whole = Math.floor(seconds);
    if (whole === this.shownSeconds) return;
    this.shownSeconds = whole;
    this.timerEl.textContent = formatTime(whole);
  }

  setXp(xp: number): void {
    // L'XP peut avoir des demi-points (gemmes déplacées) : on affiche la partie entière.
    const whole = Math.floor(xp);
    if (whole === this.shownXp) return;
    this.shownXp = whole;
    this.xpEl.textContent = `XP ${whole}`;
  }
}
