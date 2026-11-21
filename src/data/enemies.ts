// Types d'ennemis (voir CLAUDE.md § 5.5). Leur fréquence d'apparition est dans waves.ts.
export interface EnemyType {
  readonly id: string;
  readonly hp: number;
  /** px/s */
  readonly speed: number;
  /** dégâts infligés au joueur au contact */
  readonly contactDamage: number;
  /** XP lâchée à la mort */
  readonly xp: number;
  /** px, taille (affichage et hitbox) */
  readonly radius: number;
  readonly color: string;
  /** Vrai : aucune arme ne le fait reculer (boss) */
  readonly knockbackImmune?: boolean;
  /** Part des ralentissements ignorée (0,85 = ne subit que 15 % du ralentissement). Absent = 0 */
  readonly slowResist?: number;
  /**
   * Objet du décor (mobilier) : immobile, inoffensif, ignoré par la visée automatique, ne compte
   * ni comme kill ni dans le damage meter ; une fois cassé, il lâche de l'or ou de la nourriture.
   */
  readonly prop?: boolean;
  /** Mini-boss (élite) : anneau doré, barre de PV, +or à sa mort */
  readonly elite?: boolean;
  /** Gros ennemi (tank, élites, boss) : certaines armes leur font plus de dégâts (Fournaise) */
  readonly big?: boolean;
  /**
   * Recul imposé (× la force de l'arme), à la place du calcul par la masse. Sert aux élites :
   * plus gros, ils reculeraient beaucoup moins qu'on ne le veut. Absent = calcul par la masse.
   */
  readonly knockbackFactor?: number;
  /**
   * Chance (0 à 1) de lâcher une gemme verte « boostée » à la place de la normale, qui vaut
   * `xpMult` fois plus d'XP. Absent = jamais.
   */
  readonly bonusGem?: { readonly chance: number; readonly xpMult: number };
  /**
   * Chance (0 à 1) de lâcher une pièce d'or à sa mort (2026-11-21 : remplir la Boutique en ~25
   * parties complètes). Absent = jamais (les élites et les boss donnent leur or directement).
   */
  readonly goldChance?: number;
}

export const ENEMY_TYPES = {
  basic: {
    id: 'basic',
    hp: 23, // 20 → 23 : léger buff (toujours 2 coups de Trait arcanique à 14)
    speed: 88, // 80 → 88 : léger buff
    contactDamage: 5,
    xp: 1,
    radius: 14,
    color: '#d9534f',
    // Retour de jeu (2026-11-18) : XP trop lente. Une gemme sur deux vaut double (≈ +20 % d'XP
    // au total), plutôt qu'un +50 % général : ça récompense de tuer les basiques.
    bonusGem: { chance: 0.5, xpMult: 2 },
    goldChance: 0.02, // 4 → 2 % : or −50 %
  },
  fast: {
    id: 'fast',
    hp: 5,
    speed: 135, // 150 → 135 : retour de jeu
    contactDamage: 3,
    xp: 1,
    radius: 10,
    color: '#f0ad4e',
    goldChance: 0.02, // 4 → 2 % : or −50 %
  },
  tank: {
    id: 'tank',
    big: true,
    hp: 90, // 60 → 66 → 90 : gros buff (retour de jeu)
    speed: 72, // 50 → 60 → 72 : gros buff
    contactDamage: 10,
    xp: 5,
    radius: 24,
    color: '#5cb85c',
    goldChance: 0.075, // 15 → 7,5 % (or −50 %) ; plus dur à tuer : plus souvent de l'or
  },
  /** N'apparaît qu'aux instants de BOSS_SPAWNS (waves.ts), jamais dans le tirage aléatoire. */
  boss: {
    id: 'boss',
    big: true,
    hp: 1000,
    speed: 70,
    contactDamage: 20,
    xp: 50,
    radius: 48,
    color: '#8e2de2',
    knockbackImmune: true, // demandé : le boss avance quoi qu'il arrive
    slowResist: 0.85, // retour de jeu : le Brasier (−30 %, remplacé par l'Aura de givre) le ralentissait beaucoup trop
  },
  /** Mini-boss de 3:00 : un rapide très boosté (PV ×60, dégâts ×4, taille ×1,8). */
  fastElite: {
    id: 'fastElite',
    big: true,
    hp: 300,
    speed: 135,
    contactDamage: 12,
    xp: 20,
    radius: 18,
    color: '#f0ad4e',
    // 50 % du recul d'un rapide normal (1,5, le plafond des ennemis légers)
    knockbackFactor: 0.75,
    elite: true,
  },
  /** Mini-boss de 7:00 : un basique très boosté (PV ×50, dégâts ×4, taille ×1,8, vitesse ×1,1). */
  basicElite: {
    id: 'basicElite',
    big: true,
    hp: 1150,
    speed: 97,
    contactDamage: 20,
    xp: 20,
    radius: 25,
    color: '#d9534f',
    // 50 % du recul d'un basique normal (1, l'ennemi de référence)
    knockbackFactor: 0.5,
    elite: true,
  },
  /** Mobilier cassable (voir data/furniture.ts) : apparaît hors écran, ne bouge pas. */
  crate: {
    id: 'crate',
    hp: 10, // un seul coup de presque n'importe quelle arme
    speed: 0,
    contactDamage: 0,
    xp: 0,
    radius: 14,
    color: '#8d6e63',
    knockbackImmune: true,
    prop: true,
  },
} as const satisfies Record<string, EnemyType>;

/** Liste pratique pour itérer sur tous les types (ex. dessin groupé par couleur). */
export const ENEMY_TYPE_LIST: readonly EnemyType[] = Object.values(ENEMY_TYPES);
