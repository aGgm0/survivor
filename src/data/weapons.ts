// Armes (voir CLAUDE.md § 5.4). Data-driven : ajouter une arme = ajouter une entrée ici.

/** Ce qu'apporte un niveau d'arme (les bonus s'additionnent niveau après niveau). */
export interface WeaponLevelBonus {
  /** Texte affiché sur l'écran de level up */
  readonly description: string;
  /** Dégâts ajoutés à chaque impact */
  readonly damage?: number;
  /** Projectiles supplémentaires par tir */
  readonly projectiles?: number;
  /** Variation du cooldown en fraction (-0.2 = 20 % plus rapide) */
  readonly cooldownPct?: number;
}

export interface WeaponDef {
  readonly id: string;
  /** Nom affiché (écran d'upgrade, damage meter...) */
  readonly name: string;
  /** Description courte de l'arme (écran de level up quand on l'obtient) */
  readonly description: string;
  /** Dégâts par impact au niveau 1 */
  readonly damage: number;
  /** s entre deux tirs au niveau 1 */
  readonly cooldown: number;
  /** Projectiles par tir au niveau 1 */
  readonly projectileCount: number;
  /** Degrés entre deux projectiles d'un même tir (éventail centré sur la cible) */
  readonly spreadDeg: number;
  /** px/s */
  readonly projectileSpeed: number;
  /** s avant que le projectile disparaisse (portée = vitesse × durée de vie) */
  readonly projectileLifetime: number;
  /** px, taille du projectile (affichage et hitbox) */
  readonly projectileRadius: number;
  readonly color: string;
  /** Bonus des niveaux 2, 3, 4... (index 0 = niveau 2). Niveau max = longueur + 1. */
  readonly levels: readonly WeaponLevelBonus[];
}

export const WEAPONS = {
  arcaneBolt: {
    id: 'arcaneBolt',
    name: 'Trait arcanique',
    description: "Tire sur l'ennemi le plus proche",
    damage: 10,
    cooldown: 1,
    projectileCount: 1,
    spreadDeg: 12,
    projectileSpeed: 450,
    projectileLifetime: 1.4,
    projectileRadius: 6,
    color: '#5ab0ff',
    levels: [
      { description: '+5 dégâts', damage: 5 },
      { description: '+1 projectile', projectiles: 1 },
      { description: 'Cooldown -20 %', cooldownPct: -0.2 },
      { description: '+1 projectile', projectiles: 1 },
    ],
  },
} as const satisfies Record<string, WeaponDef>;

/** Liste pratique pour itérer sur toutes les armes (ex. dessin groupé par couleur). */
export const WEAPON_LIST: readonly WeaponDef[] = Object.values(WEAPONS);

/** Portée d'une arme : distance max parcourue par son projectile. */
export function weaponRange(def: WeaponDef): number {
  return def.projectileSpeed * def.projectileLifetime;
}

export function weaponMaxLevel(def: WeaponDef): number {
  return def.levels.length + 1;
}

/** Taille de la réserve de projectiles (toutes armes confondues). */
export const PROJECTILE_POOL_SIZE = 500;
