import type { WeaponDef } from '../data/weapons';

/** Multiplicateurs venant du joueur (passifs), appliqués à toutes ses armes. */
export interface WeaponModifiers {
  readonly damageMult: number;
  readonly cooldownMult: number;
}

/** En dessous, le cooldown deviendrait absurde (tir à chaque update). */
const MIN_COOLDOWN = 0.05;

/**
 * Une arme possédée par le joueur : sa définition (stats fixes) + son état pendant la partie.
 * Les stats de dégâts/kills servent au futur "damage meter" (classement des armes).
 */
export class Weapon {
  level = 1;
  /** s avant de pouvoir tirer / frapper ; ≤ 0 = prête (projectile, aura) */
  cooldownTimer = 0;
  /** Angle actuel des orbes (orbite), et celui de l'update précédente pour l'interpolation */
  angle = 0;
  prevAngle = 0;
  /** Dégâts réellement infligés (sans l'excédent sur un ennemi déjà presque mort) */
  totalDamage = 0;
  kills = 0;

  // Stats actuelles = base + bonus des niveaux + passifs du joueur. Recalculées par
  // `recompute()` seulement quand elles changent (level up), pas à chaque tir.
  damage: number;
  /** s entre deux tirs (projectile) ou deux ticks (aura) ; inutilisé pour l'orbite */
  cooldown: number;
  /** Projectiles par tir (projectile) ou nombre d'orbes (orbite) */
  count: number;
  /** px, rayon de l'aura */
  radius: number;

  constructor(readonly def: WeaponDef) {
    this.damage = def.damage;
    this.cooldown = def.kind === 'orbit' ? 0 : def.cooldown;
    this.count = def.kind === 'aura' ? 0 : def.count;
    this.radius = def.kind === 'aura' ? def.radius : 0;
  }

  recompute(mods: WeaponModifiers): void {
    const def = this.def;
    let damage = def.damage;
    let count = def.kind === 'aura' ? 0 : def.count;
    let radius = def.kind === 'aura' ? def.radius : 0;
    let cooldownPct = 0;
    // Bonus des niveaux 2 à `level` (index 0 = niveau 2).
    for (let i = 0; i < this.level - 1; i++) {
      const bonus = def.levels[i];
      if (!bonus) continue;
      damage += bonus.damage ?? 0;
      count += bonus.count ?? 0;
      radius += bonus.radius ?? 0;
      cooldownPct += bonus.cooldownPct ?? 0;
    }
    this.damage = damage * mods.damageMult;
    this.count = count;
    this.radius = radius;
    // La Hâte accélère les tirs et les ticks d'aura. L'orbite n'a pas de cooldown.
    this.cooldown =
      def.kind === 'orbit'
        ? 0
        : Math.max(MIN_COOLDOWN, def.cooldown * (1 + cooldownPct) * mods.cooldownMult);
  }
}
