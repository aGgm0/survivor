// Règles de combat générales (voir CLAUDE.md § 5.4).

/**
 * Multiplicateur de dégâts de TOUTES les armes (un seul réglage, comme le recul). 1 → 1,15
 * (2026-11-21) : les parties en retard d'XP, sans mutation, mouraient toutes vers 6:00. Un buff
 * des dégâts de base aide surtout celles-là, contrairement à un buff des niveaux d'armes.
 */
export const WEAPON_DAMAGE_MULT = 1.15;

/** Un coup fait toujours au moins ce montant, même contre beaucoup d'armure. */
export const MIN_DAMAGE = 1;

/**
 * Type de dégâts d'une arme. Chaque ennemi résiste plus ou moins à chacun (`resistances` dans
 * enemies.ts) : un build d'un seul type bute sur les ennemis qui y résistent.
 */
export type DamageType = 'physical' | 'magical';

/** Ordre d'affichage des types (boucliers des barres de PV) */
export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'magical'];

/** Icône de résistance de chaque type (pack Raven, voir tools/ui/raven-icons.mjs) */
export const RESIST_ICONS: Readonly<Record<DamageType, string>> = {
  physical: 'armor-physical',
  magical: 'armor-magical',
};

/** Noms affichés des types de dégâts */
export const DAMAGE_TYPE_NAMES: Readonly<Record<DamageType, string>> = {
  physical: 'Physique',
  magical: 'Magique',
};

/**
 * Valeur de résistance qui réduit les dégâts de moitié. Réduction = A / (A + RESIST_HALF) :
 * 25 → 20 %, 50 → 33 %, 100 → 50 %. Jamais 100 % : aucune immunité, quelle que soit la valeur.
 */
export const RESIST_HALF = 100;

/**
 * Part des dégâts retirée par une résistance, après la pénétration de l'arme. Une pénétration
 * plus forte que la résistance ne fait PAS plus de dégâts (sinon un passif au max deviendrait
 * un bonus de dégâts déguisé).
 */
export function resistReduction(resistance: number, penetration: number): number {
  const a = Math.max(0, resistance - penetration);
  return a / (a + RESIST_HALF);
}

/**
 * Dégâts réellement subis : l'armure retire un montant fixe, mais un coup fait toujours
 * au moins MIN_DAMAGE (sinon 3 points d'armure rendraient immunisé aux ennemis rapides).
 */
export function computeDamage(raw: number, armor: number): number {
  return Math.max(MIN_DAMAGE, raw - armor);
}

/**
 * s : un même ennemi ne peut toucher le joueur qu'une fois par cette durée. Chaque ennemi a son
 * propre délai (pas d'invincibilité globale) : plus il y a d'ennemis au contact, plus ça fait mal.
 */
export const CONTACT_HIT_COOLDOWN = 0.7;

/**
 * Recul : la force de recul d'une arme (px/s) vaut pour un ennemi "de référence" (le basique).
 * Elle est multipliée par (masse de référence / masse de l'ennemi) : un tank recule ~3× moins,
 * le boss ~12× moins. Sans ça, les orbes rendraient le boss inoffensif.
 */
export const KNOCKBACK = {
  /** px : rayon de l'ennemi de référence (basique) */
  referenceRadius: 14,
  /** Plafond du multiplicateur pour les ennemis plus légers que la référence (rapides) */
  maxFactor: 1.5,
  /**
   * Multiplicateur global de toutes les forces de recul (armes, mutations, Impact compris).
   * 1 → 1,2 : le recul ne se sentait pas (≈ 5 px pour un basique touché par le Trait, ≈ 10 px
   * maintenant : la distance grandit avec le carré de la vitesse qui reste après le coup).
   */
  forceMult: 1.2,
} as const;
