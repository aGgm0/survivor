import type { EnemyType, Resistances } from './enemies';

// Vagues (voir CLAUDE.md § 5.7) : les FORMES des vagues, rushs, élites et boss, et les règles
// communes à tous les niveaux (sans fin, capacités des boss). Le contenu de chaque niveau (quand,
// combien, quels PV) est dans data/stages.ts.

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

/** Mini-boss : un ennemi élite à une heure précise, avec les PV et la vitesse de la vague en cours. */
export interface EliteSpawn {
  readonly time: number;
  readonly type: EnemyType;
}

export interface BossSpawn {
  /** s : instant d'apparition */
  readonly time: number;
  /** Type d'ennemi du boss (un niveau de 30 min aura 3 boss différents) */
  readonly type: EnemyType;
  /** Invoque des sbires (en plus de la charge, que tous les boss ont) */
  readonly summons: boolean;
  /** multiplicateur des PV de base du boss ; l'XP suit, comme pour les vagues */
  readonly hpMult: number;
  readonly speedMult: number;
  /** s d'annonce de la charge (absent : BOSS_ABILITIES.charge.windup) */
  readonly chargeWindup?: number;
  /**
   * Multiplicateur de vitesse utilisé pour la charge (absent : `speedMult`). Permet un boss qui
   * marche vite sans que sa charge traverse tout l'écran (charge = 5 × cette vitesse).
   */
  readonly dashSpeedMult?: number;
  /** Résistances à la place de celles du type (absent : celles du boss, 30 / 30) */
  readonly resistances?: Resistances;
}

/** Vague active à l'instant `time` (s), parmi `waves` triées par `start`. */
export function waveAt(waves: readonly WaveDef[], time: number): WaveDef {
  let current = waves[0];
  for (const wave of waves) if (time >= wave.start) current = wave;
  if (!current) throw new Error('niveau sans vague');
  return current;
}

/**
 * Mode sans fin (après la victoire, si le joueur choisit de continuer) : chaque minute écoulée
 * depuis le début du sans fin durcit la dernière vague. Sans ça, un build complet raserait tout.
 */
export const ENDLESS = {
  // 2026-11-21 : chaque minute, toutes les stats des ennemis montent (« hardcore »). Calcul en
  // continu (pas par paliers) à l'apparition de chaque ennemi. Les boss gardent leur progression.
  /** PV ×1,2 par minute, cumulé (×1,44 après 2 min, ×2,5 après 5 min) */
  hpGrowthPerMinute: 1.2,
  /** Dégâts au contact ×1,1 par minute, cumulé (×1,6 après 5 min) */
  damageGrowthPerMinute: 1.1,
  /** ennemis par seconde en plus, par minute */
  extraPerSecondPerMinute: 2,
  /** vitesse +3 % par minute... */
  speedGrowthPerMinute: 0.03,
  /** ...plafonnée à ×3 (était ×1,8 : le sans fin doit être hardcore) */
  maxSpeedMult: 3,
  /** Résistance au recul +8 % par minute (part du recul ignorée)... */
  knockbackResistPerMinute: 0.08,
  /** ...plafonnée : un ennemi recule toujours un peu */
  maxKnockbackResist: 0.8,
  /** Résistance au ralentissement +10 % par minute (retour de jeu du 2026-11-23)... */
  slowResistPerMinute: 0.1,
  /** ...plafonnée comme le recul : le Givre garde un effet en sans fin */
  maxSlowResist: 0.8,
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
  /** Sans fin seulement : dégâts au contact × ce facteur */
  damageMult: number;
  /** Sans fin seulement : part du recul ignorée (0 à 1) */
  knockbackResist: number;
  /** Sans fin seulement : part des ralentissements ignorée (0 à 1) */
  slowResist: number;
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
  out.damageMult = ENDLESS.damageGrowthPerMinute ** m;
  out.knockbackResist = Math.min(ENDLESS.maxKnockbackResist, ENDLESS.knockbackResistPerMinute * m);
  out.slowResist = Math.min(ENDLESS.maxSlowResist, ENDLESS.slowResistPerMinute * m);
  return out;
}

/**
 * Multiplicateur de PV du n-ième boss du sans fin (n = 1, 2, 3...), à partir du dernier boss
 * du niveau (`last`).
 */
export function endlessBossHpMult(last: BossSpawn | undefined, n: number): number {
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
  /** Boss du sans fin : les délais × ce facteur à chaque nouveau boss (10 % plus rapide) */
  endlessIntervalFactor: 0.9,
  /** Or donné à la mort d'un mini-boss */
  eliteGold: 5, // 10 → 5 : or −50 % (2026-11-21)
} as const;
