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
  /** Degrés ajoutés à l'angle du coup (mêlée) */
  readonly arcDeg?: number;
  /** px ajoutés à la portée du coup (mêlée) */
  readonly range?: number;
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
  /** Multiplicateur du délai entre deux tirs / brûlures (1,2 = 20 % plus lent) */
  readonly cooldownMult?: number;
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
  /** Mêlée : angle du coup imposé, en degrés (360 = tout autour) */
  readonly arcDeg?: number;
  /**
   * Mêlée : chaque coup lance aussi une vague tranchante devant le joueur, qui traverse jusqu'à
   * `pierce` ennemis avec `damageRatio` × les dégâts. Portée = vitesse × durée de vie.
   */
  readonly wave?: {
    readonly speed: number;
    readonly lifetime: number;
    readonly radius: number;
    readonly damageRatio: number;
    readonly pierce: number;
  };
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

/**
 * Coup en arc devant le joueur, dans la direction où il marche (la dernière s'il est immobile).
 * Chaque ennemi dans l'arc est touché une fois par coup. `count` = coups enchaînés par attaque,
 * espacés de `comboDelay` (le Duplicateur n'en ajoute plus).
 */
export interface MeleeWeaponDef extends WeaponDefBase {
  readonly kind: 'melee';
  /** s entre deux attaques au niveau 1 */
  readonly cooldown: number;
  /** Coups enchaînés par attaque au niveau 1 */
  readonly count: number;
  /** s entre deux coups d'un même combo */
  readonly comboDelay: number;
  /** px depuis le centre du joueur */
  readonly range: number;
  /** Degrés : ouverture de l'arc au niveau 1 */
  readonly arcDeg: number;
}

export type WeaponDef = ProjectileWeaponDef | AuraWeaponDef | OrbitWeaponDef | MeleeWeaponDef;

export const WEAPONS = {
  arcaneBolt: {
    kind: 'projectile',
    id: 'arcaneBolt',
    name: 'Trait arcanique',
    short: 'TA',
    description: "Tire sur l'ennemi le plus proche",
    // 10 → 11 → 14 : restait dernier du damage meter. Un basique (20 PV) tombe toujours en 2 coups.
    damage: 14,
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
        description: 'Traverse 5 ennemis avant de disparaître, dégâts ×0,9',
        color: '#9ad7ff',
        pierce: 5, // 3 → 5 : retour de jeu, dégâts inchangés
        damageMult: 0.9,
      },
      {
        id: 'burstBolt',
        name: 'Trait éclaté',
        short: 'Té',
        description: 'Explose à l’impact : 70 % des dégâts aux ennemis à moins de 75 px',
        color: '#ff8fd6',
        explosion: { radius: 75, damageRatio: 0.7 }, // rayon 60 → 75
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
      // Dégâts d'abord (retour de jeu) : au niveau 2, l'aura doit déjà tuer plus, pas juste grandir.
      { description: '+2 dégâts', damage: 2 },
      { description: 'Rayon +15 px', radius: 15 },
      { description: 'Rayon +15 px', radius: 15 },
      { description: '+3 dégâts, rayon +20 px', damage: 3, radius: 20 },
    ],
    mutations: [
      {
        id: 'blaze',
        name: 'Brasier',
        short: 'Br',
        description:
          'Rayon ×1,6, dégâts ×0,6, brûle toutes les 0,6 s, ralentit de 30 % les ennemis dedans',
        color: '#ffb347',
        radiusMult: 1.6,
        damageMult: 0.6,
        // Retour de jeu : les 2 mutations de l'aura brûlaient trop souvent. 0,5 → 0,6 s.
        cooldownMult: 1.2,
        // 0,7 s > 0,6 s entre deux brûlures : l'ennemi reste ralenti tant qu'il est dedans.
        slow: { amount: 0.3, duration: 0.7 },
      },
      {
        id: 'toxicAura',
        name: 'Aura toxique',
        short: 'At',
        description:
          'Même taille, brûle toutes les 0,6 s, empoisonne pendant 3 s : 60 % des dégâts de l’aura par seconde',
        color: '#7cfc00',
        // Au niveau 5 sans bonus : 10 dégâts × 0,6 = 6/s. Grandit avec Puissance.
        poison: { dpsRatio: 0.6, duration: 3 },
        cooldownMult: 1.2, // 0,5 → 0,6 s entre deux brûlures (voir Brasier)
      },
    ],
  },
  runicOrbs: {
    kind: 'orbit',
    id: 'runicOrbs',
    name: 'Orbes runiques',
    short: 'OR',
    description: 'Des orbes tournent autour de toi',
    damage: 10, // 8 → 10 : compense le gros nerf du recul
    // 320 → 370 → 350 → 200 : chaque orbe frappe (délai par orbe), le recul s'additionnait trop
    knockback: 200,
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
        description:
          '3 orbes énormes (×2,2) sur une orbite plus large : dégâts ×2, rotation ×0,85, recul ×1,6',
        color: '#e040fb',
        count: 3,
        orbRadiusMult: 2.2,
        // 105 → ~131 px : des orbes de 29 px à 105 px laissaient trop peu d'air au joueur
        orbitDistanceMult: 1.25,
        // Retour de jeu : un peu trop forts. Rotation ralentie, recul 1,8 → 1,6
        angularSpeedMult: 0.85,
        damageMult: 2,
        knockbackMult: 1.6,
      },
      {
        id: 'orbStorm',
        name: 'Tempête d’orbes',
        short: 'To',
        description: '9 orbes, rotation ×1,6, recul ×0,3',
        color: '#b388ff',
        count: 9,
        angularSpeedMult: 1.6,
        // Gros nerf : chaque orbe frappe (délai par orbe), donc le recul tombe ~7 fois/s.
        // Retour de jeu : immobile 12 min sans qu'aucun ennemi n'arrive au contact.
        knockbackMult: 0.3,
      },
    ],
  },
  sword: {
    kind: 'melee',
    id: 'sword',
    name: 'Épée',
    short: 'ÉP',
    description: 'Frappe en arc devant toi, dans la direction où tu marches',
    // 22 → 16 et recul 260 → 140 : gros nerf (retour de jeu, l'Épée dominait).
    damage: 16,
    knockback: 140,
    cooldown: 1.2,
    count: 1,
    comboDelay: 0.12,
    range: 110,
    arcDeg: 120,
    color: '#e8e8f0',
    levels: [
      { description: '+5 dégâts', damage: 5 },
      { description: 'Arc +40°', arcDeg: 40 },
      { description: 'Délai -20 %', cooldownPct: -0.2 },
      { description: '+7 dégâts, portée +25 px', damage: 7, range: 25 },
    ],
    mutations: [
      {
        id: 'whirlwind',
        name: 'Tourbillon',
        short: 'Tb',
        description: 'Le coup fait le tour complet (360°), dégâts ×0,75',
        color: '#b0e0ff',
        arcDeg: 360,
        damageMult: 0.75,
      },
      {
        id: 'waveBlade',
        name: 'Lame d’onde',
        short: 'Lo',
        description:
          'Chaque coup lance une vague qui traverse les ennemis (~300 px, 60 % des dégâts)',
        color: '#9ff0d0',
        wave: { speed: 500, lifetime: 0.6, radius: 22, damageRatio: 0.6, pierce: 8 },
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
