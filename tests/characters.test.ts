import { describe, expect, it } from 'vitest';
import {
  BOSS_CHALLENGES,
  CHARACTERS,
  DEFAULT_CHARACTER,
  challengeProgress,
  isUnlocked,
  newUnlocks,
} from '../src/data/characters';
import { emptyProfile, recordRun } from '../src/data/profile';
import { CHARACTER_SPRITES } from '../src/data/sprites';
import type { RunReport } from '../src/types/RunReport';

const [ARCANIST, PYRO, RUNIST] = CHARACTERS as [
  (typeof CHARACTERS)[0],
  (typeof CHARACTERS)[0],
  (typeof CHARACTERS)[0],
];

function report(overrides: Partial<RunReport> = {}): RunReport {
  return {
    character: '',
    passives: [],
    victory: false,
    endless: false,
    time: 300,
    kills: 0,
    gold: 0,
    level: 10,
    challenges: [],
    maxedAt: null,
    weapons: [],
    ...overrides,
  };
}

/** Une partie où l'Aura ardente a fait `kills` kills. */
function auraRun(kills: number): RunReport {
  return weaponRun('burningAura', kills);
}

/** Une partie où l'arme `id` a fait `kills` kills. */
function weaponRun(id: string, kills: number): RunReport {
  return report({
    weapons: [
      {
        id,
        name: 'Aura',
        icon: 'burningAura',
        short: 'Au',
        color: '',
        level: 5,
        damage: 0,
        kills,
        share: 1,
      },
    ],
  });
}

describe('persos de départ', () => {
  it('l’Arcaniste est toujours disponible, c’est le perso par défaut', () => {
    expect(DEFAULT_CHARACTER).toBe(ARCANIST);
    expect(isUnlocked(ARCANIST, emptyProfile())).toBe(true);
  });

  it('chaque perso commence avec une arme différente', () => {
    expect(new Set(CHARACTERS.map((c) => c.weapon.id)).size).toBe(CHARACTERS.length);
  });

  it('Pyromancien : 5 000 kills d’Aura cumulés sur plusieurs parties', () => {
    const profile = emptyProfile();
    recordRun(profile, auraRun(3000));
    expect(isUnlocked(PYRO, profile)).toBe(false);
    expect(challengeProgress(PYRO, profile)).toEqual({ current: 3000, target: 5000 });
    recordRun(profile, auraRun(2000));
    expect(isUnlocked(PYRO, profile)).toBe(true);
  });

  it('Runiste : débloqué par le défi « boss de 9:00 avec les Orbes niveau 5 »', () => {
    const profile = emptyProfile();
    expect(isUnlocked(RUNIST, profile)).toBe(false);
    expect(challengeProgress(RUNIST, profile)).toBeNull(); // tout-ou-rien
    recordRun(profile, report({ challenges: ['runistBoss'] }));
    expect(isUnlocked(RUNIST, profile)).toBe(true);
    expect(BOSS_CHALLENGES.map((c) => c.id)).toEqual(['runistBoss', 'berserkerBoss']);
  });

  it('8 persos : une arme de départ par arme du jeu, chacun avec son apparence', () => {
    expect(CHARACTERS).toHaveLength(8);
    for (const c of CHARACTERS) expect(CHARACTER_SPRITES[c.id], c.id).toBeDefined();
    // Toutes les animations différentes : pas deux persos identiques à l'écran
    const looks = CHARACTERS.map((c) => CHARACTER_SPRITES[c.id]?.idle);
    expect(new Set(looks).size).toBe(CHARACTERS.length);
  });

  it('0.3.5 : Archère, Piégeuse, Tempêtiste par les kills cumulés de leur arme', () => {
    const cases = [
      ['archer', 'bow', 3000],
      ['trapper', 'caltrops', 4000],
      ['stormcaller', 'chainLightning', 5000],
    ] as const;
    for (const [id, weaponId, count] of cases) {
      const c = CHARACTERS.find((x) => x.id === id)!;
      expect(c.weapon.id).toBe(weaponId);
      const profile = emptyProfile();
      recordRun(profile, weaponRun(weaponId, count - 1));
      expect(isUnlocked(c, profile), id).toBe(false);
      expect(challengeProgress(c, profile)).toEqual({ current: count - 1, target: count });
      recordRun(profile, weaponRun(weaponId, 1));
      expect(isUnlocked(c, profile), id).toBe(true);
    }
  });

  it('Berserker : boss de 5:00 tué avec la Hache de lancer au niveau 5', () => {
    const berserker = CHARACTERS.find((c) => c.id === 'berserker')!;
    const challenge = BOSS_CHALLENGES.find((c) => c.id === 'berserkerBoss');
    expect(challenge).toMatchObject({ bossIndex: 0, weaponId: 'throwingAxe', minLevel: 5 });
    const profile = emptyProfile();
    expect(isUnlocked(berserker, profile)).toBe(false);
    recordRun(profile, report({ challenges: ['berserkerBoss'] }));
    expect(isUnlocked(berserker, profile)).toBe(true);
  });

  it('un défi réussi deux fois n’est gardé qu’une fois', () => {
    const profile = emptyProfile();
    recordRun(profile, report({ challenges: ['runistBoss'] }));
    recordRun(profile, report({ challenges: ['runistBoss'] }));
    expect(profile.challenges).toEqual(['runistBoss']);
  });
});

describe('newUnlocks', () => {
  it('annonce les persos que la partie débloque, sans modifier le profil', () => {
    const profile = emptyProfile();
    recordRun(profile, auraRun(4900));
    const unlocked = newUnlocks(profile, auraRun(200));
    expect(unlocked.map((c) => c.id)).toEqual(['pyromancer']);
    expect(profile.weapons.burningAura?.kills).toBe(4900); // profil intact
    expect(profile.runs).toBe(1);
  });

  it('rien de nouveau : liste vide (un perso déjà débloqué n’est pas réannoncé)', () => {
    const profile = emptyProfile();
    recordRun(profile, report({ challenges: ['runistBoss'] }));
    expect(newUnlocks(profile, report({ challenges: ['runistBoss'] }))).toEqual([]);
  });
});
