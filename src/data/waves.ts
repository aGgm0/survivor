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

/** Les 2 premières minutes : basiques et rapides, sans tanks */
const OPENING_WEIGHTS: WaveDef['weights'] = [
  [basic, 4],
  [fast, 6],
];

/** Triées par `start` croissant. La dernière vague dure jusqu'à la fin de la partie. */
export const WAVES: readonly WaveDef[] = [
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

/**
 * Rushs : pendant [start, end[, un seul type d'ennemi apparaît EN PLUS de la vague normale.
 * Ils prennent les PV et la vitesse de la vague en cours (et respectent le plafond d'ennemis).
 */
export interface BonusWaveDef {
  /** s */
  readonly start: number;
  /** s (exclu) */
  readonly end: number;
  readonly type: EnemyType;
  /** ennemis en plus par seconde */
  readonly perSecond: number;
}

/** Demandé : des déferlantes courtes de petits ennemis, pour casser le rythme. */
export const BONUS_WAVES: readonly BonusWaveDef[] = [
  // 2:00 – 2:30 : nuée de rapides (≈ 150), juste quand les tanks arrivent (8/s → 5/s : trop dense)
  { start: 120, end: 150, type: fast, perSecond: 5 },
  // 6:00 – 6:30 : marée de basiques (≈ 120), avec le 1er palier de vitesse (12/s → 7/s → 4/s).
  // 0.1.1 : avec la vague de 6:00, on passait de 3,5 à 16 ennemis/s d'un coup (retour de testeur :
  // « violent vers 6:30 »). Pas décalé à 6:30 : il tomberait sur le basique élite de 7:00.
  { start: 360, end: 390, type: basic, perSecond: 4 },
];

/** Mini-boss : un ennemi élite à une heure précise, avec les PV et la vitesse de la vague en cours. */
export interface EliteSpawn {
  readonly time: number;
  readonly type: EnemyType;
}

export const ELITE_SPAWNS: readonly EliteSpawn[] = [
  { time: 180, type: ENEMY_TYPES.fastElite }, // 3:00
  { time: 420, type: ENEMY_TYPES.basicElite }, // 7:00
];

export interface BossSpawn {
  /** s : instant d'apparition */
  readonly time: number;
  /** multiplicateur des PV de base du boss (1000) ; l'XP suit, comme pour les vagues */
  readonly hpMult: number;
  readonly speedMult: number;
}

/**
 * Boss de la partie, triés par instant. Retour de jeu : à 1000 PV ils mouraient trop vite face
 * à des armes mutées → 3000 PV à 5:00, 8000 PV (et +20 % de vitesse) à 9:00. Puis −20 % sur
 * les deux (2400 et 6400 PV) avec 4 passifs max. Enfin 3000 et 9000 PV : depuis que chaque orbe
 * frappe (délai par orbe), le boss fondait.
 */
export const BOSS_SPAWNS: readonly BossSpawn[] = [
  { time: 300, hpMult: 3, speedMult: 1 },
  { time: 540, hpMult: 9, speedMult: 1.2 },
];
export const BOSS_TYPE = ENEMY_TYPES.boss;

/** Vague active à l'instant `time` (s). */
export function waveAt(time: number): WaveDef {
  let current = WAVES[0];
  for (const wave of WAVES) if (time >= wave.start) current = wave;
  if (!current) throw new Error('WAVES vide');
  return current;
}

/**
 * Mode sans fin (après la victoire, si le joueur choisit de continuer) : chaque minute écoulée
 * depuis le début du sans fin durcit la dernière vague. Sans ça, un build complet raserait tout.
 */
export const ENDLESS = {
  /** PV ×1,25 par minute, cumulé (×1,56 après 2 min, ×3 vers 5 min) */
  hpGrowthPerMinute: 1.25,
  /** ennemis par seconde en plus, par minute */
  extraPerSecondPerMinute: 2,
  /** vitesse +3 % par minute... */
  speedGrowthPerMinute: 0.03,
  /** ...plafonnée, pour rester jouable */
  maxSpeedMult: 1.8,
  /** s entre deux boss du sans fin (le 1er arrive 3 min après le début) */
  bossInterval: 180,
  /** PV du 1er boss du sans fin = ceux du dernier boss normal × ce facteur, puis × encore à chaque boss */
  bossHpGrowth: 1.5,
} as const;

/** Une vague modifiable : le sans fin la recalcule sur place (pas d'allocation en jeu). */
export interface MutableWave {
  perSecond: number;
  weights: WaveDef['weights'];
  hpMult: number;
  speedMult: number;
}

/**
 * Écrit dans `out` la vague du sans fin `minutes` minutes après son début (peut être décimal :
 * la difficulté monte en continu, pas par paliers).
 */
export function endlessWave(base: WaveDef, minutes: number, out: MutableWave): MutableWave {
  const m = Math.max(0, minutes);
  out.weights = base.weights;
  out.perSecond = base.perSecond + ENDLESS.extraPerSecondPerMinute * m;
  out.hpMult = base.hpMult * ENDLESS.hpGrowthPerMinute ** m;
  out.speedMult = Math.min(
    ENDLESS.maxSpeedMult,
    base.speedMult * (1 + ENDLESS.speedGrowthPerMinute * m),
  );
  return out;
}

/** Multiplicateur de PV du n-ième boss du sans fin (n = 1, 2, 3...). */
export function endlessBossHpMult(n: number): number {
  const last = BOSS_SPAWNS[BOSS_SPAWNS.length - 1];
  return (last?.hpMult ?? 1) * ENDLESS.bossHpGrowth ** n;
}

/**
 * Capacités des boss (voir CLAUDE.md § 5.5). Chacune est ANNONCÉE avant d'arriver, pour pouvoir
 * l'esquiver : ligne rouge avant la charge, cercle violet avant l'invocation.
 */
export const BOSS_ABILITIES = {
  charge: {
    /** s entre deux charges */
    interval: 6,
    /** s d'arrêt avec la ligne rouge, avant de foncer */
    windup: 0.8,
    /** s de charge, en ligne droite (sans corriger sa course) */
    duration: 0.7, // 0,5 → 0,7 : charge plus longue (retour de jeu)
    /** × la vitesse normale du boss pendant la charge */
    speedMult: 5, // 4 → 5
    /** s avant la 1re charge, après l'apparition */
    firstDelay: 3,
  },
  summon: {
    /** s entre deux invocations */
    interval: 10,
    /** s de cercle violet qui grandit, avant l'apparition des sbires */
    cast: 1,
    /** sbires par invocation */
    basics: 5,
    elites: 1, // 2 → 1 (retour de jeu)
    /** px : rayon du cercle où ils apparaissent */
    radius: 80,
    firstDelay: 5,
  },
  /** Le boss n° (index dans BOSS_SPAWNS) à partir duquel il invoque (0 = 5:00, 1 = 9:00) */
  summonFromBossIndex: 1,
  /** Boss du sans fin : les délais × ce facteur à chaque nouveau boss (10 % plus rapide) */
  endlessIntervalFactor: 0.9,
  /** Or donné à la mort d'un mini-boss */
  eliteGold: 10,
} as const;
