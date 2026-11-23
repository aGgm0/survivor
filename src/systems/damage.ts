import { KNOCKBACK, MIN_DAMAGE, resistReduction } from '../data/combat';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';

/** `direct` : coup d'arme ; `poison` : dégâts d'un effet d'état (affichés en vert, sans recul). */
export type HitKind = 'direct' | 'poison';

/** Ce que la scène veut savoir des coups portés aux ennemis (retour visuel, kills, gemmes...). */
export interface HitEvents {
  /**
   * Un ennemi vient d'être touché (appelé à chaque coup, y compris le coup fatal).
   * `source` : l'arme qui frappe (le bruitage dépend de l'arme). `reduction` : part des dégâts
   * retirée par la résistance de l'ennemi (0 à 1), pour l'affichage.
   */
  onHit(enemy: Enemy, damage: number, kind: HitKind, source: Weapon, reduction: number): void;
  /** Un ennemi tombe à 0 PV : la scène le retire, compte le kill, etc. */
  onKill(enemy: Enemy): void;
  /** Optionnel : une explosion a eu lieu (pour l'effet visuel). */
  onExplosion?(x: number, y: number, radius: number, color: string): void;
  /** Optionnel : souffle d'une aura (Fournaise), pour l'effet visuel, le son et le tremblement. */
  onAuraPulse?(x: number, y: number, radius: number, color: string): void;
  /** Optionnel : un coup d'estoc (traînée de pixels le long de la ligne). Mêmes paramètres qu'`onSlash`. */
  onThrust?(x: number, y: number, angle: number, arc: number, range: number, color: string): void;
  /** Optionnel : un coup d'épée (pour l'effet visuel). `angle` = direction, `arc` = ouverture (rad). */
  onSlash?(x: number, y: number, angle: number, arc: number, range: number, color: string): void;
  /** Optionnel : une arme à projectiles vient de tirer (pour le bruitage). */
  onFire?(weapon: Weapon): void;
}

/** Marge de l'arrondi des dégâts (erreurs de calcul en virgule flottante) */
const DAMAGE_CEIL_EPSILON = 1e-6;

/**
 * Blesse un ennemi avec une arme. Point de passage unique pour toutes les armes
 * (projectile, aura, orbite) : les stats du damage meter et le recul restent cohérents.
 * (`dirX`, `dirY`) : direction du recul, de longueur 1 (ex. sens du projectile).
 * Les dégâts sont réduits par la résistance de l'ennemi au type de l'arme (moins sa
 * pénétration), puis arrondis à l'entier supérieur ; jamais moins de MIN_DAMAGE.
 */
export function damageEnemy(
  source: Weapon,
  enemy: Enemy,
  amount: number,
  events: HitEvents,
  dirX: number,
  dirY: number,
  kind: HitKind = 'direct',
): void {
  // Résistance de l'ennemi au type de l'arme, moins la pénétration de l'arme.
  const resistance = enemy.type.resistances?.[source.damageType] ?? 0;
  const reduction = resistance > 0 ? resistReduction(resistance, source.penetration) : 0;
  amount *= 1 - reduction;
  // Arrondi à l'entier supérieur : un petit bonus en % (Puissance, boutique) compte toujours.
  // La marge évite qu'une erreur de virgule (16,0000001) ne coûte un point de plus.
  amount = Math.max(MIN_DAMAGE, Math.ceil(amount - DAMAGE_CEIL_EPSILON));
  // Seuls les dégâts réellement utiles comptent : 10 sur un ennemi à 3 PV = 3.
  // Le mobilier ne compte ni dans le damage meter ni dans les kills (défis des persos).
  const prop = enemy.type.prop === true;
  if (!prop) source.totalDamage += Math.min(amount, enemy.hp);
  enemy.hp -= amount;
  events.onHit(enemy, amount, kind, source, reduction);
  if (enemy.hp <= 0) {
    if (!prop) source.kills++;
    events.onKill(enemy);
    return;
  }
  applyKnockback(enemy, source.knockback, dirX, dirY);
}

/** Masse de l'ennemi de référence (rayon², comme dans la physique de la horde). */
const REFERENCE_MASS = KNOCKBACK.referenceRadius * KNOCKBACK.referenceRadius;

/**
 * Le recul s'ajoute à la VITESSE de l'ennemi (pas à sa position) : il est projeté, puis son
 * accélération limitée le ramène vers le joueur en douceur. Pas de téléportation, pas de saut.
 * Plus l'ennemi est lourd, moins il recule.
 */
export function applyKnockback(enemy: Enemy, force: number, dirX: number, dirY: number): void {
  if (force <= 0 || enemy.type.knockbackImmune) return;
  // Multiplicateur global (réglage du « ressenti » de toutes les armes à la fois).
  const factor =
    KNOCKBACK.forceMult *
    (enemy.type.knockbackFactor ?? Math.min(KNOCKBACK.maxFactor, REFERENCE_MASS / enemy.mass));
  // Sans fin : les ennemis résistent de plus en plus au recul.
  const kept = factor * (1 - enemy.knockbackResist);
  enemy.vx += dirX * force * kept;
  enemy.vy += dirY * force * kept;
}
