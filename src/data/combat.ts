// Règles de combat générales (voir CLAUDE.md § 5.4).

/** Un coup fait toujours au moins ce montant, même contre beaucoup d'armure. */
export const MIN_DAMAGE = 1;

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
