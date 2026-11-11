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
  },
  fast: {
    id: 'fast',
    hp: 5,
    speed: 135, // 150 → 135 : retour de jeu
    contactDamage: 3,
    xp: 1,
    radius: 10,
    color: '#f0ad4e',
  },
  tank: {
    id: 'tank',
    hp: 90, // 60 → 66 → 90 : gros buff (retour de jeu)
    speed: 72, // 50 → 60 → 72 : gros buff
    contactDamage: 10,
    xp: 5,
    radius: 24,
    color: '#5cb85c',
  },
  /** N'apparaît qu'aux instants de BOSS_SPAWNS (waves.ts), jamais dans le tirage aléatoire. */
  boss: {
    id: 'boss',
    hp: 1000,
    speed: 70,
    contactDamage: 20,
    xp: 50,
    radius: 48,
    color: '#8e2de2',
    knockbackImmune: true, // demandé : le boss avance quoi qu'il arrive
    slowResist: 0.85, // retour de jeu : le Brasier (−30 %) le ralentissait beaucoup trop
  },
} as const satisfies Record<string, EnemyType>;

/** Liste pratique pour itérer sur tous les types (ex. dessin groupé par couleur). */
export const ENEMY_TYPE_LIST: readonly EnemyType[] = Object.values(ENEMY_TYPES);
