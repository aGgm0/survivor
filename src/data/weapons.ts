// Armes (voir CLAUDE.md § 5.4). Data-driven : ajouter une arme = ajouter une entrée ici.
export interface WeaponDef {
  readonly id: string;
  /** Nom affiché (futur écran d'upgrade, damage meter...) */
  readonly name: string;
  /** Dégâts par impact */
  readonly damage: number;
  /** s entre deux tirs */
  readonly cooldown: number;
  /** px/s */
  readonly projectileSpeed: number;
  /** s avant que le projectile disparaisse (portée = vitesse × durée de vie) */
  readonly projectileLifetime: number;
  /** px, taille du projectile (affichage et hitbox) */
  readonly projectileRadius: number;
  readonly color: string;
}

export const WEAPONS = {
  arcaneBolt: {
    id: 'arcaneBolt',
    name: 'Trait arcanique',
    damage: 10,
    cooldown: 1,
    projectileSpeed: 450,
    projectileLifetime: 1.4,
    projectileRadius: 6,
    color: '#5ab0ff',
  },
} as const satisfies Record<string, WeaponDef>;

/** Liste pratique pour itérer sur toutes les armes (ex. dessin groupé par couleur). */
export const WEAPON_LIST: readonly WeaponDef[] = Object.values(WEAPONS);

/** Portée d'une arme : distance max parcourue par son projectile. */
export function weaponRange(def: WeaponDef): number {
  return def.projectileSpeed * def.projectileLifetime;
}

/** Taille de la réserve de projectiles (toutes armes confondues). */
export const PROJECTILE_POOL_SIZE = 500;
