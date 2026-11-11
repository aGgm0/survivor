// Armes (voir CLAUDE.md § 5.4). Data-driven : ajouter une arme = ajouter une entrée ici.
// Trois comportements (`kind`) : projectile, aura, orbite. Chacun a ses propres réglages.

/** Ce qu'apporte un niveau d'arme (les bonus s'additionnent niveau après niveau). */
export interface WeaponLevelBonus {
  /** Texte affiché sur l'écran de level up */
  readonly description: string;
  /** Dégâts ajoutés à chaque coup */
  readonly damage?: number;
  /** Projectiles supplémentaires par tir (projectile) ou orbes en plus (orbite) */
  readonly count?: number;
  /** Variation du cooldown en fraction (-0.2 = 20 % plus rapide) */
  readonly cooldownPct?: number;
  /** px ajoutés au rayon (aura) */
  readonly radius?: number;
  /** px ajoutés à la distance joueur → orbes (orbite) */
  readonly orbitDistance?: number;
}

/**
 * Une mutation : variante définitive d'une arme arrivée au niveau max (choix entre 2).
 * Les multiplicateurs s'appliquent aux stats du niveau 5 ; les champs absents ne changent rien.
 */
export interface MutationDef {
  readonly id: string;
  /** Nouveau nom de l'arme (HUD, damage meter) */
  readonly name: string;
  /** 2 lettres pour la case d'inventaire */
  readonly short: string;
  /** Texte de la carte de choix */
  readonly description: string;
  /** Nouvelle couleur de l'arme */
  readonly color: string;
  readonly damageMult?: number;
  readonly knockbackMult?: number;
  /** Aura : multiplicateur du rayon */
  readonly radiusMult?: number;
  /** Aura : chaque ennemi brûlé est ralenti de `amount` (0,3 = 30 %) pendant `duration` s */
  readonly slow?: { readonly amount: number; readonly duration: number };
  /**
   * Aura : chaque ennemi brûlé est empoisonné pendant `duration` s (renouvelé).
   * Dégâts par seconde = `dpsRatio` × dégâts actuels de l'arme : niveaux et passifs comptent.
   */
  readonly poison?: { readonly dpsRatio: number; readonly duration: number };
  /** Projectile : nombre d'ennemis traversés avant de disparaître (1 = normal) */
  readonly pierce?: number;
  /** Projectile : explose à l'impact ; les ennemis autour prennent `damageRatio` × les dégâts */
  readonly explosion?: { readonly radius: number; readonly damageRatio: number };
  /** Orbite : nombre d'orbes imposé (remplace celui des niveaux) */
  readonly count?: number;
  /** Orbite : multiplicateur de la taille des orbes */
  readonly orbRadiusMult?: number;
  /** Orbite : multiplicateur de la vitesse de rotation */
  readonly angularSpeedMult?: number;
  /** Orbite : multiplicateur de la distance joueur → orbes */
  readonly orbitDistanceMult?: number;
}

interface WeaponDefBase {
  readonly id: string;
  /** Nom affiché (écran d'upgrade, damage meter...) */
  readonly name: string;
  /** 2 lettres affichées dans la case de l'inventaire du HUD (en attendant de vraies icônes) */
  readonly short: string;
  /** Description courte (écran de level up quand on obtient l'arme) */
  readonly description: string;
  /** Dégâts par coup au niveau 1 */
  readonly damage: number;
  /**
   * px/s : vitesse donnée à l'ennemi touché, en s'éloignant (pour un ennemi de poids moyen ;
   * voir KNOCKBACK dans combat.ts). L'ennemi ralentit ensuite et revient vers le joueur.
   */
  readonly knockback: number;
  readonly color: string;
  /** Bonus des niveaux 2, 3, 4... (index 0 = niveau 2). Niveau max = longueur + 1. */
  readonly levels: readonly WeaponLevelBonus[];
  /** Les 2 variantes proposées au level up qui suit le niveau max (aucune = pas de mutation) */
  readonly mutations?: readonly [MutationDef, MutationDef];
}

