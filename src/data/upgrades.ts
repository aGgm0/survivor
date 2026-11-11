// Upgrades passifs (voir CLAUDE.md § 5.6). Data-driven : ajouter un passif = ajouter une entrée.

/** Stat du joueur modifiée par un passif. */
export type PassiveStat =
  | 'maxHp'
  | 'speedPct'
  | 'pickupPct'
  | 'damagePct'
  | 'cooldownPct'
  | 'knockbackPct'
  | 'sizePct'
  | 'velocityPct'
  | 'extraCount';

export interface PassiveDef {
  readonly id: string;
  readonly name: string;
  /** 2 lettres affichées dans la case de l'inventaire du HUD (en attendant de vraies icônes) */
  readonly short: string;
  /** Texte affiché sur l'écran de level up (effet d'un niveau) */
  readonly description: string;
  readonly maxLevel: number;
  readonly stat: PassiveStat;
  /**
   * Gain par niveau. Pour les `...Pct`, en fraction de la valeur de base
   * (0.08 = +8 % de la vitesse de départ à chaque niveau).
   */
  readonly amount: number;
}

export const PASSIVES: readonly PassiveDef[] = [
  {
    id: 'vitality',
    name: 'Vitalité',
    short: 'Vi',
    description: '+20 PV max (et soigne 20)',
    maxLevel: 5,
    stat: 'maxHp',
    amount: 20,
  },
  {
    id: 'swiftness',
    name: 'Célérité',
    short: 'Cé',
    description: '+8 % vitesse',
    maxLevel: 5,
    stat: 'speedPct',
    amount: 0.08,
  },
  {
    id: 'attraction',
    name: 'Attraction',
    short: 'At',
    description: "+30 % rayon d'aimant",
    maxLevel: 5,
    stat: 'pickupPct',
    amount: 0.3,
  },
  {
    id: 'power',
    name: 'Puissance',
    short: 'Pu',
    description: '+10 % dégâts (toutes armes)',
    maxLevel: 5,
    stat: 'damagePct',
    amount: 0.1,
  },
  {
    id: 'haste',
    name: 'Hâte',
    short: 'Hâ',
    description: '-8 % cooldown (toutes armes)',
    maxLevel: 5,
    stat: 'cooldownPct',
    amount: 0.08,
  },
  {
    id: 'impact',
    name: 'Impact',
    short: 'Im',
    description: '+8 % recul (toutes armes)',
    maxLevel: 5,
    stat: 'knockbackPct',
    // 25 % → 8 % : +125 % au niveau 5 repoussait la horde hors de portée. Recul de base +15 %.
    amount: 0.08,
  },
  {
    id: 'size',
    name: 'Taille',
    short: 'Ta',
    description: '+7 % taille des projectiles, orbes, aura et explosions',
    maxLevel: 5,
    stat: 'sizePct',
    // 7 % (pas 10) : sur l'aura, ça se cumule avec le Brasier (×1,6).
    amount: 0.07,
  },
  {
    id: 'velocity',
    name: 'Vélocité',
    short: 'Vé',
    description: '+10 % vitesse des projectiles (et portée) et rotation des orbes',
    maxLevel: 5,
    stat: 'velocityPct',
    amount: 0.1,
  },
  {
    id: 'duplicator',
    name: 'Duplicateur',
    short: 'Du',
    description: '+1 projectile et +1 orbe',
    // Le plus fort des passifs : seulement 3 niveaux (Tempête : 9 + 3 = 12 orbes, le maximum).
    maxLevel: 3,
    stat: 'extraCount',
    amount: 1,
  },
];

/**
 * Part du bonus de Taille appliquée à la distance des orbes : 0,3 → au niveau 5 (+35 % de taille),
 * l'orbite s'éloigne de +10,5 % (105 → ~116 px). Demandé : "légèrement, mais un peu quand même".
 */
export const SIZE_ORBIT_SHARE = 0.3;

/** Choix de secours quand tout est au maximum : un level up n'est jamais vide. */
export const HEAL_UPGRADE = {
  name: 'Soin',
  description: '+30 PV',
  amount: 30,
} as const;
