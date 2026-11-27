import { ENEMY_TYPES } from './enemies';
import type { MusicName } from './audio';
import { FLOOR } from './sprites';
import type { BonusWaveDef, BossSpawn, EliteSpawn, WaveDef } from './waves';

// Niveaux (« stages ») : tout ce qui fait le déroulement d'un niveau, rangé au même endroit.
// Un 2e niveau (après la 1.0) ou le niveau de 30 min (0.4) = une nouvelle entrée, sans toucher
// aux systèmes. Les règles communes (sans fin, capacités des boss) restent dans waves.ts.

/** Sol d'un niveau : dalles tirées au hasard (même forme que FLOOR, data/sprites.ts). */
export type FloorDef = typeof FLOOR;

export interface StageDef {
  readonly id: string;
  /** s : survivre jusque-là (et tuer le dernier boss) = victoire */
  readonly duration: number;
  /** Triées par `start` ; la dernière dure jusqu'à la fin (et sert de base au sans fin) */
  readonly waves: readonly WaveDef[];
  /** Rushs, en plus de la vague normale */
  readonly bonusWaves: readonly BonusWaveDef[];
  /** Mini-boss, triés par instant */
  readonly elites: readonly EliteSpawn[];
  /** Boss, triés par instant ; le dernier sert de modèle aux boss du sans fin */
  readonly bosses: readonly BossSpawn[];
  readonly floor: FloorDef;
  readonly music: { readonly run: MusicName; readonly boss: MusicName };
}

// ------------------------------------------------------------------ Donjon (le niveau de 10 min)

const { basic, fast, tank } = ENEMY_TYPES;

/** Les 2 premières minutes : basiques et rapides, sans tanks */
const OPENING_WEIGHTS: WaveDef['weights'] = [
  [basic, 4],
  [fast, 6],
];

/** Triées par `start` croissant. La dernière vague dure jusqu'à la fin de la partie. */
const DUNGEON_WAVES: readonly WaveDef[] = [
  // 0:00 – 0:30 : ouverture calme (retour de jeu 2026-11-18 : trop de monde d'entrée)
  {
    start: 0,
    perSecond: 0.8,
    weights: OPENING_WEIGHTS,
    hpMult: 1,
    speedMult: 1,
  },
  // 0:30 – 2:00 : pas de tanks, le temps d'obtenir une 2e arme
  {
    start: 30,
    perSecond: 1.5,
    weights: OPENING_WEIGHTS,
    hpMult: 1,
    speedMult: 1,
  },
  // 2:00 – 4:00 : les tanks arrivent
  {
    start: 120,
    perSecond: 2.5,
    weights: [
      [basic, 5],
      [fast, 4],
      [tank, 1],
    ],
    hpMult: 1.2,
    speedMult: 1,
  },
  // 4:00 – 6:00
  {
    start: 240,
    perSecond: 3.5,
    weights: [
      [basic, 5],
      [fast, 3],
      [tank, 2],
    ],
    hpMult: 1.5,
    speedMult: 1,
  },
  // 6:00 – 8:00 : 1er palier de vitesse, la horde grossit
  {
    start: 360,
    perSecond: 7, // 9 → 7 (0.1.1) : marche moins brutale après 3,5/s (avec le rush : 16 → 11/s)
    weights: [
      [basic, 4],
      [fast, 4],
      [tank, 2],
    ],
    hpMult: 2.5, // était 2 : trop facile avec des armes mutées
    speedMult: 1.25, // était 1,15
  },
  // 8:00 – 10:00 : le rush final, une horde de petits rapides à faucher
  {
    start: 480,
    // 16/s : un build au max tue ~11/s quand la horde arrive et 30-40/s quand elle est dense ;
    // à 11/s il ne restait que ~70 ennemis à l'écran, pas une "horde de fou".
    perSecond: 16,
    weights: [
      [basic, 4],
      [fast, 5],
      [tank, 1],
    ],
    hpMult: 3.5, // était 2,5
    speedMult: 1.45, // était 1,3
  },
];

/** Demandé : des déferlantes courtes de petits ennemis, pour casser le rythme. */
const DUNGEON_BONUS_WAVES: readonly BonusWaveDef[] = [
  // 2:00 – 2:30 : nuée de rapides (≈ 150), juste quand les tanks arrivent (8/s → 5/s : trop dense)
  { start: 120, end: 150, type: fast, perSecond: 5 },
  // 6:00 – 6:30 : marée de basiques (≈ 120), avec le 1er palier de vitesse (12/s → 7/s → 4/s).
  // 0.1.1 : avec la vague de 6:00, on passait de 3,5 à 16 ennemis/s d'un coup (retour de testeur :
  // « violent vers 6:30 »). Pas décalé à 6:30 : il tomberait sur le basique élite de 7:00.
  { start: 360, end: 390, type: basic, perSecond: 4 },
];

/** Mini-boss : PV et vitesse de la vague en cours. */
const DUNGEON_ELITES: readonly EliteSpawn[] = [
  { time: 180, type: ENEMY_TYPES.fastElite }, // 3:00
  { time: 420, type: ENEMY_TYPES.basicElite }, // 7:00
];

/**
 * Boss de la partie, triés par instant. Retour de jeu : à 1000 PV ils mouraient trop vite face
 * à des armes mutées → 3000 PV à 5:00, 8000 PV (et +20 % de vitesse) à 9:00. Puis −20 % sur
 * les deux (2400 et 6400 PV) avec 4 passifs max. Enfin 3000 et 9000 PV : depuis que chaque orbe
 * frappe (délai par orbe), le boss fondait.
 */
const DUNGEON_BOSSES: readonly BossSpawn[] = [
  { time: 300, type: ENEMY_TYPES.boss, summons: false, hpMult: 3, speedMult: 1 },
  // 9:00 (2026-11-21, « il faut de la pression ») : marche ×1,2 → ×2 (140 px/s, toi 200),
  // annonce de la charge 0,8 → 0,5 s, charge gardée à ~295 px (calculée sur l'ancienne vitesse).
  // Armure 30 / 30 → 60 / 60 (2026-11-27, demandé) : −38 % au lieu de −23 % sans pénétration.
  {
    time: 540,
    type: ENEMY_TYPES.boss,
    summons: true,
    hpMult: 9,
    speedMult: 2,
    chargeWindup: 0.5,
    dashSpeedMult: 1.2,
    resistances: { physical: 60, magical: 60 },
  },
];

/** Le donjon des démons : le seul niveau pour l'instant (10 min, boss à 5:00 et 9:00). */
export const DUNGEON: StageDef = {
  id: 'dungeon',
  duration: 600,
  waves: DUNGEON_WAVES,
  bonusWaves: DUNGEON_BONUS_WAVES,
  elites: DUNGEON_ELITES,
  bosses: DUNGEON_BOSSES,
  floor: FLOOR,
  music: { run: 'run', boss: 'boss' },
};

/** Niveau joué quand rien n'en choisit un autre */
export const DEFAULT_STAGE = DUNGEON;