/** Tire des projectiles vers l'ennemi le plus proche. */
export interface ProjectileWeaponDef extends WeaponDefBase {
  readonly kind: 'projectile';
  /** s entre deux tirs au niveau 1 */
  readonly cooldown: number;
  /** Projectiles par tir au niveau 1 */
  readonly count: number;
  /** Degrés entre deux projectiles d'un même tir (éventail centré sur la cible) */
  readonly spreadDeg: number;
  /** px/s */
  readonly projectileSpeed: number;
  /** s avant que le projectile disparaisse (portée = vitesse × durée de vie) */
  readonly projectileLifetime: number;
  /** px, taille du projectile (affichage et hitbox) */
  readonly projectileRadius: number;
}

/**
 * Brûle les ennemis dans un cercle autour du joueur : dès qu'un ennemi y entre, puis toutes
 * les `cooldown` secondes tant qu'il y reste (chaque ennemi a sa propre horloge).
 */
export interface AuraWeaponDef extends WeaponDefBase {
  readonly kind: 'aura';
  /** s entre deux brûlures d'un même ennemi, au niveau 1 */
  readonly cooldown: number;
  /** px, rayon au niveau 1 */
  readonly radius: number;
}

/** Des orbes tournent autour du joueur et blessent les ennemis qu'ils touchent. */
export interface OrbitWeaponDef extends WeaponDefBase {
  readonly kind: 'orbit';
  /** Orbes au niveau 1 */
  readonly count: number;
  /** px entre le joueur et le centre des orbes */
  readonly orbitDistance: number;
  /** px, taille d'un orbe (affichage et hitbox) */
  readonly orbRadius: number;
  /** radians/s : vitesse de rotation */
  readonly angularSpeed: number;
  /**
   * s avant qu'un même orbe puisse retoucher le même ennemi (sinon 8 × 60 = 480 dégâts/s).
   * Délai par orbe : 9 orbes sur un boss = 9 coups, pas un seul.
   */
  readonly rehitCooldown: number;
}

export type WeaponDef = ProjectileWeaponDef | AuraWeaponDef | OrbitWeaponDef;

