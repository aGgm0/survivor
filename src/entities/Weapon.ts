import { WEAPON_DAMAGE_MULT, type DamageType } from '../data/combat';
import { weaponMaxLevel, type MutationDef, type WeaponDef } from '../data/weapons';
import { FLIGHT_STRIDE } from '../weapons/boomerang';
import { behaviorOf } from '../weapons/registry';
import type { LevelTotals } from '../weapons/WeaponBehavior';

/** Multiplicateurs venant du joueur (passifs), appliqués à toutes ses armes. */
export interface WeaponModifiers {
  readonly damageMult: number;
  readonly cooldownMult: number;
  readonly knockbackMult: number;
  /** Taille (passif Taille). Absent = ×1 */
  readonly sizeMult?: number;
  /** Vitesse des projectiles et rotation des orbes (passif Vélocité). Absent = ×1 */
  readonly projectileSpeedMult?: number;
  /** Projectiles / orbes en plus (passif Duplicateur). Absent = 0 */
  readonly extraCount?: number;
  /** Retirée de la résistance des ennemis (passif Pénétration). Absent = 0 */
  readonly penetration?: number;
}

/** Bonus des niveaux additionnés : un seul objet réutilisé par tous les recalculs. */
const TOTALS: LevelTotals = {
  damage: 0,
  count: 0,
  radius: 0,
  cooldownPct: 0,
  orbitDistance: 0,
  arcDeg: 0,
  range: 0,
  jumps: 0,
};

/**
 * Une arme possédée par le joueur : sa définition (stats fixes) + son état pendant la partie.
 * Les stats de dégâts/kills servent au "damage meter" (classement des armes).
 */
export class Weapon {
  level = 1;
  /** Variante choisie après le niveau max (null = pas encore mutée) */
  mutation: MutationDef | null = null;
  /** s avant de pouvoir tirer / frapper ; ≤ 0 = prête (projectile) */
  cooldownTimer = 0;
  /** Angle actuel des orbes (orbite), et celui de l'update précédente pour l'interpolation */
  /** Aura à souffle (Fournaise) : temps de partie du prochain souffle, et du dernier (visuel) */
  nextPulseAt = 0;
  lastPulseAt = -Infinity;
  /** N° de l'onde en cours (compare à `Enemy.waveHit`) */
  pulseIndex = 0;
  angle = 0;
  prevAngle = 0;
  /** Dégâts réellement infligés (sans l'excédent sur un ennemi déjà presque mort) */
  totalDamage = 0;
  kills = 0;

  // Stats actuelles = base + bonus des niveaux + mutation + passifs du joueur. Recalculées par
  // `recompute()` seulement quand elles changent (level up), pas à chaque tir.
  damage: number;
  /** s entre deux tirs (projectile) ou deux brûlures d'un même ennemi (aura) ; 0 pour l'orbite */
  cooldown = 0;
  /** Projectiles par tir (projectile) ou nombre d'orbes (orbite) */
  count = 0;
  /** px, rayon de l'aura */
  radius = 0;
  /** Retirée de la résistance de l'ennemi : arme + mutation + joueur */
  penetration = 0;
  /** px/s de recul donné à un ennemi de poids moyen */
  knockback: number;
  /** Orbite : taille d'un orbe (px) et vitesse de rotation (rad/s) ; 0 pour les autres armes */
  orbRadius = 0;
  angularSpeed = 0;
  /** Orbite : distance joueur → centre des orbes (px) ; 0 pour les autres armes */
  orbitDistance = 0;
  /** Projectile : vitesse (px/s), taille (px) et portée (px) ; 0 pour les autres armes */
  projectileSpeed = 0;
  projectileRadius = 0;
  range = 0;
  /** Projectile : ennemis traversés avant de disparaître (1 = s'arrête au premier) */
  pierce = 1;
  /** Trait éclaté : rayon de l'explosion (px) ; 0 sans explosion */
  explosionRadius = 0;
  /** Mêlée : ouverture du coup en radians (2π = tout autour) ; 0 pour les autres armes */
  arc = 0;
  /** Chaîne : sauts après la première cible, distance max d'un saut (px), perte par saut */
  jumps = 0;
  jumpRange = 0;
  falloff = 0;
  /**
   * Chaîne : segments d'éclairs récents, pour le dessin (x1, y1, x2, y2, temps de partie).
   * Tableau fixe créé une fois par l'arme (null pour les autres types) : pas d'allocation en jeu.
   */
  bolts: Float64Array | null = null;
  /** Prochain emplacement libre de `bolts` (tourne en boucle) */
  boltNext = 0;
  /**
   * Boomerang : état des armes en vol, créé une fois par l'arme (null pour les autres types).
   * Voir src/weapons/boomerang.ts pour le rangement des valeurs.
   */
  flights: Float64Array | null = null;
  /** Boomerang : ids des ennemis déjà touchés par chaque arme en vol, pendant l'aller ou le retour */
  flightHits: Int32Array | null = null;
  /** Mêlée : coups du combo en cours qui restent à porter, et quand porter le prochain */
  strikesLeft = 0;
  nextStrikeAt = 0;

