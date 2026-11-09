// Types d'ennemis (voir CLAUDE.md § 5.5). Le boss arrive en Phase 4.
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
}

export const ENEMY_TYPES = {
  basic: {
    id: 'basic',
    hp: 10,
    speed: 80,
    contactDamage: 5,
    xp: 1,
    radius: 14,
    color: '#d9534f',
  },
  fast: {
    id: 'fast',
    hp: 5,
    speed: 150,
    contactDamage: 3,
    xp: 1,
    radius: 10,
    color: '#f0ad4e',
  },
  tank: {
    id: 'tank',
    hp: 60,
    speed: 50,
    contactDamage: 10,
    xp: 5,
    radius: 24,
    color: '#5cb85c',
  },
} as const satisfies Record<string, EnemyType>;

/** Liste pratique pour itérer sur tous les types (ex. dessin groupé par couleur). */
export const ENEMY_TYPE_LIST: readonly EnemyType[] = Object.values(ENEMY_TYPES);
