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

/**
 * Apparence d'une aura : un anneau de braises carrées (pixels de 2 px) posé sur le bord de la
 * zone qui brûle, qui tourne et scintille, et des étincelles qui montent de l'intérieur.
 * Le rayon reste exactement celui des dégâts : seul le dessin change.
 */
export interface AuraLook {
  /** Braises : claire, moyenne, sombre (le scintillement passe de l'une à l'autre) */
  readonly colors: readonly [string, string, string];
  /** Opacité du disque intérieur (juste assez pour voir la zone) */
  readonly fillAlpha: number;
  /** px entre deux braises sur le bord (leur nombre suit le rayon) */
  readonly emberSpacing: number;
  /** px, côté d'une braise */
  readonly emberSize: number;
  /** rad/s, rotation de l'anneau (négatif = sens inverse) */
  readonly spin: number;
  /**
   * Étincelles émises par seconde, couleur, vitesse de départ vers le haut (px/s : le freinage
   * des particules la fait vite tomber, elles montent d'environ vitesse / 5 px), durée, taille
   */
  readonly sparksPerSecond: number;
  readonly sparkColor: string;
  readonly sparkRise: number;
  readonly sparkLife: number;
  readonly sparkSize: number;
}

/** Par id d'arme ou de mutation (la mutation remplace l'apparence de l'arme). */
export const AURA_LOOKS: Readonly<Record<string, AuraLook | undefined>> = {
  burningAura: {
    colors: ['#ffd27a', '#ff7a3d', '#b8402a'],
    fillAlpha: 0.07,
    emberSpacing: 8,
    emberSize: 6,
    spin: 0.5,
    sparksPerSecond: 12,
    sparkColor: '#ffb347',
    sparkRise: 170,
    sparkLife: 0.7,
    sparkSize: 4,
  },
  // Brasier : plus grand, plus dense, plus vif
  blaze: {
    colors: ['#fff0a8', '#ffb347', '#e0582a'],
    fillAlpha: 0.08,
    emberSpacing: 7,
    emberSize: 6,
    spin: 0.35,
    sparksPerSecond: 24,
    sparkColor: '#ffd27a',
    sparkRise: 200,
    sparkLife: 0.8,
    sparkSize: 4,
  },
  // Aura toxique : verte, tourne dans l'autre sens, bulles lentes au lieu d'étincelles
  toxicAura: {
    colors: ['#c8ff8a', '#7cd94a', '#2f7a2a'],
    fillAlpha: 0.08,
    emberSpacing: 9,
    emberSize: 6,
    spin: -0.3,
    sparksPerSecond: 10,
    sparkColor: '#9dff6a',
    sparkRise: 110,
    sparkLife: 1.1,
    sparkSize: 4,
  },
};

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
