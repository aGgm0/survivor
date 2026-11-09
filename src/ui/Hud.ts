import { formatTime } from './formatTime';

/** HUD en HTML par-dessus le canvas. Pour l'instant : le timer de survie. */
export class Hud {
  private shownSeconds = -1;

  constructor(private readonly timerEl: HTMLElement) {}

  setTime(seconds: number): void {
    // On ne touche au DOM que quand la seconde affichée change (1 fois/s au lieu de 240).
    const whole = Math.floor(seconds);
    if (whole === this.shownSeconds) return;
    this.shownSeconds = whole;
    this.timerEl.textContent = formatTime(whole);
  }
}
