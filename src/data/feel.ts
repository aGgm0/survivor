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
  /**
   * px : une braise sur deux est rentrée d'autant vers l'intérieur (anneau sur 2 rangs).
   * 0 = un seul rang, anneau fin.
   */
  readonly emberInset: number;
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

/**
 * Par id d'arme ou de mutation (la mutation remplace l'apparence de l'arme).
 * 0.1.1 : anneau fin (braises 6 → 4 px sur un seul rang), disque et étincelles divisés par 2.
 * Retour de testeur : l'aura cachait les petits monstres. Le rayon des dégâts ne change pas.
 */
export const AURA_LOOKS: Readonly<Record<string, AuraLook | undefined>> = {
  burningAura: {
    colors: ['#ffd27a', '#ff7a3d', '#b8402a'],
    fillAlpha: 0.03,
    emberSpacing: 8,
    emberSize: 4,
    emberInset: 0,
    spin: 0.5,
    sparksPerSecond: 6,
    sparkColor: '#ffb347',
    sparkRise: 170,
    sparkLife: 0.7,
    sparkSize: 4,
  },
  // Aura de givre : bleu glacé, tourne lentement, flocons qui montent à peine et durent
  frostAura: {
    colors: ['#e8f8ff', '#8fd8ff', '#3a78b8'],
    fillAlpha: 0.05,
    emberSpacing: 8,
    emberSize: 4,
    emberInset: 0,
    spin: -0.2,
    sparksPerSecond: 8,
    sparkColor: '#d8f4ff',
    sparkRise: 60,
    sparkLife: 1.3,
    sparkSize: 4,
  },
  // Fournaise : rouge profond, braises vives ; le souffle lui-même est dessiné à part (AURA_PULSE)
  furnace: {
    colors: ['#ffe08a', '#ff5a1f', '#9a2414'],
    fillAlpha: 0.03,
    emberSpacing: 7,
    emberSize: 4,
    emberInset: 0,
    spin: 0.8,
    sparksPerSecond: 0, // rien de permanent : seulement l'onde et ses flammes
    sparkColor: '#ff8a3d',
    sparkRise: 220,
    sparkLife: 0.6,
    sparkSize: 4,
  },
};

/**
 * Onde de la Fournaise (retour de jeu : l'explosion violette « bizarre », on ne voyait pas le
 * feu). Rien de permanent autour du joueur : l'anneau de braises suit le front de l'onde (voir
 * `pulse` dans weapons.ts), puis s'éteint en `fade` s ; des flammes jaillissent de sa portée.
 */
export const AURA_PULSE = {
  /** s : l'anneau de l'onde s'éteint en ce temps une fois sa portée atteinte */
  fade: 0.15,
  flames: 46,
  flameColors: ['#fff0a8', '#ffb347', '#ff5a1f', '#c8321a'],
  flameRise: 240,
  flameSpread: 40,
  flameLife: 0.55,
  flameSize: 6,
} as const;

/** Anneau de braises du souffle : plus gros et plus vif que l'anneau de l'aura. */
export const AURA_PULSE_RING: AuraLook = {
  colors: ['#fff6c8', '#ffb347', '#ff5a1f'],
  fillAlpha: 0,
  emberSpacing: 9,
  emberSize: 6,
  emberInset: 6,
  spin: 0,
  sparksPerSecond: 0,
  sparkColor: '#ffb347',
  sparkRise: 0,
  sparkLife: 0,
  sparkSize: 0,
};

/**
 * Contour rouge quand les PV sont bas (part des PV max : les PV max vont de 100 à ~200, un seuil
 * fixe arriverait trop tard). Pulsation plus rapide sous `critical`.
 */
export const LOW_HP = { warn: 0.2, critical: 0.1 } as const;

/**
 * Nombres de dégâts d'un coup réduit par la résistance de l'ennemi : gris au lieu de blanc, à
 * partir de `minReduction` seulement (le basique résiste de 9 % à tout : sans seuil, presque
 * tous les nombres seraient gris et le repère ne voudrait plus rien dire).
 */
export const RESISTED_NUMBERS = { minReduction: 0.15, color: '#9a9a9a' } as const;

