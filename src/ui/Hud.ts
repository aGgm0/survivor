import { PASSIVES } from '../data/upgrades';
import type { Weapon } from '../entities/Weapon';
import { formatTime } from './formatTime';

/** Éléments du HUD (HTML par-dessus le canvas). */
export interface HudElements {
  /** Conteneur de tout le HUD (pour le masquer d'un coup) */
  root: HTMLElement;
  timer: HTMLElement;
  level: HTMLElement;
  xpFill: HTMLElement;
  hpFill: HTMLElement;
  hpText: HTMLElement;
  kills: HTMLElement;
  /** Rangée des armes possédées */
  weapons: HTMLElement;
  /** Rangée des passifs possédés */
  passives: HTMLElement;
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
  private shownInventoryVersion = -1;
  /** Liste d'armes affichée : une nouvelle partie en crée une nouvelle (voir setInventory). */
  private shownWeapons: readonly Weapon[] | null = null;

  constructor(private readonly el: HudElements) {}

  /** Masqué dans le menu, visible en partie. */
  setVisible(visible: boolean): void {
    this.el.root.hidden = !visible;
  }

  /**
   * Inventaire : une case par arme et par passif, avec son niveau.
   * `version` change à chaque level up : on ne reconstruit les cases que dans ce cas
   * (créer des éléments HTML à chaque frame serait très coûteux).
   */
  setInventory(
    version: number,
    weapons: readonly Weapon[],
    passiveLevels: ReadonlyMap<string, number>,
  ): void {
    // Le HUD sert à toutes les parties : la version seule ne suffit pas (une nouvelle partie
    // repart de 0 et pourrait retomber sur le numéro affiché). La liste d'armes, elle, est
    // neuve à chaque partie.
    if (version === this.shownInventoryVersion && weapons === this.shownWeapons) return;
    this.shownInventoryVersion = version;
    this.shownWeapons = weapons;

    this.el.weapons.replaceChildren(
      ...weapons.map((w) => {
        const box = slot(w.short, w.level, `${w.displayName} — niv ${w.level}`, w.color);
        // Arme mutée : étoile à la place du niveau (elle est au max) et bordure dorée.
        if (w.mutation) {
          box.classList.add('slot-mutated');
          const lvl = box.querySelector('.slot-level');
          if (lvl) lvl.textContent = '★';
        }
        return box;
      }),
    );
    const owned = PASSIVES.filter((p) => (passiveLevels.get(p.id) ?? 0) > 0);
    this.el.passives.replaceChildren(
      ...owned.map((p) => {
        const level = passiveLevels.get(p.id) ?? 0;
        return slot(p.short, level, `${p.name} — niv ${level}`, null);
      }),
    );
  }

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

/** Une case d'inventaire : 2 lettres, le niveau en petit, et le nom complet au survol. */
function slot(short: string, level: number, tooltip: string, color: string | null): HTMLElement {
  const box = document.createElement('div');
  box.className = color ? 'slot slot-weapon' : 'slot';
  box.title = tooltip;
  if (color) box.style.borderColor = color;
  const label = document.createElement('span');
  label.className = 'slot-label';
  label.textContent = short;
  if (color) label.style.color = color;
  const lvl = document.createElement('span');
  lvl.className = 'slot-level';
  lvl.textContent = String(level);
  box.append(label, lvl);
  return box;
}

function toTenthsOfPercent(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 1000);
}
