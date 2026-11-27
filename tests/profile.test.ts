import { describe, expect, it } from 'vitest';
import {
  HISTORY_SIZE,
  PROFILE_VERSION,
  emptyProfile,
  favoriteWeapon,
  parseProfile,
  recordRun,
  serializeProfile,
} from '../src/data/profile';
import type { RunReport } from '../src/types/RunReport';

function report(overrides: Partial<RunReport> = {}): RunReport {
  return {
    character: '',
    passives: [],
    victory: false,
    endless: false,
    time: 300,
    kills: 1000,
    gold: 0,
    level: 20,
    challenges: [],
    maxedAt: null,
    weapons: [
      {
        id: 'burningAura',
        name: 'Aura de givre',
        icon: 'frostAura',
        short: 'Gv',
        color: '',
        level: 5,
        damage: 5000,
        kills: 700,
        share: 0.7,
      },
      {
        id: 'arcaneBolt',
        name: 'Trait',
        icon: 'arcaneBolt',
        short: 'Ta',
        color: '',
        level: 3,
        damage: 2000,
        kills: 300,
        share: 0.3,
      },
    ],
    ...overrides,
  };
}

describe('recordRun', () => {
  it('cumule parties, victoires, temps, kills et garde les records', () => {
    const profile = emptyProfile();
    recordRun(profile, report({ time: 300, level: 20 }));
    recordRun(profile, report({ victory: true, time: 600, level: 35 }));
    expect(profile.runs).toBe(2);
    expect(profile.victories).toBe(1);
    expect(profile.totalTime).toBe(900);
    expect(profile.bestTime).toBe(600);
    expect(profile.bestLevel).toBe(35);
    expect(profile.totalKills).toBe(2000);
  });

  it('cumule par arme (une arme mutée compte sous son arme de base)', () => {
    const profile = emptyProfile();
    recordRun(profile, report());
    recordRun(profile, report());
    expect(profile.weapons.burningAura).toEqual({ runs: 2, damage: 10000, kills: 1400 });
    expect(profile.weapons.arcaneBolt?.runs).toBe(2);
  });
});

describe('recordRun — sans fin', () => {
  it('le meilleur temps compte le temps passé en sans fin', () => {
    const profile = emptyProfile();
    recordRun(profile, report({ victory: true, time: 600 }));
    expect(profile.bestTime).toBe(600);
    recordRun(profile, report({ victory: true, endless: true, time: 812 }));
    expect(profile.bestTime).toBe(812);
    expect(profile.runs).toBe(2);
  });
});

describe('favoriteWeapon', () => {
  it('aucune partie : null', () => {
    expect(favoriteWeapon(emptyProfile())).toBeNull();
  });

  it('le plus de parties, puis le plus de dégâts en cas d’égalité', () => {
    const profile = emptyProfile();
    recordRun(profile, report());
    expect(favoriteWeapon(profile)).toBe('burningAura'); // égalité de parties, plus de dégâts
    recordRun(profile, report({ weapons: [{ ...report().weapons[1]!, damage: 1 }] }));
    expect(favoriteWeapon(profile)).toBe('arcaneBolt'); // 2 parties contre 1
  });
});

describe('parseProfile', () => {
  it('rien ou n’importe quoi : profil vide', () => {
    for (const raw of [undefined, null, 'texte', 3, []])
      expect(parseProfile(raw)).toEqual(emptyProfile());
  });

  it('valeurs négatives, NaN ou du mauvais type : remises à 0', () => {
    const profile = parseProfile({
      version: 1,
      runs: -5,
      victories: 'beaucoup',
      totalKills: NaN,
      bestTime: 120,
    });
    expect(profile.runs).toBe(0);
    expect(profile.victories).toBe(0);
    expect(profile.totalKills).toBe(0);
    expect(profile.bestTime).toBe(120);
  });

  it('ignore les armes inconnues', () => {
    const profile = parseProfile({
      weapons: { epeeInventee: { runs: 99 }, runicOrbs: { runs: 2 } },
    });
    expect(Object.keys(profile.weapons)).toEqual(['runicOrbs']);
    expect(profile.weapons.runicOrbs).toEqual({ runs: 2, damage: 0, kills: 0 });
  });

  it('défis : garde les textes, ignore le reste et les doublons', () => {
    const profile = parseProfile({ challenges: ['runistBoss', 42, null, 'runistBoss'] });
    expect(profile.challenges).toEqual(['runistBoss']);
    expect(parseProfile({ challenges: 'runistBoss' }).challenges).toEqual([]);
  });

  it('version plus récente que le jeu : profil vide', () => {
    expect(parseProfile({ version: PROFILE_VERSION + 1, runs: 10 })).toEqual(emptyProfile());
  });

  it('aller-retour : ce qui est sauvegardé est relu à l’identique', () => {
    const profile = recordRun(emptyProfile(), report({ victory: true }));
    expect(parseProfile(JSON.parse(JSON.stringify(serializeProfile(profile))))).toEqual(profile);
  });
});

describe('historique des parties', () => {
  it('garde les 5 dernières parties, la plus récente en premier', () => {
    const profile = emptyProfile();
    for (let i = 1; i <= HISTORY_SIZE + 2; i++) recordRun(profile, report({ kills: i }), i * 1000);
    expect(profile.history).toHaveLength(HISTORY_SIZE);
    expect(profile.history.map((h) => h.kills)).toEqual([7, 6, 5, 4, 3]);
    expect(profile.history[0]?.at).toBe(7000);
  });

  it('garde le perso, les armes (icône de mutation, part des dégâts) et les passifs', () => {
    const profile = emptyProfile();
    recordRun(
      profile,
      report({ character: 'pyromancer', passives: [{ id: 'power', level: 3 }], maxedAt: 540 }),
    );
    const entry = profile.history[0];
    expect(entry?.character).toBe('pyromancer');
    expect(entry?.weapons.map((w) => [w.icon, w.level, w.share])).toEqual([
      ['frostAura', 5, 0.7],
      ['arcaneBolt', 3, 0.3],
    ]);
    expect(entry?.passives).toEqual([{ id: 'power', level: 3 }]);
    expect(entry?.maxedAt).toBe(540);
  });

  it('relu sans confiance : ligne abîmée ignorée, armes et passifs inconnus retirés', () => {
    const profile = parseProfile({
      history: [
        'n’importe quoi',
        { victory: 'oui' },
        {
          victory: true,
          time: 600,
          character: 'arcanist',
          weapons: [{ id: 'arcaneBolt', icon: 'inventée', share: 7 }, { id: 'laser' }],
          passives: [
            { id: 'power', level: 2 },
            { id: 'inventé', level: 9 },
          ],
        },
      ],
    });
    expect(profile.history).toHaveLength(1);
    const entry = profile.history[0];
    expect(entry?.weapons).toHaveLength(1);
    expect(entry?.weapons[0]?.icon).toBe('arcaneBolt');
    expect(entry?.weapons[0]?.share).toBe(1);
    expect(entry?.passives).toEqual([{ id: 'power', level: 2 }]);
  });

  it('ancienne sauvegarde sans historique : historique vide', () => {
    expect(parseProfile({ version: 1, runs: 3 }).history).toEqual([]);
  });
});
