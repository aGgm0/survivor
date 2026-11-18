import { describe, expect, it } from 'vitest';
import { GAME_VERSION } from '../src/data/version';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from '../src/data/settings';
import { emptyProfile, parseProfile, serializeProfile } from '../src/data/profile';
import pkg from '../package.json';

describe('version du jeu', () => {
  it('vient de package.json (source unique)', () => {
    expect(GAME_VERSION).toBe(pkg.version);
  });

  it('est écrite dans les sauvegardes (savedWith) et ignorée à la relecture', () => {
    const settings = serializeSettings(DEFAULT_SETTINGS);
    expect(settings.savedWith).toBe(GAME_VERSION);
    expect(parseSettings(settings)).toEqual(DEFAULT_SETTINGS);
    const profile = serializeProfile(emptyProfile());
    expect(profile.savedWith).toBe(GAME_VERSION);
    expect(parseProfile(profile)).toEqual(emptyProfile());
  });
});
