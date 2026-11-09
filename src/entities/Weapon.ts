import type { WeaponDef } from '../data/weapons';

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

  constructor(readonly def: WeaponDef) {}
}
