// Réglages généraux de l'apparition des ennemis. Le rythme et les types par moment de la
// partie sont dans waves.ts.
export const SPAWN = {
  /**
   * Au-delà, le spawn automatique s'arrête (perf) ; les boss apparaissent quand même.
   * 600 → 900 : en fin de partie la horde plafonnait et l'écran se vidait.
   */
  maxEnemies: 900,
  /** px au-delà du coin de l'écran où les ennemis apparaissent */
  offscreenMargin: 64,
  /** un ennemi plus loin que (rayon de spawn × ce facteur) est replacé devant le joueur */
  recycleDistanceFactor: 1.5,
  /** ennemis ajoutés par la touche de debug F4 (tirés selon la vague en cours) */
  debugBatch: 100,
} as const;

/** Taille de la réserve d'ennemis (au-dessus de maxEnemies pour laisser de la marge au debug F4). */
export const ENEMY_POOL_SIZE = 1300;
