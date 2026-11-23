import { describe, expect, it } from 'vitest';
import { PASSIVES } from '../src/data/upgrades';
import { WEAPONS, weaponMaxLevel } from '../src/data/weapons';
import { Player } from '../src/entities/Player';
import { Weapon } from '../src/entities/Weapon';
import { describeChoice } from '../src/systems/choiceDetails';
import type { Build } from '../src/systems/upgrades';

function build(weapons: Weapon[] = [], passives: [string, number][] = []): Build {
  const player = new Player();
  for (const w of weapons) w.recompute(player);
  return { player, weapons, passiveLevels: new Map(passives), gold: 37 };
}

const passive = (id: string) => {
  const p = PASSIVES.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('détails des cartes de level up', () => {
  it('niveau d’arme : crans et seulement les stats qui changent (Trait niv 2 → 3 : +1 projectile)', () => {
    const bolt = new Weapon(WEAPONS.arcaneBolt);
    bolt.level = 2;
    const b = build([bolt]);
    const d = describeChoice(
      { kind: 'weaponLevel', weapon: bolt, title: '', description: '', levelText: '' },
      b,
    );
    expect([d.level, d.maxLevel]).toEqual([2, weaponMaxLevel(WEAPONS.arcaneBolt)]);
    expect(d.changes).toEqual([{ label: 'projectiles', before: '1', after: '2' }]);
    expect(d.scope).toBe(`Magique · ${WEAPONS.arcaneBolt.scope}`); // type de dégâts d'abord
  });

  it('nouvelle arme : niveau 0 et l’emplacement qu’elle prend', () => {
    const b = build([new Weapon(WEAPONS.arcaneBolt)]);
    const d = describeChoice(
      { kind: 'newWeapon', def: WEAPONS.sword, title: '', description: '', levelText: '' },
      b,
    );
    expect(d.level).toBe(0);
    expect(d.scope).toContain('emplacement 2 / 4');
  });

  it('passif : total avant → après en %, emplacement seulement s’il est nouveau', () => {
    const power = passive('power');
    const fresh = describeChoice(
      { kind: 'passive', passive: power, title: '', description: '', levelText: '' },
      build(),
    );
    expect(fresh.changes[0]).toEqual({
      label: 'total',
      before: '+0 %',
      after: `+${power.amount * 100} %`,
    });
    expect(fresh.scope).toContain('emplacement 1 / 4');
    const owned = describeChoice(
      { kind: 'passive', passive: power, title: '', description: '', levelText: '' },
      build([], [['power', 2]]),
    );
    expect(owned.level).toBe(2);
    expect(owned.scope).not.toContain('emplacement');
  });

  it('Hâte : le total est un délai en moins (même signe que sa description)', () => {
    const d = describeChoice(
      { kind: 'passive', passive: passive('haste'), title: '', description: '', levelText: '' },
      build([], [['haste', 1]]),
    );
    expect(d.changes[0]?.after.startsWith('−')).toBe(true);
  });

  it('Vitalité : PV max et régénération', () => {
    const d = describeChoice(
      { kind: 'passive', passive: passive('vitality'), title: '', description: '', levelText: '' },
      build([], [['vitality', 1]]),
    );
    expect(d.changes).toEqual([
      { label: 'PV max', before: '+15', after: '+30' },
      { label: 'régénération', before: '+0,3 PV/s', after: '+0,6 PV/s' },
    ]);
  });

  it('soin et or : la raison, et la valeur avant → après', () => {
    const b = build();
    b.player.hp = 64;
    const heal = describeChoice({ kind: 'heal', title: '', description: '', levelText: '' }, b);
    expect(heal.reason).toBe('Tout est au maximum');
    expect(heal.changes[0]).toEqual({ label: 'PV', before: '64', after: '79 / 100' });
    const gold = describeChoice({ kind: 'gold', title: '', description: '', levelText: '' }, b);
    expect(gold.changes[0]).toEqual({ label: 'or', before: '37', after: '47' });
  });
});
