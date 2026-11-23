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
 * Un ennemi résistant n'en subit qu'une partie : `slowResist` 0,85 = 85 % de moins. Celle du
 * type (élites et boss : 100 %, insensibles) et celle du sans fin se cumulent.
 */
export function applySlow(enemy: Enemy, amount: number, duration: number, now: number): void {
  if (now >= enemy.slowUntil) enemy.slowAmount = 0; // l'ancien ralentissement est terminé
  const effective = amount * (1 - (enemy.type.slowResist ?? 0)) * (1 - enemy.slowResist);
  enemy.slowAmount = Math.max(enemy.slowAmount, effective);
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
  // Premier tick tout de suite, comme l'aura qui brûle dès l'entrée (retour de jeu).
  // Un renouvellement garde le rythme en cours (pas de tick bonus à chaque renouvellement).
  if (!alreadyPoisoned) enemy.nextPoisonTickAt = now;
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
      // Ticks à 0 / 0,5 / … tant qu'on est AVANT la fin : 6 dégâts/s pendant 3 s =
      // ticks de 0 à 2,5 s = 6 ticks = 18 dégâts (un tick à 3,0 s en ferait 21).
      if (e.nextPoisonTickAt >= e.poisonUntil - TICK_EPSILON) {
        e.poisonSource = null; // poison terminé
        continue;
      }
      e.nextPoisonTickAt += STATUS.poisonTick;
      // Pas de recul pour le poison (direction nulle).
      damageEnemy(e.poisonSource, e, e.poisonDps * STATUS.poisonTick, this.events, 0, 0, 'poison');
    }
  }
}
