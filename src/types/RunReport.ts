// Bilan d'une partie : lu par l'écran de fin, le profil et les défis des persos.
// Calculé par systems/runReport.ts.

/** Une ligne du damage meter. */
export interface WeaponReport {
  /** id de l'arme de base (même mutée) : sert aux statistiques du profil */
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly level: number;
  /** Dégâts utiles infligés, arrondis */
  readonly damage: number;
  readonly kills: number;
  /** Part des dégâts totaux, de 0 à 1 */
  readonly share: number;
}

/** Bilan affiché sur l'écran de fin (victoire ou défaite). */
export interface RunReport {
  readonly victory: boolean;
  /** Vrai si le joueur a continué en mode sans fin après la victoire */
  readonly endless: boolean;
  /** s survécues */
  readonly time: number;
  readonly kills: number;
  /** Or gagné pendant la partie */
  readonly gold: number;
  readonly level: number;
  /** Défis tout-ou-rien réussis pendant la partie (ids, voir data/characters.ts) */
  readonly challenges: readonly string[];
  /** s : moment où le build était complet (tout au max), null s'il ne l'a jamais été */
  readonly maxedAt: number | null;
  /** Armes triées de la plus efficace à la moins efficace */
  readonly weapons: readonly WeaponReport[];
}
