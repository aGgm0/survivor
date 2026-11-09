import { MIN_DAMAGE } from '../data/combat';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';

/**
 * Dégâts réellement subis : l'armure retire un montant fixe, mais un coup fait toujours
 * au moins MIN_DAMAGE (sinon 3 points d'armure rendraient immunisé aux ennemis rapides).
 */
export function computeDamage(raw: number, armor: number): number {
  return Math.max(MIN_DAMAGE, raw - armor);
}

/** Ce que la scène veut savoir des coups portés aux ennemis (retour visuel, kills, gemmes...). */
export interface HitEvents {
  /** Un ennemi vient d'être touché (appelé à chaque coup, y compris le coup fatal). */
  onHit(enemy: Enemy, damage: number): void;
  /** Un ennemi tombe à 0 PV : la scène le retire, compte le kill, etc. */
  onKill(enemy: Enemy): void;
}

/**
 * Blesse un ennemi avec une arme. Point de passage unique pour toutes les armes
 * (projectile, aura, orbite) : les stats du damage meter restent cohérentes.
 */
export function damageEnemy(source: Weapon, enemy: Enemy, amount: number, events: HitEvents): void {
  // Seuls les dégâts réellement utiles comptent : 10 sur un ennemi à 3 PV = 3.
  source.totalDamage += Math.min(amount, enemy.hp);
  enemy.hp -= amount;
  events.onHit(enemy, amount);
  if (enemy.hp <= 0) {
    source.kills++;
    events.onKill(enemy);
  }
}
