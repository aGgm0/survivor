import type { SoundSettings } from '../core/SoundLimiter';

/** Dossier des bruitages (générés par tools/audio/build-sfx.mjs). */
export const SFX_DIR = '/assets/audio/sfx/';
/** WAV et pas OGG : l'encodage OGG peut ajouter quelques ms de silence au début d'un son. */
export const SFX_EXTENSION = '.wav';

/**
 * Volume général des effets (avant le réglage du joueur, étape B). Tous les fichiers sont à la
 * même crête (−1 dB) : c'est `volume` ci-dessous qui fait l'équilibre entre les sons.
 */
export const SFX_MASTER_VOLUME = 0.8;

/**
 * Réglages de chaque bruitage. Le danger d'un jeu du genre : 30 ennemis touchés dans la même
 * frame = 30 sons superposés, 30 fois plus forts. D'où, pour les sons fréquents :
 * - `volume` bas ;
 * - `minGap` : délai minimum (s) avant de rejouer le même son (les demandes entre-temps sont
 *   ignorées : on entend une rafale régulière au lieu d'un mur de bruit) ;
 * - `maxVoices` : copies du son qui peuvent sonner en même temps ;
 * - `pitchJitter` : hauteur tirée entre ×(1 − j) et ×(1 + j), pour éviter l'effet mitraillette.
 * Les sons importants (joueur touché, level up, boss) sont plus forts et presque pas limités.
 */
export const SFX = {
  'aura-burn': { volume: 0.08, minGap: 0.08, maxVoices: 2, pitchJitter: 0.08 },
  'enemy-hit': { volume: 0.15, minGap: 0.04, maxVoices: 3, pitchJitter: 0.06 },
  'orb-hit': { volume: 0.15, minGap: 0.05, maxVoices: 3, pitchJitter: 0.06 },
  'bolt-shoot': { volume: 0.2, minGap: 0.06, maxVoices: 3, pitchJitter: 0.05 },
  'gem-pickup': { volume: 0.2, minGap: 0.04, maxVoices: 3, pitchJitter: 0.04 },
  'enemy-death': { volume: 0.25, minGap: 0.05, maxVoices: 4, pitchJitter: 0.08 },
  'bolt-burst': { volume: 0.3, minGap: 0.06, maxVoices: 3, pitchJitter: 0.06 },
  'coin-pickup': { volume: 0.3, minGap: 0.06, maxVoices: 3, pitchJitter: 0.03 },
  'sword-slash': { volume: 0.35, minGap: 0, maxVoices: 2, pitchJitter: 0.05 },
  'crate-break': { volume: 0.4, minGap: 0, maxVoices: 2, pitchJitter: 0.06 },
  heal: { volume: 0.5, minGap: 0, maxVoices: 1, pitchJitter: 0 },
  'level-up': { volume: 0.5, minGap: 0, maxVoices: 1, pitchJitter: 0 },
  'player-hurt': { volume: 0.6, minGap: 0.15, maxVoices: 1, pitchJitter: 0.05 },
  'boss-charge': { volume: 0.7, minGap: 0, maxVoices: 2, pitchJitter: 0 },
  'boss-summon': { volume: 0.7, minGap: 0, maxVoices: 2, pitchJitter: 0 },
  'boss-death': { volume: 0.7, minGap: 0, maxVoices: 2, pitchJitter: 0 },
  'ui-hover': { volume: 0.3, minGap: 0.03, maxVoices: 1, pitchJitter: 0 },
  'ui-click': { volume: 0.4, minGap: 0.03, maxVoices: 1, pitchJitter: 0 },
} as const satisfies Record<string, SoundSettings>;

export type SfxName = keyof typeof SFX;

/**
 * Son d'impact selon le type d'arme. L'épée garde l'impact standard : on entend déjà son
 * « swoosh » à chaque coup.
 */
export const HIT_SOUNDS = {
  projectile: 'enemy-hit',
  melee: 'enemy-hit',
  orbit: 'orb-hit',
  aura: 'aura-burn',
} as const satisfies Record<string, SfxName>;

/**
 * Compresseur à la sortie (filet de sécurité) : si beaucoup de sons forts tombent ensemble, il
 * baisse le volume global un instant au lieu de laisser saturer.
 */
export const SFX_COMPRESSOR = {
  /** dB à partir desquels il commence à agir */
  threshold: -14,
  knee: 8,
  ratio: 6,
  /** s pour réagir / pour relâcher */
  attack: 0.003,
  release: 0.2,
};