/** Trauma ajouté par événement ; `cap` : ce choc seul ne monte pas au-dessus. */
export const SHAKE_EVENTS = {
  /** Plafonné : au milieu de la horde, l'écran ne doit pas trembler en continu */
  playerHit: { amount: 0.15, cap: 0.4 },
  bossCharge: { amount: 0.3, cap: 1 },
  eliteKill: { amount: 0.4, cap: 1 },
  bossKill: { amount: 0.7, cap: 1 },
  /** Souffle de la Fournaise : toutes les 1,5 s, donc léger */
  auraPulse: { amount: 0.08, cap: 0.25 },
  /** À peine : il y en a beaucoup avec le Trait éclaté */
  explosion: { amount: 0.04, cap: 0.2 },
} as const;

/**
 * Annonce de la charge d'un boss, en pixels carrés comme les braises de l'aura (retour de jeu :
 * la bande rouge lisse « ne fait pas DA »). Chevrons qui s'allument du boss vers le bout pendant
 * l'annonce, bords en pointillés (largeur touchée), fissure au point d'arrivée.
 */
export const CHARGE_TELEGRAPH = {
  /** Claire (chevron allumé), moyenne (bords), sombre (chevron éteint, fissure) */
  colors: ['#ffd2c4', '#ff3b3b', '#7a1414'],
  /** px : taille d'un pixel d'annonce (calé sur une grille de 2 px) */
  pixel: 4,
  /** px entre deux chevrons */
  chevronSpacing: 30,
  /** Longueur d'une branche du chevron, en part du rayon du boss */
  chevronArm: 0.45,
  /** px entre deux points des bords */
  edgeSpacing: 10,
  edgeAlpha: 0.7,
  /** Bande très légère sous les pixels : la zone reste lisible entre deux clignotements */
  fillAlpha: 0.08,
  /** Hz : clignotement des chevrons allumés, du début à la fin de l'annonce */
  blinkStart: 3,
  blinkEnd: 12,
  /** Fissure au point d'arrivée : cases (en pixels d'annonce) x, y à la suite, autour du centre */
  crack: [
    0, 0, 1, -1, 2, -1, 3, -2, 4, -2, -1, 1, -2, 1, -2, 2, -3, 3, 1, 1, 1, 2, 2, 3, -1, -1, -1, -2,
    -2, -3, 3, 0, 4, 1,
  ],
} as const;

/** Annonce de l'invocation : anneau de braises violettes qui se resserre sur le cercle d'apparition. */
export const SUMMON_TELEGRAPH = {
  /** Rayon de départ, en multiple du cercle d'apparition des sbires */
  startScale: 1.8,
  /** Opacité au début de l'annonce (monte à 1 à la fin) */
  startAlpha: 0.35,
  look: {
    colors: ['#f0d0ff', '#b14cff', '#5a1a8a'],
    fillAlpha: 0,
    emberSpacing: 9,
    emberSize: 4,
    emberInset: 4,
    spin: -1.2,
    sparksPerSecond: 0,
    sparkColor: '#b14cff',
    sparkRise: 0,
    sparkLife: 0,
    sparkSize: 0,
  } satisfies AuraLook,
} as const;

/**
 * Barres de PV dans le monde : cadre `bar-body` et remplissage `bar-red` du pack Dark Ages (comme
 * la barre du HUD), rectangles en secours. Élites, et le joueur seulement s'il est blessé (le boss a
 * sa grande barre dans le HUD : retour de jeu, une seule barre suffit).
 */
export const HP_BARS = {
  /** `scale` : agrandissement des pixels du pack (×2 comme les sprites) ; `offset` : px d'écart */
  elite: { width: 100, scale: 2, offset: 6 },
  /** Boucliers des résistances à gauche de la barre des élites : taille (px) et écart */
  resistIcon: { size: 16, gap: 4 },
  player: { width: 44, scale: 1, offset: 6 },
  /**
   * Traînée : la part perdue reste claire `hold` s, puis fond vers les PV ; vitesse = `rate` × l'écart
   * par seconde, au moins `minRate` × PV max par seconde (elle finit toujours par rattraper).
   */
  trail: { hold: 0.35, rate: 4, minRate: 0.15, color: '#ffe3a3' },
  /** Secours sans le pack (tests, pack absent) */
  fallback: { background: '#1a1a1a', fill: '#e5484d', outline: '#000', height: 5 },
} as const;

/**
 * Éclair en chaîne : chaque saut est un trait brisé qui s'efface en `life` s. `jag` : écart
 * maximal (px) des coudes de part et d'autre de la ligne droite ; `segments` : coudes par saut.
 */
export const CHAIN_LOOK = {
  life: 0.2,
  jag: 7,
  segments: 4,
  outerWidth: 3,
  innerWidth: 1,
  innerColor: '#ffffff',
} as const;
