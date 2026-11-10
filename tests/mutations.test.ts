import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { WEAPONS, weaponMaxLevel, type MutationDef } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { buildDamageReport } from '../src/systems/runReport';
import { slowFactor } from '../src/systems/status';
import { applyUpgrade, mutationChoices } from '../src/systems/upgrades';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const NO_MODS = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };
const AURA = WEAPONS.burningAura;
const [BLAZE, TOXIC] = AURA.mutations;

function maxedAura(): Weapon {
  const w = new Weapon(AURA);
  w.level = weaponMaxLevel(AURA);
  w.recompute(NO_MODS);
  return w;
}

describe('mutation — quand', () => {
  it('une arme au niveau max, avec des mutations, peut muter une seule fois', () => {
    const w = new Weapon(AURA);
    expect(w.canMutate).toBe(false); // niveau 1
    w.level = weaponMaxLevel(AURA);
    expect(w.canMutate).toBe(true);
    w.mutation = BLAZE;
    expect(w.canMutate).toBe(false); // déjà mutée
  });

  it('propose exactement les 2 variantes de l’arme', () => {
    const choices = mutationChoices(maxedAura());
    expect(choices.map((c) => c.kind)).toEqual(['mutation', 'mutation']);
    expect(choices.map((c) => c.title)).toEqual([`★ ${BLAZE.name}`, `★ ${TOXIC.name}`]);
  });
});

describe('mutation — effets sur les stats', () => {
  it('Brasier : rayon ×1,6, dégâts ×0,6 ; nouveau nom et nouvelle couleur', () => {
    const w = maxedAura();
    const [radius, damage] = [w.radius, w.damage];
    const build = { player: undefined as never, weapons: [w], passiveLevels: new Map() };
    applyUpgrade(mutationChoices(w)[0] as Parameters<typeof applyUpgrade>[0], build);
    w.recompute(NO_MODS);
    expect(w.radius).toBeCloseTo(radius * 1.6);
    expect(w.damage).toBeCloseTo(damage * 0.6);
    expect(w.displayName).toBe('Brasier');
    expect(w.color).toBe(BLAZE.color);
  });

  it('Aura toxique : mêmes rayon et dégâts', () => {
    const w = maxedAura();
    const [radius, damage] = [w.radius, w.damage];
    w.mutation = TOXIC;
    w.recompute(NO_MODS);
    expect([w.radius, w.damage]).toEqual([radius, damage]);
  });

  it('le damage meter affiche le nom de la mutation avec une étoile', () => {
    const w = maxedAura();
    w.mutation = TOXIC;
    expect(buildDamageReport([w])[0]?.name).toBe('★ Aura toxique');
  });
});

describe('mutation — effets en jeu', () => {
  function hitOnce(mutation: MutationDef) {
    const enemies = new Pool(10, (i) => new Enemy(i));
    const e = enemies.acquire();
    e?.spawn(ENEMY_TYPES.tank, 50, 0);
    const collisions = new CollisionSystem(10);
    collisions.rebuild(enemies);
    const system = new WeaponSystem(10, collisions, new Pool(1, () => new Projectile()), {
      onHit: () => {},
      onKill: () => {},
    });
    const w = maxedAura();
    w.mutation = mutation;
    w.recompute(NO_MODS);
    system.update(1 / 60, [w], 0, 0, 10);
    if (!e) throw new Error();
    return { e, w };
  }

  it('Brasier ralentit de 30 % les ennemis brûlés', () => {
    const { e } = hitOnce(BLAZE);
    expect(slowFactor(e, 10)).toBeCloseTo(0.7);
  });

  it('Aura toxique empoisonne, et le poison compte pour l’aura', () => {
    const { e, w } = hitOnce(TOXIC);
    expect(e.poisonSource).toBe(w);
    // Aura niv 5 sans bonus : 10 dégâts × 0,6 = 6/s (la valeur du plan validé)
    expect(e.poisonDps).toBeCloseTo(6);
    expect(slowFactor(e, 10)).toBe(1); // pas de ralentissement
  });

  it('le passif Puissance renforce aussi le poison', () => {
    const enemies = new Pool(10, (i) => new Enemy(i));
    const e = enemies.acquire();
    e?.spawn(ENEMY_TYPES.tank, 50, 0);
    const collisions = new CollisionSystem(10);
    collisions.rebuild(enemies);
    const system = new WeaponSystem(10, collisions, new Pool(1, () => new Projectile()), {
      onHit: () => {},
      onKill: () => {},
    });
    const w = maxedAura();
    w.mutation = TOXIC;
    w.recompute({ ...NO_MODS, damageMult: 1.5 });
    system.update(1 / 60, [w], 0, 0, 10);
    expect(e?.poisonDps).toBeCloseTo(6 * 1.5);
  });

  it('le poison suit les dégâts de l’aura (un tick de 0,5 s passe de 3 à 4,5 avec +50 %)', () => {
    const w = maxedAura();
    w.mutation = TOXIC;
    w.recompute({ ...NO_MODS, damageMult: 1.5 });
    const perTick = w.damage * (TOXIC.poison?.dpsRatio ?? 0) * 0.5;
    expect(perTick).toBeCloseTo(4.5);
  });
});
