import type { Weapon } from '../entities/Weapon';

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
  readonly level: number;
  /** s : moment où le build était complet (tout au max), null s'il ne l'a jamais été */
  readonly maxedAt: number | null;
  /** Armes triées de la plus efficace à la moins efficace */
  readonly weapons: readonly WeaponReport[];
}

/**
 * Le "damage meter" : chaque arme avec ses dégâts, ses kills et sa part du total,
 * triées par dégâts décroissants. Calculé une seule fois, à la fin de la partie.
 */
export function buildDamageReport(weapons: readonly Weapon[]): WeaponReport[] {
  const total = weapons.reduce((sum, w) => sum + w.totalDamage, 0);
  return weapons
    .map((w) => ({
      id: w.def.id,
      name: w.mutation ? `★ ${w.displayName}` : w.displayName,
      color: w.color,
      level: w.level,
      damage: Math.round(w.totalDamage),
      kills: w.kills,
      share: total > 0 ? w.totalDamage / total : 0,
    }))
    .sort((a, b) => b.damage - a.damage);
}
