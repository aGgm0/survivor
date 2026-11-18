/** Réglages d'un son pour le limiteur (voir data/audio.ts). */
export interface SoundSettings {
  /** Volume du son (0 à 1) */
  readonly volume: number;
  /** s : délai minimum avant de rejouer ce même son */
  readonly minGap: number;
  /** Copies du son qui peuvent sonner en même temps */
  readonly maxVoices: number;
  /** Variation de hauteur aléatoire (0.05 = ±5 %) */
  readonly pitchJitter: number;
}

/**
 * Décide si un son a le droit de partir maintenant. Logique pure (aucun objet Web Audio), donc
 * testable sans navigateur.
 * Pour chaque son on garde la date du dernier départ et la date de fin de chaque copie en
 * cours, dans un tableau de taille fixe : aucune allocation par son joué.
 */
export class SoundLimiter {
  private lastStart = -Infinity;
  /** Date de fin de chaque copie (une case par copie possible) */
  private readonly voiceEnds: Float64Array;

  constructor(private readonly settings: SoundSettings) {
    this.voiceEnds = new Float64Array(Math.max(1, settings.maxVoices)).fill(-Infinity);
  }

  /**
   * Vrai si le son peut partir à `now` (s) pour durer `duration` (s) ; dans ce cas, le départ
   * est enregistré. Faux = trop tôt après le précédent, ou toutes les copies sont occupées.
   */
  tryStart(now: number, duration: number): boolean {
    if (now - this.lastStart < this.settings.minGap) return false;
    let free = -1;
    for (let i = 0; i < this.voiceEnds.length; i++) {
      if ((this.voiceEnds[i] ?? Infinity) <= now) {
        free = i;
        break;
      }
    }
    if (free < 0) return false;
    this.voiceEnds[free] = now + duration;
    this.lastStart = now;
    return true;
  }
}

/** Hauteur de lecture : 1 ± jitter, à partir d'un tirage entre 0 et 1. */
export function jitteredRate(jitter: number, random: number): number {
  return 1 + (random * 2 - 1) * jitter;
}
