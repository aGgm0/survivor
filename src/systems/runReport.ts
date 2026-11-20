import type { Weapon } from '../entities/Weapon';
import type { WeaponReport } from '../types/RunReport';

/**
 * Le "damage meter" : chaque arme avec ses dégâts, ses kills et sa part du total,
 * triées par dégâts décroissants. Calculé une seule fois, à la fin de la partie.
 */
export function buildDamageReport(weapons: readonly Weapon[]): WeaponReport[] {
  const total = weapons.reduce((sum, w) => sum + w.totalDamage, 0);
  return weapons
    .map((w) => ({
      id: w.def.id,
      name: w.mutation ? `★ ${w.displayName}` : w.displayName,
      color: w.color,
      level: w.level,
      damage: Math.round(w.totalDamage),
      kills: w.kills,
      share: total > 0 ? w.totalDamage / total : 0,
    }))
    .sort((a, b) => b.damage - a.damage);
}
