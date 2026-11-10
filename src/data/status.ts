// Effets d'état sur les ennemis (ralentissement, poison). Utilisés par les mutations d'armes.

export const STATUS = {
  /** s entre deux dégâts de poison (le poison inflige `dps × poisonTick` à chaque fois) */
  poisonTick: 0.5,
  /** Couleur des nombres de dégâts de poison */
  poisonColor: '#7cfc00',
} as const;
