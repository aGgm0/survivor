// Réglages du joueur (écran Options), sauvegardés dans localStorage.

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
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  damageNumbers: true,
  fpsCounter: false,
  pauseOnHidden: true,
};

/** Ordre et libellés de l'écran Options. */
export const SETTING_LABELS: readonly (readonly [SettingKey, string])[] = [
  ['damageNumbers', 'Nombres de dégâts'],
  ['fpsCounter', 'Compteur FPS'],
  ['pauseOnHidden', "Pause quand l'onglet est caché"],
];

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
  return settings;
}

/** Ce qui est écrit dans localStorage (avec le numéro de version). */
export function serializeSettings(settings: Readonly<Settings>): Record<string, unknown> {
  return { version: SETTINGS_VERSION, ...settings };
}
