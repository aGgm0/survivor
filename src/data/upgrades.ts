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
  /** PV/s de régénération en plus à chaque niveau (Vitalité : les PV max seuls ne soignaient pas) */
  readonly regenPerLevel?: number;
}

export const PASSIVES: readonly PassiveDef[] = [
  {
    id: 'vitality',
    name: 'Vitalité',
    short: 'Vi',
    description: '+15 PV max (et soigne 15), +0,3 PV/s',
    maxLevel: 5,
    stat: 'maxHp',
    amount: 15,
    regenPerLevel: 0.3,
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
    description: '+4 % taille des projectiles, orbes, aura et explosions',
    maxLevel: 5,
    stat: 'sizePct',
    // 7 % → 4 % : gros nerf (retour de jeu). Sur l'aura, ça se cumule avec l'Aura de givre (×1,4).
    amount: 0.04,
  },
  {
    id: 'velocity',
    name: 'Vélocité',
    short: 'Vé',
    description: '+5 % vitesse des projectiles (et portée) et rotation des orbes',
    maxLevel: 5,
    stat: 'velocityPct',
    amount: 0.05, // 10 % → 5 % : gros nerf (retour de jeu)
  },
  {
    id: 'duplicator',
    name: 'Duplicateur',
    short: 'Du',
    description: "+1 projectile et +1 orbe (pas l'Épée)",
    // Le plus fort des passifs : seulement 3 niveaux (Tempête : 9 + 3 = 12 orbes, le maximum).
    maxLevel: 3,
    stat: 'extraCount',
    amount: 1,
  },
];

/**
 * Part du bonus de Taille appliquée à la distance des orbes : 0,3 → au niveau 5 (+20 % de taille),
 * l'orbite s'éloigne de +6 % (105 → ~111 px). Demandé : "légèrement, mais un peu quand même".
 */
export const SIZE_ORBIT_SHARE = 0.3;

/**
 * Choix de secours quand tout est au maximum : un level up n'est jamais vide. 2026-11-21 :
 * +30 PV → au choix +15 PV ou +10 or (les soins de fin de partie étaient trop nombreux).
 */
export const HEAL_UPGRADE = {
  name: 'Soin',
  description: '+15 PV',
  amount: 15,
} as const;

export const GOLD_UPGRADE = {
  name: 'Bourse',
  description: '+10 or',
  amount: 10,
} as const;
