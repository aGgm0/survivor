// Gemmes d'XP (voir CLAUDE.md § 5.6).

/**
 * Réserve de gemmes au sol. Si elle est pleine, la gemme la plus éloignée du joueur est déplacée
 * sur le lieu du nouveau kill et récupère sa valeur (voir GemSystem.drop).
 */
export const GEM_POOL_SIZE = 1000;

/**
 * Quand la gemme la plus éloignée est déplacée sur un kill (réserve pleine), sa valeur est
 * multipliée par ce facteur : la ramener près du joueur ne doit pas être gratuit.
 * L'XP peut donc devenir fractionnaire (0,5) ; le HUD affiche la partie entière.
 */
export const RELOCATED_GEM_XP_FACTOR = 0.5;

export const GEM_MAGNET = {
  /** px/s : vitesse d'une gemme au moment où l'aimant l'attrape */
  startSpeed: 120,
  /**
   * px/s² : elle accélère ensuite. Elle finit donc toujours par rattraper le joueur,
   * même s'il fuit (200 px/s).
   */
  acceleration: 1400,
} as const;

/** Apparence selon la valeur, par ordre croissant : le plus haut palier atteint l'emporte. */
export interface GemTier {
  readonly minValue: number;
  /** px, demi-diagonale du losange */
  readonly size: number;
  readonly color: string;
}

export const GEM_TIERS: readonly GemTier[] = [
  { minValue: 1, size: 7, color: '#4fc3f7' }, // bleu : basique, rapide
  { minValue: 5, size: 9, color: '#b388ff' }, // violet : tank
  { minValue: 20, size: 12, color: '#ffd54f' }, // or : grosses gemmes fusionnées
];
