// Persos de départ (voir CLAUDE.md § 5.9). Pour l'instant, un perso = son arme de départ.
// Les persos verrouillés se débloquent par un défi fait avec leur arme, ramassée en partie.

import type { RunReport } from '../systems/runReport';
import { parseProfile, recordRun, serializeProfile, type Profile } from './profile';
import { WEAPONS, type WeaponDef } from './weapons';

/** Comment se débloque un perso. */
export type Challenge =
  /** Disponible dès le début */
  | { readonly kind: 'none' }
  /** `count` kills avec cette arme, cumulés sur toutes les parties terminées (profil) */
  | { readonly kind: 'weaponKills'; readonly weaponId: string; readonly count: number }
  /**
   * Tuer le boss n° `bossIndex` de BOSS_SPAWNS en ayant cette arme au niveau `minLevel` ou plus.
   * Réussi pendant une partie, puis gardé dans le profil (`challenges`).
   */
  | {
      readonly kind: 'bossWithWeapon';
      readonly id: string;
      readonly bossIndex: number;
      readonly weaponId: string;
      readonly minLevel: number;
    };

export interface CharacterDef {
  readonly id: string;
  /** Nom provisoire */
  readonly name: string;
  readonly weapon: WeaponDef;
  readonly challenge: Challenge;
  /** Texte du défi affiché sur la carte quand le perso est verrouillé */
  readonly challengeText: string;
}

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'arcanist',
    name: 'Arcaniste',
    weapon: WEAPONS.arcaneBolt,
    challenge: { kind: 'none' },
    challengeText: '',
  },
  {
    id: 'pyromancer',
    name: 'Pyromancien',
    weapon: WEAPONS.burningAura,
    challenge: { kind: 'weaponKills', weaponId: WEAPONS.burningAura.id, count: 5000 },
    challengeText: '5 000 kills avec l’Aura ardente (toutes parties confondues)',
  },
  {
    id: 'runist',
    name: 'Runiste',
    weapon: WEAPONS.runicOrbs,
    challenge: {
      kind: 'bossWithWeapon',
      id: 'runistBoss',
      bossIndex: 1, // boss de 9:00
      weaponId: WEAPONS.runicOrbs.id,
      minLevel: 5,
    },
    challengeText: 'Tuer le boss de 9:00 avec les Orbes runiques au niveau 5',
  },
];

/** Perso par défaut (toujours débloqué). */
export const DEFAULT_CHARACTER = CHARACTERS[0] as CharacterDef;

/** Progression d'un défi chiffré (kills), ou null pour un défi tout-ou-rien. */
export function challengeProgress(
  character: CharacterDef,
  profile: Readonly<Profile>,
): { readonly current: number; readonly target: number } | null {
  const c = character.challenge;
  if (c.kind !== 'weaponKills') return null;
  return { current: profile.weapons[c.weaponId]?.kills ?? 0, target: c.count };
}

export function isUnlocked(character: CharacterDef, profile: Readonly<Profile>): boolean {
  const c = character.challenge;
  switch (c.kind) {
    case 'none':
      return true;
    case 'weaponKills':
      return (profile.weapons[c.weaponId]?.kills ?? 0) >= c.count;
    case 'bossWithWeapon':
      return profile.challenges.includes(c.id);
  }
}

/** Défis « boss tué avec une arme » : la partie les vérifie à chaque mort de boss. */
export const BOSS_CHALLENGES = CHARACTERS.flatMap((c) =>
  c.challenge.kind === 'bossWithWeapon' ? [c.challenge] : [],
);

/**
 * Persos que cette partie débloquerait une fois ajoutée au profil. Calculé sur une COPIE :
 * l'écran de fin l'annonce tout de suite, même si la partie n'est enregistrée qu'en quittant
 * l'écran (victoire, voir le mode sans fin).
 */
export function newUnlocks(profile: Readonly<Profile>, report: RunReport): CharacterDef[] {
  const copy = recordRun(parseProfile(serializeProfile(profile)), report);
  return CHARACTERS.filter((c) => !isUnlocked(c, profile) && isUnlocked(c, copy));
}
