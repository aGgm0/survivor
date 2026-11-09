import { ENEMY_TYPES, type EnemyType } from './enemies';

/**
 * Chances relatives d'apparition de chaque type. Pas de tanks : avec une seule arme au
 * niveau 1, ils sont quasi intuables et bloquaient l'accès au premier level up.
 */
const SPAWN_WEIGHTS: readonly (readonly [EnemyType, number])[] = [
  [ENEMY_TYPES.basic, 4],
  [ENEMY_TYPES.fast, 6],
  [ENEMY_TYPES.tank, 0],
];

// ⚠️ Réglages TEMPORAIRES : remplacés par les vagues (waves.ts) en Phase 4c.
export const SPAWN = {
  /** ennemis qui apparaissent par seconde (2 → 1,2 : on mourait avant le niveau 2) */
  perSecond: 1.2,
  /** au-delà, le spawn automatique s'arrête */
  maxEnemies: 600,
  weights: SPAWN_WEIGHTS,
  /** px au-delà du coin de l'écran où les ennemis apparaissent */
  offscreenMargin: 64,
  /** un ennemi plus loin que (rayon de spawn × ce facteur) est replacé devant le joueur */
  recycleDistanceFactor: 1.5,
  /** ennemis ajoutés par la touche de debug F4 */
  debugBatch: 100,
} as const;

/** Taille de la réserve d'ennemis (au-dessus de maxEnemies pour laisser de la marge au debug F4). */
export const ENEMY_POOL_SIZE = 1000;
