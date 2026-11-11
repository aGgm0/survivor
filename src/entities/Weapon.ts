import { weaponMaxLevel, type MutationDef, type WeaponDef } from '../data/weapons';

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
}

/** En dessous, le cooldown deviendrait absurde (tir à chaque update). */
const MIN_COOLDOWN = 0.05;

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
  angle = 0;
  prevAngle = 0;
  /** Dégâts réellement infligés (sans l'excédent sur un ennemi déjà presque mort) */
  totalDamage = 0;
  kills = 0;

  // Stats actuelles = base + bonus des niveaux + mutation + passifs du joueur. Recalculées par
  // `recompute()` seulement quand elles changent (level up), pas à chaque tir.
  damage: number;
  /** s entre deux tirs (projectile) ou deux brûlures d'un même ennemi (aura) ; 0 pour l'orbite */
  cooldown: number;
  /** Projectiles par tir (projectile) ou nombre d'orbes (orbite) */
  count: number;
  /** px, rayon de l'aura */
  radius: number;
  /** px/s de recul donné à un ennemi de poids moyen */
  knockback: number;
  /** Orbite : taille d'un orbe (px) et vitesse de rotation (rad/s) ; 0 pour les autres armes */
  orbRadius: number;
  angularSpeed: number;
  /** Orbite : distance joueur → centre des orbes (px) ; 0 pour les autres armes */
  orbitDistance: number;
  /** Projectile : vitesse (px/s), taille (px) et portée (px) ; 0 pour les autres armes */
  projectileSpeed: number;
  projectileRadius: number;
  range: number;
  /** Trait éclaté : rayon de l'explosion (px) ; 0 sans explosion */
  explosionRadius = 0;

  constructor(readonly def: WeaponDef) {
    this.damage = def.damage;
    this.knockback = def.knockback;
    this.cooldown = def.kind === 'orbit' ? 0 : def.cooldown;
    this.count = def.kind === 'aura' ? 0 : def.count;
    this.radius = def.kind === 'aura' ? def.radius : 0;
    this.orbRadius = def.kind === 'orbit' ? def.orbRadius : 0;
    this.angularSpeed = def.kind === 'orbit' ? def.angularSpeed : 0;
    this.orbitDistance = def.kind === 'orbit' ? def.orbitDistance : 0;
    this.projectileSpeed = def.kind === 'projectile' ? def.projectileSpeed : 0;
    this.projectileRadius = def.kind === 'projectile' ? def.projectileRadius : 0;
    this.range = def.kind === 'projectile' ? def.projectileSpeed * def.projectileLifetime : 0;
  }

  /** Nom affiché : celui de la mutation si l'arme a muté. */
  get displayName(): string {
    return this.mutation?.name ?? this.def.name;
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
    let damage = def.damage;
    let count = def.kind === 'aura' ? 0 : def.count;
    let radius = def.kind === 'aura' ? def.radius : 0;
    let cooldownPct = 0;
    let orbitDistance = def.kind === 'orbit' ? def.orbitDistance : 0;
    // Bonus des niveaux 2 à `level` (index 0 = niveau 2).
    for (let i = 0; i < this.level - 1; i++) {
      const bonus = def.levels[i];
      if (!bonus) continue;
      damage += bonus.damage ?? 0;
      count += bonus.count ?? 0;
      radius += bonus.radius ?? 0;
      cooldownPct += bonus.cooldownPct ?? 0;
      orbitDistance += bonus.orbitDistance ?? 0;
    }
    // La mutation transforme les stats du niveau max, avant les passifs du joueur.
    const m = this.mutation;
    this.damage = damage * (m?.damageMult ?? 1) * mods.damageMult;
    this.knockback = def.knockback * (m?.knockbackMult ?? 1) * mods.knockbackMult;
    // Passifs Taille, Vélocité, Duplicateur (neutres s'ils sont absents).
    const size = mods.sizeMult ?? 1;
    const velocity = mods.projectileSpeedMult ?? 1;
    const extra = mods.extraCount ?? 0;
    // Une mutation peut imposer un nombre (3 orbes géants, 9 orbes de tempête) ; le Duplicateur
    // s'ajoute APRÈS, donc aussi aux mutations. L'aura n'a rien à dupliquer.
    this.count = def.kind === 'aura' ? 0 : (m?.count ?? count) + extra;
    this.radius = radius * (m?.radiusMult ?? 1) * size;
    if (def.kind === 'orbit') {
      this.orbRadius = def.orbRadius * (m?.orbRadiusMult ?? 1) * size;
      this.angularSpeed = def.angularSpeed * (m?.angularSpeedMult ?? 1) * velocity;
      // L'orbite ne grandit pas avec la Taille : seuls les orbes grossissent.
      this.orbitDistance = orbitDistance * (m?.orbitDistanceMult ?? 1);
    }
    if (def.kind === 'projectile') {
      this.projectileSpeed = def.projectileSpeed * velocity;
      this.projectileRadius = def.projectileRadius * size;
      // Durée de vie fixe : plus rapide = porte plus loin (et vise plus loin).
      this.range = this.projectileSpeed * def.projectileLifetime;
      this.explosionRadius = (m?.explosion?.radius ?? 0) * size;
    }
    // La Hâte accélère les tirs et les brûlures d'aura. L'orbite n'a pas de cooldown.
    this.cooldown =
      def.kind === 'orbit'
        ? 0
        : Math.max(
            MIN_COOLDOWN,
            def.cooldown * (1 + cooldownPct) * (m?.cooldownMult ?? 1) * mods.cooldownMult,
          );
  }
}
