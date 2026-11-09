import { formatTime } from './formatTime';

/** Éléments du HUD (HTML par-dessus le canvas). */
export interface HudElements {
  timer: HTMLElement;
  level: HTMLElement;
  xpFill: HTMLElement;
  hpFill: HTMLElement;
  hpText: HTMLElement;
  kills: HTMLElement;
}

/**
 * HUD : timer, niveau + barre d'XP, PV, kills.
 * Appelé à chaque frame de rendu, mais ne touche au DOM que quand une valeur affichée change :
 * modifier le DOM 240 fois par seconde pour afficher la même chose coûte cher pour rien.
 */
export class Hud {
  private shownSeconds = -1;
  private shownLevel = -1;
  /** Largeurs des barres affichées, en dixièmes de % */
  private shownXpFill = -1;
  private shownHpFill = -1;
  private shownHp = -1;
  private shownMaxHp = -1;
  private shownKills = -1;

  constructor(private readonly el: HudElements) {}

  setTime(seconds: number): void {
    const whole = Math.floor(seconds);
    if (whole === this.shownSeconds) return;
    this.shownSeconds = whole;
    this.el.timer.textContent = formatTime(whole);
  }

  /** `progress` : remplissage de la barre d'XP, de 0 à 1. */
  setProgress(level: number, progress: number): void {
    if (level !== this.shownLevel) {
      this.shownLevel = level;
      this.el.level.textContent = `Niv ${level}`;
    }
    const fill = toTenthsOfPercent(progress);
    if (fill !== this.shownXpFill) {
      this.shownXpFill = fill;
      this.el.xpFill.style.width = `${fill / 10}%`;
    }
  }

  setHp(hp: number, maxHp: number): void {
    // Arrondi au PV supérieur : on n'affiche jamais "0" tant que le joueur est en vie.
    const shown = Math.ceil(Math.max(0, hp));
    if (shown !== this.shownHp || maxHp !== this.shownMaxHp) {
      this.shownHp = shown;
      this.shownMaxHp = maxHp;
      this.el.hpText.textContent = `${shown} / ${Math.round(maxHp)}`;
    }
    const fill = toTenthsOfPercent(hp / maxHp);
    if (fill !== this.shownHpFill) {
      this.shownHpFill = fill;
      this.el.hpFill.style.width = `${fill / 10}%`;
    }
  }

  setKills(kills: number): void {
    if (kills === this.shownKills) return;
    this.shownKills = kills;
    this.el.kills.textContent = `${kills} kills`;
  }
}

function toTenthsOfPercent(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 1000);
}
