import { ENEMY_TYPES, type EnemyType } from './enemies';

// Vagues (voir CLAUDE.md § 5.7) : par tranche de temps, quels ennemis, à quel rythme, quels PV.
// Remplacent le spawn temporaire des phases 2 et 3.

export interface WaveDef {
  /** s : début de la tranche (la tranche dure jusqu'au début de la suivante) */
  readonly start: number;
  /** ennemis qui apparaissent par seconde */
  readonly perSecond: number;
  /** chances relatives d'apparition de chaque type */
  readonly weights: readonly (readonly [EnemyType, number])[];
  /** multiplicateur des PV de base (les ennemis tardifs encaissent plus) */
  readonly hpMult: number;
  /** multiplicateur de vitesse (paliers : les ennemis de fin de partie sont plus rapides) */
  readonly speedMult: number;
}

const { basic, fast, tank } = ENEMY_TYPES;

/** Triées par `start` croissant. La dernière vague dure jusqu'à la fin de la partie. */
export const WAVES: readonly WaveDef[] = [
  // 0:00 – 2:00 : pas de tanks, le temps d'obtenir une 2e arme
  {
    start: 0,
    perSecond: 1.5,
    weights: [
      [basic, 4],
      [fast, 6],
    ],
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
    perSecond: 9,
    weights: [
      [basic, 4],
      [fast, 4],
      [tank, 2],
    ],
    hpMult: 2,
    speedMult: 1.15,
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
    hpMult: 2.5,
    speedMult: 1.3,
  },
];

/**
 * s : instants d'apparition d'un boss (5:00 et 9:00). Le boss garde ses PV de base (1000,
 * comme le brief), sans le multiplicateur de la vague.
 */
export const BOSS_TIMES: readonly number[] = [300, 540];
export const BOSS_TYPE = ENEMY_TYPES.boss;

/** Vague active à l'instant `time` (s). */
export function waveAt(time: number): WaveDef {
  let current = WAVES[0];
  for (const wave of WAVES) if (time >= wave.start) current = wave;
  if (!current) throw new Error('WAVES vide');
  return current;
}
