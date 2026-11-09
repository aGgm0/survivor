// Niveaux et level up (voir CLAUDE.md § 5.6).

/** XP nécessaire pour passer du niveau `level` au suivant. TODO : à équilibrer en jouant. */
export function xpToNext(level: number): number {
  return 5 + level * 10;
}

/** Nombre de choix proposés à chaque level up */
export const UPGRADE_CHOICE_COUNT = 3;
