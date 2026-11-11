import { describe, expect, it } from 'vitest';
import { PASSIVES } from '../src/data/upgrades';
import { MAX_ORBS, WEAPONS, weaponMaxLevel, type WeaponDef } from '../src/data/weapons';
import { Player } from '../src/entities/Player';
import { Weapon } from '../src/entities/Weapon';
import { applyUpgrade, availableUpgrades, type Build } from '../src/systems/upgrades';

const NEUTRAL = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };

function passive(id: string) {
  const p = PASSIVES.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
}

/** Applique `levels` niveaux d'un passif à un joueur neuf, comme au level up. */
function playerWith(id: string, levels: number): Player {
  const build: Build = { player: new Player(), weapons: [], passiveLevels: new Map() };
  for (let i = 0; i < levels; i++) {
    const choice = availableUpgrades(build).find(
      (o) => o.kind === 'passive' && o.passive.id === id,
    );
    if (!choice) throw new Error(`${id} niv ${i + 1} indisponible`);
    applyUpgrade(choice, build);
  }
  return build.player;
}

function weapon(def: WeaponDef, player: Player, mutation = -1): Weapon {
  const w = new Weapon(def);
  w.level = weaponMaxLevel(def);
  if (mutation >= 0) {
    w.mutation = def.mutations?.[mutation] ?? null;
    w.level++;
  }
  w.recompute(player);
  return w;
}

describe('nouveaux passifs : données', () => {
  it('Taille +7 %, Vélocité +10 % (5 niveaux), Duplicateur +1 (3 niveaux)', () => {
    expect(passive('size')).toMatchObject({ amount: 0.07, maxLevel: 5 });
    expect(passive('velocity')).toMatchObject({ amount: 0.1, maxLevel: 5 });
    expect(passive('duplicator')).toMatchObject({ amount: 1, maxLevel: 3 });
  });

  it('le Duplicateur ne va pas au-delà du niveau 3', () => {
    expect(() => playerWith('duplicator', 4)).toThrow();
  });
});

describe('Taille', () => {
  it('grossit projectiles, orbes, aura et explosions (+35 % au niveau 5), pas l’orbite', () => {
    const p = playerWith('size', 5);
    const n = new Player();
    const bolt = weapon(WEAPONS.arcaneBolt, p);
    expect(bolt.projectileRadius).toBeCloseTo(WEAPONS.arcaneBolt.projectileRadius * 1.35);
    const aura = weapon(WEAPONS.burningAura, p);
    expect(aura.radius).toBeCloseTo(weapon(WEAPONS.burningAura, n).radius * 1.35);
    const orbs = weapon(WEAPONS.runicOrbs, p);
    expect(orbs.orbRadius).toBeCloseTo(WEAPONS.runicOrbs.orbRadius * 1.35);
    expect(orbs.orbitDistance).toBe(weapon(WEAPONS.runicOrbs, n).orbitDistance);
    const burst = weapon(WEAPONS.arcaneBolt, p, 1); // Trait éclaté
    expect(burst.explosionRadius).toBeCloseTo(75 * 1.35);
  });
});

describe('Vélocité', () => {
  it('projectiles plus rapides et portée plus longue, orbes qui tournent plus vite', () => {
    const p = playerWith('velocity', 5);
    const bolt = weapon(WEAPONS.arcaneBolt, p);
    expect(bolt.projectileSpeed).toBeCloseTo(WEAPONS.arcaneBolt.projectileSpeed * 1.5);
    expect(bolt.range).toBeCloseTo(
      WEAPONS.arcaneBolt.projectileSpeed * 1.5 * WEAPONS.arcaneBolt.projectileLifetime,
    );
    const orbs = weapon(WEAPONS.runicOrbs, p);
    expect(orbs.angularSpeed).toBeCloseTo(WEAPONS.runicOrbs.angularSpeed * 1.5);
  });
});

describe('Duplicateur', () => {
  it('+1 projectile et +1 orbe par niveau, aussi sur les mutations, jamais sur l’aura', () => {
    const p = playerWith('duplicator', 3);
    const n = new Player();
    expect(weapon(WEAPONS.arcaneBolt, p).count).toBe(weapon(WEAPONS.arcaneBolt, n).count + 3);
    expect(weapon(WEAPONS.runicOrbs, p, 0).count).toBe(3 + 3); // Orbes géants
    expect(weapon(WEAPONS.burningAura, p).count).toBe(0);
  });

  it('Tempête d’orbes + Duplicateur max tient dans la réserve de délais par orbe', () => {
    const storm = weapon(WEAPONS.runicOrbs, playerWith('duplicator', 3), 1);
    expect(storm.count).toBe(12);
    expect(storm.count).toBeLessThanOrEqual(MAX_ORBS);
  });

  it('sans passif, rien ne change (valeurs neutres)', () => {
    const w = new Weapon(WEAPONS.arcaneBolt);
    w.recompute(NEUTRAL);
    expect(w.count).toBe(1);
    expect(w.projectileSpeed).toBe(WEAPONS.arcaneBolt.projectileSpeed);
  });
});
