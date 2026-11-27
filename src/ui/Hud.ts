import { DAMAGE_TYPE_NAMES, DAMAGE_TYPES, RESIST_ICONS } from '../data/combat';
import type { Resistances } from '../data/enemies';
import { PASSIVES } from '../data/upgrades';
import type { Weapon } from '../entities/Weapon';
import { formatTime } from './formatTime';
import { iconElement } from './icons';
import { formatNumber } from './formatNumber';

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
  /** Mention "SANS FIN" (mode sans fin) */
  endless: HTMLElement;
  /** Or gagné pendant la partie */
  gold: HTMLElement;
  /** Badge "TEST" (menu de test utilisé : partie non enregistrée) */
  test: HTMLElement;
  /** Rangée des armes possédées */
  weapons: HTMLElement;
  /** Rangée des passifs possédés */
  passives: HTMLElement;
  /** Grande barre du boss en haut de l'écran : conteneur, remplissage, traînée */
  boss: HTMLElement;
  bossFill: HTMLElement;
  bossTrail: HTMLElement;
  /** Boucliers des résistances du boss, à droite de sa barre */
  bossResist: HTMLElement;
  /** Contour rouge des PV bas */
  lowHp: HTMLElement;
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
  private shownGold = -1;
  private shownInventoryVersion = -1;
  private shownBossFill = -1;
  private shownBossTrail = -1;
  private shownLowHp: 'none' | 'warn' | 'critical' = 'none';
  private shownLowHpPulse = true;
  /** Liste d'armes affichée : une nouvelle partie en crée une nouvelle (voir setInventory). */
  private shownWeapons: readonly Weapon[] | null = null;
  /** Résistances affichées à côté de la barre du boss (null : rien encore) */
  private shownBossResist: Resistances | undefined | null = null;

  constructor(private readonly el: HudElements) {}

  setEndless(endless: boolean): void {
    this.el.endless.hidden = !endless;
  }

  setGold(gold: number): void {
    if (gold === this.shownGold) return;
    this.shownGold = gold;
    this.el.gold.textContent = `${formatNumber(gold)} or`;
  }

  setTest(test: boolean): void {
    this.el.test.hidden = !test;
  }

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
        const icon = w.mutation?.id ?? w.def.id;
        const type = DAMAGE_TYPE_NAMES[w.damageType];
        const box = slot(
          icon,
          w.short,
          w.level,
          `${w.displayName} (${type}) — niv ${w.level}`,
          w.color,
        );
        // Coin coloré du type de dégâts : on voit d'un coup d'œil si le build est d'un seul type.
        box.classList.add(`slot-${w.damageType}`);
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
        return slot(p.id, p.short, level, `${p.name} — niv ${level}`, null);
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
      // Gain d'XP (pas le retour à 0 du level up) : flash bref de la barre. Retirer puis remettre
      // la classe relance l'animation ; la lecture de offsetWidth force le navigateur à voir le retrait.
      if (this.shownXpFill >= 0 && fill > this.shownXpFill) {
        this.el.xpFill.classList.remove('xp-gain');
        void this.el.xpFill.offsetWidth;
        this.el.xpFill.classList.add('xp-gain');
      }
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

  /**
   * Grande barre du boss (`hpRatio` null : aucun boss en vie, barre masquée). Elle reste lisible
   * quand le boss est hors de l'écran, pendant une charge par exemple.
   */
  setBoss(hpRatio: number | null, trailRatio: number, resistances?: Resistances): void {
    const visible = hpRatio !== null;
    if (this.el.boss.hidden === visible) this.el.boss.hidden = !visible;
    if (!visible) return;
    // Les boucliers ne changent qu'avec le type du boss : reconstruits seulement dans ce cas.
    if (resistances !== this.shownBossResist) {
      this.shownBossResist = resistances;
      this.el.bossResist.replaceChildren(...resistBadges(resistances));
    }
    const fill = toTenthsOfPercent(hpRatio);
    if (fill !== this.shownBossFill) {
      this.shownBossFill = fill;
      this.el.bossFill.style.width = `${fill / 10}%`;
    }
    const trail = toTenthsOfPercent(trailRatio);
    if (trail !== this.shownBossTrail) {
      this.shownBossTrail = trail;
      this.el.bossTrail.style.width = `${trail / 10}%`;
    }
  }

  /** Contour rouge selon la part de PV restante ; `pulse` faux : contour fixe (effets réduits). */
  setLowHp(level: 'none' | 'warn' | 'critical', pulse: boolean): void {
    if (level === this.shownLowHp && pulse === this.shownLowHpPulse) return;
    this.shownLowHp = level;
    this.shownLowHpPulse = pulse;
    const c = this.el.lowHp.classList;
    c.toggle('low-warn', level === 'warn');
    c.toggle('low-critical', level === 'critical');
    c.toggle('low-static', !pulse);
  }

  setKills(kills: number): void {
    if (kills === this.shownKills) return;
    this.shownKills = kills;
    this.el.kills.textContent = `${formatNumber(kills)} kills`;
  }
}

/**
 * Une case d'inventaire : l'icône (ou les 2 lettres si elle manque), le niveau en petit, et le
 * nom complet au survol.
 */
function slot(
  icon: string,
  short: string,
  level: number,
  tooltip: string,
  color: string | null,
): HTMLElement {
  const box = document.createElement('div');
  box.className = color ? 'slot slot-weapon' : 'slot';
  box.title = tooltip;
  if (color) box.style.borderColor = color;
  const label = document.createElement('span');
  label.className = 'slot-label';
  label.append(iconElement(icon, short));
  if (color) label.style.color = color;
  const lvl = document.createElement('span');
  lvl.className = 'slot-level';
  lvl.textContent = String(level);
  box.append(label, lvl);
  return box;
}

/**
 * Un bouclier par type de dégâts auquel l'ennemi résiste, avec sa valeur (gris : armure
 * physique, bleu : résistance magique). Rien pour un type à 0.
 */
function resistBadges(resistances: Resistances | undefined): HTMLElement[] {
  const badges: HTMLElement[] = [];
  for (const type of DAMAGE_TYPES) {
    const value = resistances?.[type] ?? 0;
    if (value <= 0) continue;
    const badge = document.createElement('span');
    badge.className = `resist-badge resist-${type}`;
    badge.title = `${type === 'physical' ? 'Armure physique' : 'Résistance magique'} ${value}`;
    const text = document.createElement('span');
    text.textContent = String(value);
    badge.append(iconElement(RESIST_ICONS[type], type === 'physical' ? 'AP' : 'RM'), text);
    badges.push(badge);
  }
  return badges;
}

function toTenthsOfPercent(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 1000);
}
