// Bilan d'une partie : lu par l'écran de fin, le profil et les défis des persos.
// Calculé par systems/runReport.ts.

/** Une ligne du damage meter. */
export interface WeaponReport {
  /** id de l'arme de base (même mutée) : sert aux statistiques du profil */
  readonly id: string;
  readonly name: string;
  /** Icône à afficher : celle de la mutation si l'arme est mutée (comme dans le HUD) */
  readonly icon: string;
  /** 2 lettres affichées à la place de l'icône si elle manque (pack Raven absent) */
  readonly short: string;
  readonly color: string;
  readonly level: number;
  /** Dégâts utiles infligés, arrondis */
  readonly damage: number;
  readonly kills: number;
  /** Part des dégâts totaux, de 0 à 1 */
  readonly share: number;
}

/** Un passif du build en fin de partie. */
export interface PassiveReport {
  readonly id: string;
  readonly level: number;
}

/** Bilan affiché sur l'écran de fin (victoire ou défaite). */
export interface RunReport {
  /** id du perso joué (data/characters.ts) ; '' si inconnu (tests, bot) */
  readonly character: string;
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
  /** Passifs du build (niveau > 0), dans l'ordre de data/upgrades.ts */
  readonly passives: readonly PassiveReport[];
}