export const WEAPONS = {
  arcaneBolt: {
    kind: 'projectile',
    id: 'arcaneBolt',
    name: 'Trait arcanique',
    short: 'TA',
    description: "Tire sur l'ennemi le plus proche",
    damage: 10,
    knockback: 185, // moyen, dans la direction du tir (160 → 185 avec le nerf d'Impact)
    cooldown: 1,
    count: 1,
    spreadDeg: 12,
    projectileSpeed: 450,
    projectileLifetime: 1.4,
    projectileRadius: 6,
    color: '#5ab0ff',
    levels: [
      { description: '+5 dégâts', damage: 5 },
      { description: '+1 projectile', count: 1 },
      { description: 'Cooldown -20 %', cooldownPct: -0.2 },
      { description: '+1 projectile', count: 1 },
    ],
    mutations: [
      {
        id: 'piercingBolt',
        name: 'Trait perçant',
        short: 'Tp',
        description: 'Traverse 3 ennemis avant de disparaître, dégâts ×0,9',
        color: '#9ad7ff',
        pierce: 3,
        damageMult: 0.9,
      },
      {
        id: 'burstBolt',
        name: 'Trait éclaté',
        short: 'Té',
        description: 'Explose à l’impact : 70 % des dégâts aux ennemis à moins de 60 px',
        color: '#ff8fd6',
        explosion: { radius: 60, damageRatio: 0.7 },
      },
    ],
  },
  burningAura: {
    kind: 'aura',
    id: 'burningAura',
    name: 'Aura ardente',
    short: 'AA',
    description: 'Brûle les ennemis autour de toi',
    damage: 5,
    knockback: 60, // faible : une brûlure pousse peu (50 → 60)
    cooldown: 0.5,
    radius: 70,
    color: '#ff7a3d',
    levels: [
      { description: 'Rayon +15 px', radius: 15 },
      { description: '+2 dégâts', damage: 2 },
      { description: 'Rayon +15 px', radius: 15 },
      { description: '+3 dégâts, rayon +20 px', damage: 3, radius: 20 },
    ],
    mutations: [
      {
        id: 'blaze',
        name: 'Brasier',
        short: 'Br',
        description: 'Rayon ×1,6, dégâts ×0,6, ralentit de 30 % les ennemis dedans',
        color: '#ffb347',
        radiusMult: 1.6,
        damageMult: 0.6,
        // 0,6 s > 0,5 s entre deux brûlures : l'ennemi reste ralenti tant qu'il est dedans.
        slow: { amount: 0.3, duration: 0.6 },
      },
      {
        id: 'toxicAura',
        name: 'Aura toxique',
        short: 'At',
        description: 'Même taille, empoisonne pendant 3 s : 60 % des dégâts de l’aura par seconde',
        color: '#7cfc00',
        // Au niveau 5 sans bonus : 10 dégâts × 0,6 = 6/s. Grandit avec Puissance.
        poison: { dpsRatio: 0.6, duration: 3 },
      },
    ],
  },
  runicOrbs: {
    kind: 'orbit',
    id: 'runicOrbs',
    name: 'Orbes runiques',
    short: 'OR',
    description: 'Des orbes tournent autour de toi',
    damage: 8,
    knockback: 370, // fort : les orbes "frappent", leur rôle est d'écarter la horde (320 → 370)
    count: 2,
    orbitDistance: 80,
    orbRadius: 13, // 10 → 13 : retour de jeu, "vraiment petit"
    angularSpeed: 3,
    rehitCooldown: 0.5,
    color: '#c77dff',
    levels: [
      { description: '+1 orbe', count: 1 },
      { description: '+1 orbe', count: 1 },
      { description: '+1 orbe, +3 dégâts', count: 1, damage: 3 },
      // Retour de jeu : les orbes étaient trop collés au joueur. Vaut pour les 2 mutations.
      { description: '+1 orbe, orbite plus large', count: 1, orbitDistance: 25 },
    ],
    mutations: [
      {
        id: 'giantOrbs',
        name: 'Orbes géants',
        short: 'Og',
        description: '3 orbes énormes (×2,2) sur une orbite plus large : dégâts ×2, recul ×1,8',
        color: '#e040fb',
        count: 3,
        orbRadiusMult: 2.2,
        // 105 → ~131 px : des orbes de 29 px à 105 px laissaient trop peu d'air au joueur
        orbitDistanceMult: 1.25,
        damageMult: 2,
        knockbackMult: 1.8,
      },
      {
        id: 'orbStorm',
        name: 'Tempête d’orbes',
        short: 'To',
        description: '9 orbes, rotation ×1,6, dégâts ×0,7',
        color: '#b388ff',
        count: 9,
        angularSpeedMult: 1.6,
        damageMult: 0.7,
      },
    ],
  },
} as const satisfies Record<string, WeaponDef>;

/**
 * Orbes maximum pour une arme d'orbite (Tempête d'orbes : 9). Chaque ennemi garde un délai de
 * re-touche PAR orbe, dans un tableau de cette taille réservé une fois pour toutes.
 */
export const MAX_ORBS = 12;

/** Toutes les armes du jeu (ordre d'affichage, armes à débloquer au level up...). */
export const WEAPON_LIST: readonly WeaponDef[] = Object.values(WEAPONS);

/** Portée d'une arme à projectiles : distance max parcourue par son projectile. */
export function weaponRange(def: ProjectileWeaponDef): number {
  return def.projectileSpeed * def.projectileLifetime;
}

export function weaponMaxLevel(def: WeaponDef): number {
  return def.levels.length + 1;
}

/** Taille de la réserve de projectiles (toutes armes confondues). */
export const PROJECTILE_POOL_SIZE = 500;
