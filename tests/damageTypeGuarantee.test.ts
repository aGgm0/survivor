import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { WEAPONS } from '../src/data/weapons';
import { Player } from '../src/entities/Player';
import { Weapon } from '../src/entities/Weapon';
import {
  availableUpgrades,
  missingDamageType,
  rollUpgradeChoices,
  type Build,
} from '../src/systems/upgrades';

function build(...defs: (typeof WEAPONS)[keyof typeof WEAPONS][]): Build {
  return {
    player: new Player(),
    weapons: defs.map((d) => new Weapon(d)),
    passiveLevels: new Map(),
  };
}

describe('carte de l’autre type de dégâts', () => {
  it('le type qui manque : seulement si toutes les armes sont du même type', () => {
    expect(missingDamageType([])).toBeNull();
    expect(missingDamageType(build(WEAPONS.arcaneBolt).weapons)).toBe('physical');
    expect(missingDamageType(build(WEAPONS.sword).weapons)).toBe('magical');
    expect(missingDamageType(build(WEAPONS.arcaneBolt, WEAPONS.sword).weapons)).toBeNull();
  });

  it('un build tout magique se voit toujours proposer l’Épée, garantie de nouvelle arme comprise', () => {
    const b = build(WEAPONS.arcaneBolt, WEAPONS.burningAura);
    const options = availableUpgrades(b);
    for (let seed = 0; seed < 200; seed++) {
      const picks = rollUpgradeChoices(options, new Rng(seed), 3, true, [], 1, 'physical');
      expect(picks).toHaveLength(3);
      expect(picks.some((c) => c.kind === 'newWeapon' && c.def.id === 'sword')).toBe(true);
      expect(new Set(picks.map((c) => c.title)).size).toBe(3);
    }
  });

  it('plus de place pour une arme : rien n’est forcé', () => {
    const b = build(WEAPONS.arcaneBolt, WEAPONS.burningAura, WEAPONS.runicOrbs, WEAPONS.arcaneBolt);
    const options = availableUpgrades(b);
    expect(options.some((c) => c.kind === 'newWeapon')).toBe(false);
    const picks = rollUpgradeChoices(options, new Rng(1), 3, false, [], 1, 'physical');
    expect(picks.every((c) => c.kind !== 'newWeapon')).toBe(true);
  });
});
