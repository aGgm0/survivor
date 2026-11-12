// « Game feel » : retours purement visuels (tremblement, particules). Aucun effet sur le jeu.
import type { ShakeSettings } from '../core/Camera';

/** Tremblement de l'écran : trauma² × maxOffset px, le trauma redescend de `decay` par seconde. */
export const SHAKE: ShakeSettings = {
  decay: 1.6,
  maxOffset: 14,
  frequency: 40,
};

/** Une gerbe de particules : combien, à quelle vitesse, quelle taille, combien de temps. */
export interface BurstSettings {
  readonly count: number;
  /** px/s au départ (tiré entre les deux) */
  readonly speedMin: number;
  readonly speedMax: number;
  /** px (carrés de « gros pixels », comme les sprites ×2) */
  readonly size: number;
  /** s (tirée entre 60 % et 100 %) */
  readonly life: number;
}

export const PARTICLES = {
  /** Réserve : pleine (grosse horde qui meurt d'un coup), les nouvelles sont sautées */
  poolSize: 600,
  /** Freinage (1/s) : les éclats partent vite puis ralentissent */
  drag: 5,
  /** Mort d'un ennemi, couleur de son type ; `perRadius` : éclats en plus par px de rayon */
  death: { count: 4, perRadius: 0.25, speedMin: 60, speedMax: 220, size: 4, life: 0.45 },
  bossDeath: { count: 60, speedMin: 80, speedMax: 420, size: 6, life: 0.9 },
  crate: { count: 8, speedMin: 50, speedMax: 180, size: 4, life: 0.4 },
  crateColor: '#9a6b3f',
  /** Level up : anneau d'étincelles qui part du joueur */
  levelUp: { count: 28, speedMin: 260, speedMax: 300, size: 4, life: 0.5 },
  levelUpColor: '#ffe27a',
} as const;

/** Trauma ajouté par événement ; `cap` : ce choc seul ne monte pas au-dessus. */
export const SHAKE_EVENTS = {
  /** Plafonné : au milieu de la horde, l'écran ne doit pas trembler en continu */
  playerHit: { amount: 0.15, cap: 0.4 },
  bossCharge: { amount: 0.3, cap: 1 },
  eliteKill: { amount: 0.4, cap: 1 },
  bossKill: { amount: 0.7, cap: 1 },
  /** À peine : il y en a beaucoup avec le Trait éclaté */
  explosion: { amount: 0.04, cap: 0.2 },
} as const;
