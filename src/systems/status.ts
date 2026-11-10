import type { Pool } from '../core/Pool';
import { STATUS } from '../data/status';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';
import { damageEnemy, type HitEvents } from './damage';

/**
 * Effets d'état : un ennemi peut être ralenti ou empoisonné pendant un temps donné.
 * Chaque effet est une valeur + une date de fin (en temps de partie). Plutôt que de décompter
 * des minuteurs sur chaque ennemi, on compare simplement `now` à cette date.
 */

/**
 * Ralentit de `amount` (0,3 = 30 %) pendant `duration` s. Si l'ennemi est déjà ralenti,
 * on garde le plus fort ralentissement et la fin la plus tardive (pas de cumul infini).
 */
export function applySlow(enemy: Enemy, amount: number, duration: number, now: number): void {
  if (now >= enemy.slowUntil) enemy.slowAmount = 0; // l'ancien ralentissement est terminé
  enemy.slowAmount = Math.max(enemy.slowAmount, amount);
  enemy.slowUntil = Math.max(enemy.slowUntil, now + duration);
}

/**
 * Empoisonne : `dps` dégâts par seconde pendant `duration` s, attribués à `source`.
 * Un nouvel empoisonnement renouvelle la durée (sans cumuler les dégâts).
 */
export function applyPoison(
  enemy: Enemy,
  dps: number,
  duration: number,
  source: Weapon,
  now: number,
): void {
  const alreadyPoisoned = now < enemy.poisonUntil;
  enemy.poisonDps = alreadyPoisoned ? Math.max(enemy.poisonDps, dps) : dps;
  enemy.poisonUntil = Math.max(enemy.poisonUntil, now + duration);
  enemy.poisonSource = source;
  // Premier dégât une demi-période après l'empoisonnement (pas instantané : le coup d'arme
  // qui empoisonne vient déjà d'infliger ses propres dégâts).
  if (!alreadyPoisoned) enemy.nextPoisonTickAt = now + STATUS.poisonTick;
}

/** Multiplicateur de vitesse dû au ralentissement (1 = normal). */
export function slowFactor(enemy: Enemy, now: number): number {
  return now < enemy.slowUntil ? 1 - enemy.slowAmount : 1;
}

/** Tolérance pour comparer des temps additionnés (0,5 + 0,5 + ... n'est pas exact en flottant). */
const TICK_EPSILON = 1e-6;

/** Fait agir le poison : toutes les `poisonTick` secondes, `dps × poisonTick` dégâts. */
export class StatusSystem {
  constructor(private readonly events: HitEvents) {}

  update(enemies: Pool<Enemy>, now: number): void {
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active || !e.poisonSource) continue;
      if (now < e.nextPoisonTickAt) continue;
      // Un tick qui tombe pile à la fin compte : 6 dégâts/s pendant 3 s = 6 ticks = 18 dégâts.
      if (e.nextPoisonTickAt > e.poisonUntil + TICK_EPSILON) {
        e.poisonSource = null; // poison terminé
        continue;
      }
      e.nextPoisonTickAt += STATUS.poisonTick;
      // Pas de recul pour le poison (direction nulle).
      damageEnemy(e.poisonSource, e, e.poisonDps * STATUS.poisonTick, this.events, 0, 0, 'poison');
    }
  }
}
