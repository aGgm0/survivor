// Upgrades passifs (voir CLAUDE.md § 5.6). Data-driven : ajouter un passif = ajouter une entrée.

/** Stat du joueur modifiée par un passif. */
export type PassiveStat =
  'maxHp' | 'speedPct' | 'pickupPct' | 'damagePct' | 'cooldownPct' | 'knockbackPct';

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
];

/** Choix de secours quand tout est au maximum : un level up n'est jamais vide. */
export const HEAL_UPGRADE = {
  name: 'Soin',
  description: '+30 PV',
  amount: 30,
} as const;
