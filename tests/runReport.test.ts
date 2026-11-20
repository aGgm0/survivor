import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/data/weapons';
import { Weapon } from '../src/entities/Weapon';
import { buildDamageReport } from '../src/systems/runReport';

function weapon(def: (typeof WEAPONS)[keyof typeof WEAPONS], damage: number, kills: number) {
  const w = new Weapon(def);
  w.totalDamage = damage;
  w.kills = kills;
  return w;
}

describe('buildDamageReport (damage meter)', () => {
  it('trie les armes par dégâts décroissants avec leur part du total', () => {
    const report = buildDamageReport([
      weapon(WEAPONS.arcaneBolt, 300, 20),
      weapon(WEAPONS.burningAura, 600, 50),
      weapon(WEAPONS.runicOrbs, 100, 5),
    ]);
    expect(report.map((r) => r.name)).toEqual([
      'Aura ardente',
      'Trait arcanique',
      'Orbes runiques',
    ]);
    expect(report.map((r) => r.share)).toEqual([0.6, 0.3, 0.1]);
    expect(report[0]?.kills).toBe(50);
  });

  it('icône de l’arme, ou de sa mutation si elle est mutée (comme dans le HUD)', () => {
    const orbs = weapon(WEAPONS.runicOrbs, 10, 0);
    orbs.mutation = WEAPONS.runicOrbs.mutations?.[0] ?? null;
    const [bolt, mutated] = buildDamageReport([weapon(WEAPONS.arcaneBolt, 20, 0), orbs]);
    expect(bolt?.icon).toBe('arcaneBolt');
    expect(bolt?.short).toBe(WEAPONS.arcaneBolt.short);
    expect(mutated?.icon).toBe(orbs.mutation?.id);
    expect(mutated?.short).toBe(orbs.mutation?.short);
  });

  it('arrondit les dégâts (les passifs créent des décimales)', () => {
    const [row] = buildDamageReport([weapon(WEAPONS.arcaneBolt, 123.6, 1)]);
    expect(row?.damage).toBe(124);
  });

  it('aucune arme n’a fait de dégâts : parts à 0, sans division par zéro', () => {
    const [row] = buildDamageReport([weapon(WEAPONS.arcaneBolt, 0, 0)]);
    expect(row?.share).toBe(0);
  });
});