  constructor(readonly def: WeaponDef) {
    this.damage = def.damage;
    this.knockback = def.knockback;
    this.penetration = def.penetration ?? 0;
    // Les stats propres au type (délai, nombre, rayon, portée...) : voir src/weapons/.
    behaviorOf(def).init(this, def);
  }

  /**
   * Jeu figé (level up, pause, fin) : la position « précédente » de ce qui bouge rejoint
   * l'actuelle, sinon l'interpolation ferait trembler les orbes et les haches sur place.
   */
  syncPrevious(): void {
    this.prevAngle = this.angle;
    const f = this.flights;
    if (!f) return;
    // Haches en vol : x, y aux index 1, 2 ; précédents aux index 3, 4 (voir boomerang.ts).
    for (let o = 0; o + 4 < f.length; o += FLIGHT_STRIDE) {
      f[o + 3] = f[o + 1] ?? 0;
      f[o + 4] = f[o + 2] ?? 0;
    }
  }

  /** Nom affiché : celui de la mutation si l'arme a muté. */
  get displayName(): string {
    return this.mutation?.name ?? this.def.name;
  }

  get damageType(): DamageType {
    return this.def.damageType;
  }

  get color(): string {
    return this.mutation?.color ?? this.def.color;
  }

  get short(): string {
    return this.mutation?.short ?? this.def.short;
  }

  /** Vrai quand l'arme est au niveau max, a des mutations, et n'a pas encore muté. */
  get canMutate(): boolean {
    return (
      this.mutation === null &&
      this.def.mutations !== undefined &&
      this.level >= weaponMaxLevel(this.def)
    );
  }

  recompute(mods: WeaponModifiers): void {
    const def = this.def;
    const behavior = behaviorOf(def);
    const t = TOTALS;
    t.damage = def.damage;
    t.count = 0;
    t.radius = 0;
    t.cooldownPct = 0;
    t.orbitDistance = 0;
    t.arcDeg = 0;
    t.range = 0;
    t.jumps = 0;
    behavior.levelBase(def, t);
    // Bonus des niveaux 2 à `level` (index 0 = niveau 2).
    for (let i = 0; i < this.level - 1; i++) {
      const bonus = def.levels[i];
      if (!bonus) continue;
      t.damage += bonus.damage ?? 0;
      t.count += bonus.count ?? 0;
      t.radius += bonus.radius ?? 0;
      t.cooldownPct += bonus.cooldownPct ?? 0;
      t.orbitDistance += bonus.orbitDistance ?? 0;
      t.arcDeg += bonus.arcDeg ?? 0;
      t.range += bonus.range ?? 0;
      t.jumps += bonus.jumps ?? 0;
    }
    // La mutation transforme les stats du niveau max, avant les passifs du joueur.
    const m = this.mutation;
    this.damage = t.damage * (m?.damageMult ?? 1) * mods.damageMult * WEAPON_DAMAGE_MULT;
    this.knockback = def.knockback * (m?.knockbackMult ?? 1) * mods.knockbackMult;
    // Pénétration : celle de l'arme, de sa mutation et du joueur s'additionnent.
    this.penetration = (def.penetration ?? 0) + (m?.penetration ?? 0) + (mods.penetration ?? 0);
    // Le reste dépend du type (Taille, Vélocité, Duplicateur, Hâte...).
    behavior.applyStats(this, def, t, mods);
  }
}
