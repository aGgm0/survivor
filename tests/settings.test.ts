import { describe, expect, it } from 'vitest';
import { SaveStore, type KeyValueStorage } from '../src/core/SaveStore';
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  parseSettings,
  serializeSettings,
} from '../src/data/settings';

/** Faux localStorage en mémoire. */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('parseSettings', () => {
  it('rien de sauvegardé : réglages par défaut', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('pas un objet (texte, nombre, tableau) : réglages par défaut', () => {
    for (const raw of ['oui', 42, [true, false], true]) {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('garde les champs valides, remplace les absents et ceux du mauvais type', () => {
    const settings = parseSettings({ version: 1, damageNumbers: false, fpsCounter: 'oui' });
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, damageNumbers: false });
  });

  it('ancienne sauvegarde sans tremblement : activé par défaut, le reste est gardé', () => {
    const settings = parseSettings({ version: 1, damageNumbers: false });
    expect(settings.screenShake).toBe(true);
    expect(settings.damageNumbers).toBe(false);
    expect(parseSettings({ version: 1, screenShake: false }).screenShake).toBe(false);
  });

  it('ignore les champs inconnus', () => {
    const settings = parseSettings({ version: 1, triche: true });
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect('triche' in settings).toBe(false);
  });

  it('version plus récente que le jeu : réglages par défaut', () => {
    expect(parseSettings({ version: SETTINGS_VERSION + 1, damageNumbers: false })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('aller-retour : ce qui est sauvegardé est relu à l’identique', () => {
    const settings = {
      damageNumbers: false,
      fpsCounter: true,
      pauseOnHidden: false,
      screenShake: false,
      volumeMaster: 0.5,
      volumeMusic: 0,
      volumeSfx: 1,
    };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });

  it('volumes : ramenés entre 0 et 1, valeur par défaut si ce n’est pas un nombre', () => {
    const s = parseSettings({ volumeMaster: 7, volumeMusic: -2, volumeSfx: 'fort' });
    expect(s.volumeMaster).toBe(1);
    expect(s.volumeMusic).toBe(0);
    expect(s.volumeSfx).toBe(DEFAULT_SETTINGS.volumeSfx);
    // Ancienne sauvegarde sans volumes : valeurs par défaut.
    expect(parseSettings({ version: 1, damageNumbers: false }).volumeMusic).toBe(
      DEFAULT_SETTINGS.volumeMusic,
    );
  });

  it('ne modifie jamais les valeurs par défaut partagées', () => {
    parseSettings({ damageNumbers: false });
    expect(DEFAULT_SETTINGS.damageNumbers).toBe(true);
  });
});

describe('SaveStore', () => {
  it('écrit puis relit du JSON', () => {
    const storage = memoryStorage();
    const store = new SaveStore(storage);
    expect(store.save('k', { a: 1 })).toBe(true);
    expect(store.load('k')).toEqual({ a: 1 });
  });

  it('JSON corrompu ou clé absente : undefined, sans planter', () => {
    const storage = memoryStorage();
    storage.data.set('k', '{pas du json');
    const store = new SaveStore(storage);
    expect(store.load('k')).toBeUndefined();
    expect(store.load('absente')).toBeUndefined();
  });

  it('stockage indisponible ou qui lève une erreur : le jeu continue', () => {
    const none = new SaveStore(null);
    expect(none.load('k')).toBeUndefined();
    expect(none.save('k', 1)).toBe(false);

    const broken = new SaveStore({
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('plein');
      },
    });
    expect(broken.load('k')).toBeUndefined();
    expect(broken.save('k', 1)).toBe(false);
  });
});
