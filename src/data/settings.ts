// Réglages du joueur (écran Options), sauvegardés dans localStorage.

import { GAME_VERSION } from './version';

/** Clé de sauvegarde. Le préfixe évite les collisions avec d'autres jeux sur le même domaine. */
export const SETTINGS_KEY = 'survivor.settings';

/**
 * Version du format sauvegardé. À augmenter quand le format change, et ajouter dans
 * `parseSettings` la conversion depuis l'ancienne version : on ne casse pas les sauvegardes.
 */
export const SETTINGS_VERSION = 1;

export interface Settings {
  /** Afficher les nombres de dégâts au-dessus des ennemis */
  damageNumbers: boolean;
  /** Petit compteur FPS permanent (sans ouvrir l'overlay F3) */
  fpsCounter: boolean;
  /** Mettre la partie en pause quand l'onglet est caché */
  pauseOnHidden: boolean;
  /** Tremblement de l'écran sur les gros chocs (certains joueurs le supportent mal) */
  screenShake: boolean;
  /** Volume général (0 à 1), appliqué à tout le son */
  volumeMaster: number;
  /** Volume de la musique (0 à 1) */
  volumeMusic: number;
  /** Volume des bruitages (0 à 1) */
  volumeSfx: number;
}

/** Les réglages oui / non (cases à cocher). */
export type SettingKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];
/** Les réglages de volume (curseurs). */
export type VolumeKey = 'volumeMaster' | 'volumeMusic' | 'volumeSfx';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  damageNumbers: true,
  fpsCounter: false,
  pauseOnHidden: true,
  screenShake: true,
  volumeMaster: 0.8,
  volumeMusic: 0.7,
  volumeSfx: 0.8,
};

/** Ordre et libellés de l'écran Options. */
export const SETTING_LABELS: readonly (readonly [SettingKey, string])[] = [
  ['damageNumbers', 'Nombres de dégâts'],
  ['fpsCounter', 'Compteur FPS'],
  ['pauseOnHidden', "Pause quand l'onglet est caché"],
  ['screenShake', "Tremblement de l'écran"],
];

/** Curseurs de volume de l'écran Options, dans l'ordre. */
export const VOLUME_LABELS: readonly (readonly [VolumeKey, string])[] = [
  ['volumeMaster', 'Volume général'],
  ['volumeMusic', 'Musique'],
  ['volumeSfx', 'Effets sonores'],
];

/** Pas des curseurs : 10 %. */
export const VOLUME_STEP = 0.1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lit une sauvegarde sans lui faire confiance : chaque champ absent ou du mauvais type prend
 * sa valeur par défaut. Renvoie toujours des réglages complets et valides.
 */
export function parseSettings(raw: unknown): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  if (!isRecord(raw)) return settings;
  // Version inconnue (plus récente que le jeu) : on ne devine pas, valeurs par défaut.
  if (typeof raw.version === 'number' && raw.version > SETTINGS_VERSION) return settings;
  for (const [key] of SETTING_LABELS) {
    const value = raw[key];
    if (typeof value === 'boolean') settings[key] = value;
  }
  // Volumes : nombre ramené entre 0 et 1 (une sauvegarde trafiquée ne doit pas assourdir).
  for (const [key] of VOLUME_LABELS) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      settings[key] = Math.min(1, Math.max(0, value));
    }
  }
  return settings;
}

/** Ce qui est écrit dans localStorage (avec le numéro de version). */
export function serializeSettings(settings: Readonly<Settings>): Record<string, unknown> {
  // savedWith : version du jeu qui a écrit la sauvegarde (ignorée à la lecture, utile aux migrations).
  return { version: SETTINGS_VERSION, savedWith: GAME_VERSION, ...settings };
}
