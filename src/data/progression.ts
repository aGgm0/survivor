// Niveaux et level up (voir CLAUDE.md § 5.6).

/** s : survivre jusque-là = victoire (10 min pour le MVP) */
export const RUN_DURATION = 600;

/**
 * Courbe d'XP : `base + niveau × perLevel`, plus un terme qui grandit au carré après `steepFrom`.
 * Historique : × 10 → × 7 ("l'XP monte trop lentement" au début), puis terme au carré
 * (build complet atteint avant le boss de 9:00, surtout avec 4 passifs max) : 0,6, puis 0,75
 * (build complet à 08:44 et XP en plus des vagues bonus).
 */
export const XP_CURVE = {
  base: 5,
  perLevel: 7,
  /** Les niveaux jusqu'à celui-ci gardent l'ancienne courbe : le début de partie ne change pas */
  steepFrom: 10,
  /** XP en plus par (niveau − steepFrom)² */
  steepFactor: 0.75,
} as const;

/** XP nécessaire pour passer du niveau `level` au suivant (entier). */
export function xpToNext(level: number): number {
  const over = Math.max(0, level - XP_CURVE.steepFrom);
  return Math.round(XP_CURVE.base + level * XP_CURVE.perLevel + XP_CURVE.steepFactor * over * over);
}

/**
 * Quand tout est au maximum (armes, mutations, passifs), il faut ×4 d'XP par niveau :
 * ces level up ne donnent plus qu'un soin, et en enchaîner rendait le joueur intuable.
 */
export const MAXED_XP_MULT = 4;

/** Relances des cartes de level up par partie (la boutique pourra en ajouter) */
export const REROLLS_PER_RUN = 2;

/** Nombre de choix proposés à chaque level up */
export const UPGRADE_CHOICE_COUNT = 3;

/**
 * Tant que le joueur a moins d'armes que ça, au moins un des choix est une nouvelle arme
 * (s'il en reste à débloquer). Sinon on peut enchaîner les passifs et rester coincé avec une
 * seule arme, trop faible face à la horde.
 */
export const NEW_WEAPON_GUARANTEE_BELOW = 3;

/**
 * Emplacements : armes et passifs maximum en même temps. Une fois pleins, seuls ceux déjà
 * possédés peuvent encore monter de niveau : il faut choisir son build.
 */
export const MAX_WEAPONS = 4;
export const MAX_PASSIVES = 4;
