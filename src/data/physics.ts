// Réglages du mouvement de la horde (steering). Voir systems/MovementSystem.ts.
export const CROWD = {
  /**
   * px/s de répulsion entre deux ennemis qui se chevauchent complètement (moitié si à moitié).
   * Plus haut = horde plus "aérée" ; trop haut = ennemis qui s'éjectent.
   */
  separationSpeed: 220,
  /** Plafond de la répulsion totale (somme de tous les voisins), en px/s. */
  maxSeparationSpeed: 400,
  /**
   * La répulsion se raidit avec le chevauchement (r / (1 - r)) ; au-delà de ce chevauchement,
   * elle arrête de grimper (évite une division par zéro quand ils sont superposés).
   */
  maxStiffOverlap: 0.75,
  /**
   * px/s² : de combien la vitesse peut changer par seconde. C'est ce qui lisse le mouvement.
   * Plus bas = plus "glissant" et doux ; plus haut = plus nerveux.
   */
  maxAcceleration: 900,
  /**
   * Quand un plus gros le pousse par derrière, un ennemi réduit son envie d'avancer de
   * (pression × ce facteur). La pression dépend du chevauchement et de l'écart de masse.
   * 0 = jamais ; plus haut = les petits laissent passer les gros plus facilement.
   */
  yieldStrength: 2,
  /**
   * Accentue l'effet de la taille dans les poussées. 1 = proportionnel aux masses ;
   * 2 = un petit ne freine presque plus un gros, qui traverse la mêlée.
   */
  massContrast: 2,
  /**
   * File d'attente : un ennemi bloqué par un voisin (aussi gros ou plus gros) devant lui réduit
   * son envie d'avancer de (chevauchement × ce facteur). Évite que toute la foule écrase les
   * premiers rangs. 0 = désactivé ; 3 = il s'arrête dès 33 % de chevauchement.
   */
  queueStrength: 3,
  /** Cône "devant moi" : cos de l'angle max (0,5 = ±60° autour de la direction du joueur). */
  queueConeCos: 0.5,
} as const;
