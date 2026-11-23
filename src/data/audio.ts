import type { SoundSettings } from '../core/SoundLimiter';
import type { WeaponDef } from './weapons';

/** Dossier des bruitages (générés par tools/audio/build-sfx.mjs). */
export const SFX_DIR = `${import.meta.env.BASE_URL}assets/audio/sfx/`;
/** WAV et pas OGG : l'encodage OGG peut ajouter quelques ms de silence au début d'un son. */
export const SFX_EXTENSION = '.wav';

/**
 * Volume de base des effets (multiplié par le réglage du joueur). Tous les fichiers sont à la
 * même crête (−1 dB) : c'est `volume` ci-dessous qui fait l'équilibre entre les sons.
 */
export const SFX_BASE_VOLUME = 0.8;

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
 * « swoosh » à chaque coup. Un nouveau type d'arme doit avoir son son (vérifié par TypeScript).
 */
export const HIT_SOUNDS = {
  projectile: 'enemy-hit',
  melee: 'enemy-hit',
  orbit: 'orb-hit',
  aura: 'aura-burn',
  chain: 'enemy-hit',
} as const satisfies Record<WeaponDef['kind'], SfxName>;

/** Dossier des musiques (OGG à −16 LUFS, originaux dans assets-src/). */
export const MUSIC_DIR = `${import.meta.env.BASE_URL}assets/audio/music/`;
export const MUSIC_EXTENSION = '.ogg';

/**
 * Les musiques : `loop` = en boucle (sinon jouée une fois, comme les jingles de fin) ;
 * `volume` = volume propre du morceau. Les jingles sont plus forts : très courts, ils doivent
 * ressortir par-dessus le bilan (crête des fichiers vers −7 dB, donc ×1,8 ne sature pas).
 */
export const MUSIC = {
  menu: { loop: true, volume: 1 },
  run: { loop: true, volume: 1 },
  boss: { loop: true, volume: 1 },
  victory: { loop: false, volume: 1.8 },
  defeat: { loop: false, volume: 1.8 },
} as const satisfies Record<string, { loop: boolean; volume: number }>;

export type MusicName = keyof typeof MUSIC;

/**
 * Volume de base de la musique (avant le réglage du joueur) : la musique est à −16 LUFS, plus
 * forte en continu que les bruitages, qui doivent rester lisibles par-dessus.
 */
export const MUSIC_BASE_VOLUME = 0.55;
/** s : fondu quand on change de musique (menu → partie → boss) */
export const MUSIC_FADE = 0.8;
/** Volume de la musique pendant la pause (fraction) */
export const MUSIC_PAUSE_DUCK = 0.35;

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
