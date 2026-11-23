// Registre des comportements d'armes : un module par type (`kind` dans data/weapons.ts).
// TypeScript refuse de compiler s'il manque le module d'un type.

import type { WeaponDef } from '../data/weapons';
import { AURA_BEHAVIOR } from './aura';
import { BOOMERANG_BEHAVIOR } from './boomerang';
import { CHAIN_BEHAVIOR } from './chain';
import { MELEE_BEHAVIOR } from './melee';
import { ORBIT_BEHAVIOR } from './orbit';
import { PROJECTILE_BEHAVIOR } from './projectile';
import { ZONE_BEHAVIOR } from './zone';
import type { DefOf, WeaponBehavior, WeaponKind } from './WeaponBehavior';

const WEAPON_BEHAVIORS: { readonly [K in WeaponKind]: WeaponBehavior<DefOf<K>> } = {
  projectile: PROJECTILE_BEHAVIOR,
  aura: AURA_BEHAVIOR,
  orbit: ORBIT_BEHAVIOR,
  melee: MELEE_BEHAVIOR,
  chain: CHAIN_BEHAVIOR,
  boomerang: BOOMERANG_BEHAVIOR,
  zone: ZONE_BEHAVIOR,
};

/** Le comportement du type de cette arme. Il ne reçoit que des définitions de son type. */
export function behaviorOf(def: WeaponDef): WeaponBehavior {
  return WEAPON_BEHAVIORS[def.kind];
}
