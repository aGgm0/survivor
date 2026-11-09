// Niveaux et level up (voir CLAUDE.md § 5.6).

/** s : survivre jusque-là = victoire (10 min pour le MVP) */
export const RUN_DURATION = 600;

/** XP nécessaire pour passer du niveau `level` au suivant. TODO : à équilibrer en jouant. */
export function xpToNext(level: number): number {
  return 5 + level * 10;
}

/** Nombre de choix proposés à chaque level up */
export const UPGRADE_CHOICE_COUNT = 3;

/**
 * Tant que le joueur a moins d'armes que ça, au moins un des choix est une nouvelle arme
 * (s'il en reste à débloquer). Sinon on peut enchaîner les passifs et rester coincé avec une
 * seule arme, trop faible face à la horde.
 */
export const NEW_WEAPON_GUARANTEE_BELOW = 3;

/** Armes maximum en même temps (le brief prévoit 6). */
export const MAX_WEAPONS = 6;
