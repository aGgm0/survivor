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
  /** s avant de pouvoir tirer ; ≤ 0 = prête */
  cooldownTimer = 0;
  /** Dégâts réellement infligés (sans l'excédent sur un ennemi déjà presque mort) */
  totalDamage = 0;
  kills = 0;

  // Stats actuelles = base + bonus des niveaux + passifs du joueur. Recalculées par
  // `recompute()` seulement quand elles changent (level up), pas à chaque tir.
  damage: number;
  cooldown: number;
  projectileCount: number;

  constructor(readonly def: WeaponDef) {
    this.damage = def.damage;
    this.cooldown = def.cooldown;
    this.projectileCount = def.projectileCount;
  }

  recompute(mods: WeaponModifiers): void {
    let damage = this.def.damage;
    let projectiles = this.def.projectileCount;
    let cooldownPct = 0;
    // Bonus des niveaux 2 à `level` (index 0 = niveau 2).
    for (let i = 0; i < this.level - 1; i++) {
      const bonus = this.def.levels[i];
      if (!bonus) continue;
      damage += bonus.damage ?? 0;
      projectiles += bonus.projectiles ?? 0;
      cooldownPct += bonus.cooldownPct ?? 0;
    }
    this.damage = damage * mods.damageMult;
    this.projectileCount = projectiles;
    this.cooldown = Math.max(
      MIN_COOLDOWN,
      this.def.cooldown * (1 + cooldownPct) * mods.cooldownMult,
    );
  }
}
