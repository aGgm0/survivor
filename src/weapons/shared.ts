// Petits outils communs aux comportements d'armes.

import type { SpriteTint } from '../core/SpriteAtlas';
import type { MutationDef } from '../data/weapons';
import type { WeaponModifiers } from '../entities/Weapon';
import { formatNumber } from '../ui/formatNumber';

/** Tolérance des comparaisons de temps et d'angle en virgule flottante */
export const FLOAT_EPSILON = 1e-9;

/** En dessous, le cooldown deviendrait absurde (tir à chaque update). */
const MIN_COOLDOWN = 0.05;

/** Délai final : base, bonus des niveaux, mutation, puis Hâte du joueur. */
export function scaledCooldown(
  base: number,
  cooldownPct: number,
  mutation: MutationDef | null,
  mods: WeaponModifiers,
): number {
  return Math.max(
    MIN_COOLDOWN,
    base * (1 + cooldownPct) * (mutation?.cooldownMult ?? 1) * mods.cooldownMult,
  );
}

/** Délai d'une carte de level up : « 1,2 s ». */
export function cooldownStat(cooldown: number): [string, string] {
  return ['délai', `${formatNumber(cooldown, 2)} s`];
}

/**
 * Teinte « multiply » à la couleur d'une arme. Une seule par couleur, créée la première fois puis
 * gardée : c'est l'objet qui sert de clé à la copie teintée de l'atlas.
 */
const WEAPON_TINTS = new Map<string, SpriteTint>();
export function weaponTint(color: string): SpriteTint {
  let tint = WEAPON_TINTS.get(color);
  if (!tint) {
    tint = { color, mode: 'multiply' };
    WEAPON_TINTS.set(color, tint);
  }
  return tint;
}
