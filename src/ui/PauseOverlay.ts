/** Écran "PAUSE" en HTML par-dessus le canvas. */
export class PauseOverlay {
  constructor(private readonly el: HTMLElement) {}

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }
}
