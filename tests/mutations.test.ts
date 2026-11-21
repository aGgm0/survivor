import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { WEAPONS, weaponMaxLevel, type MutationDef } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { ProjectileSystem } from '../src/systems/ProjectileSystem';
import { buildDamageReport } from '../src/systems/runReport';
import { slowFactor } from '../src/systems/status';
import { applyUpgrade, mutationChoices } from '../src/systems/upgrades';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const NO_MODS = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };
const AURA = WEAPONS.burningAura;
const [FROST, FURNACE] = AURA.mutations;
/** Mutation fabriquée pour tester le poison (plus aucune arme ne l'a depuis le 2026-11-21). */
const POISON_TEST: MutationDef = {
  id: 'poisonTest',
  name: 'Poison (test)',
  short: 'Pt',
  description: '',
  color: '#7cfc00',
  poison: { dpsRatio: 0.6, duration: 3 },
};

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
    w.mutation = FROST;
    expect(w.canMutate).toBe(false); // déjà mutée
  });

  it('propose exactement les 2 variantes de l’arme', () => {
    const choices = mutationChoices(maxedAura());
    expect(choices.map((c) => c.kind)).toEqual(['mutation', 'mutation']);
    expect(choices.map((c) => c.title)).toEqual([`★ ${FROST.name}`, `★ ${FURNACE.name}`]);
  });
});

describe('mutation — effets sur les stats', () => {
  it('Aura de givre : rayon ×1,4, dégâts ×0,6, toutes les 0,6 s ; nouveau nom et couleur', () => {
    const w = maxedAura();
    const [radius, damage] = [w.radius, w.damage];
    const build = { player: undefined as never, weapons: [w], passiveLevels: new Map() };
    applyUpgrade(mutationChoices(w)[0] as Parameters<typeof applyUpgrade>[0], build);
    w.recompute(NO_MODS);
    expect(w.radius).toBeCloseTo(radius * 1.4);
    expect(w.damage).toBeCloseTo(damage * 0.6);
    expect(w.cooldown).toBeCloseTo(0.6);
    expect(w.displayName).toBe('Aura de givre');
    expect(w.color).toBe(FROST.color);
  });

  it('Fournaise : même rayon, dégâts ×4, un souffle toutes les 1,5 s (la Hâte compte)', () => {
    const w = maxedAura();
    const [radius, damage] = [w.radius, w.damage];
    w.mutation = FURNACE;
    w.recompute(NO_MODS);
    expect(w.radius).toBeCloseTo(radius);
    expect(w.damage).toBeCloseTo(damage * 4);
    expect(w.cooldown).toBeCloseTo(1.5);
    w.recompute({ ...NO_MODS, cooldownMult: 0.5 });
    expect(w.cooldown).toBeCloseTo(0.75);
  });

  it('le damage meter affiche le nom de la mutation avec une étoile', () => {
    const w = maxedAura();
    w.mutation = FURNACE;
    expect(buildDamageReport([w])[0]?.name).toBe('★ Fournaise');
  });
});

describe('mutations du Trait arcanique', () => {
  const BOLT = WEAPONS.arcaneBolt;
  const [PIERCE, BURST] = BOLT.mutations;

  /** Un tir unique dans l'axe +x, avec des ennemis posés aux positions données. */
  function shoot(mutation: MutationDef, positions: [number, number][], seconds = 1.2) {
    const enemies = new Pool(20, (i) => new Enemy(i));
    for (const [x, y] of positions) enemies.acquire()?.spawn(ENEMY_TYPES.tank, x, y);
    const projectiles = new Pool(10, () => new Projectile());
    const collisions = new CollisionSystem(20);
    const hits: Enemy[] = [];
    const explosions: number[] = [];
    const events = {
      onHit: (e: Enemy) => hits.push(e),
      onKill: () => {},
      onExplosion: (_x: number, _y: number, r: number) => explosions.push(r),
    };
    const flight = new ProjectileSystem(20, collisions, events);
    const w = new Weapon(BOLT);
    w.level = weaponMaxLevel(BOLT);
    w.mutation = mutation;
    w.recompute(NO_MODS);
    projectiles.acquire()?.launch(w, BOLT.projectileLifetime, 0, 0, 1, 0);
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      collisions.rebuild(enemies);
      flight.update(1 / 60, projectiles);
    }
    return { hits, explosions, projectiles, w };
  }

  it('Trait perçant traverse 5 ennemis, puis disparaît (le 6e n’est pas touché)', () => {
    const { hits, projectiles } = shoot(PIERCE, [
      [80, 0],
      [160, 0],
      [240, 0],
      [320, 0],
      [400, 0],
      [480, 0],
    ]);
    expect(new Set(hits).size).toBe(5);
    expect(hits).toHaveLength(5); // jamais deux fois le même
    expect(projectiles.activeCount).toBe(0);
  });

  it('Trait perçant : dégâts ×0,9', () => {
    const w = new Weapon(BOLT);
    w.level = weaponMaxLevel(BOLT);
    w.recompute(NO_MODS);
    const base = w.damage;
    w.mutation = PIERCE;
    w.recompute(NO_MODS);
    expect(w.damage).toBeCloseTo(base * 0.9);
  });

  it('Trait éclaté : explose sur le 1er ennemi et touche ceux autour (pas ceux loin)', () => {
    const { hits, explosions, projectiles } = shoot(BURST, [
      [150, 0], // cible
      [180, 30], // à moins de 75 px de l'impact
      [400, 0], // loin
    ]);
    expect(explosions).toEqual([BURST.explosion?.radius]);
    expect(hits).toHaveLength(2); // la cible + le voisin
    expect(hits.some((e) => e.x > 350)).toBe(false);
    expect(projectiles.activeCount).toBe(0);
  });

  it('Trait éclaté : les voisins prennent 70 % des dégâts', () => {
    const { w } = shoot(BURST, [
      [150, 0],
      [180, 30],
    ]);
    const tankHp = ENEMY_TYPES.tank.hp;
    // Le voisin a perdu 70 % des dégâts du tir (vérifié via le damage meter de l'arme).
    expect(w.totalDamage).toBeCloseTo(
      Math.min(Math.ceil(w.damage), tankHp) + Math.min(Math.ceil(w.damage * 0.7), tankHp),
    );
  });
});

describe('mutations des Orbes runiques', () => {
  const ORBS = WEAPONS.runicOrbs;
  const [GIANT, STORM] = ORBS.mutations;

  function mutated(mutation: MutationDef): { base: Weapon; w: Weapon } {
    const make = () => {
      const w = new Weapon(ORBS);
      w.level = weaponMaxLevel(ORBS);
      w.recompute(NO_MODS);
      return w;
    };
    const w = make();
    w.mutation = mutation;
    w.recompute(NO_MODS);
    return { base: make(), w };
  }

  it('Orbes géants : 3 orbes 2,2× plus gros, dégâts ×1,8, rotation ×0,85, recul ×1', () => {
    const { base, w } = mutated(GIANT);
    expect(w.count).toBe(3);
    expect(w.orbRadius).toBeCloseTo(ORBS.orbRadius * 2.2);
    expect(w.damage).toBeCloseTo(base.damage * 1.8);
    expect(w.knockback).toBeCloseTo(base.knockback);
    expect(w.angularSpeed).toBeCloseTo(ORBS.angularSpeed * 0.85);
  });

  it('Tempête d’orbes : 9 orbes, rotation ×1,6, dégâts ×1, recul ×0,3', () => {
    const { base, w } = mutated(STORM);
    expect(w.count).toBe(9);
    expect(w.angularSpeed).toBeCloseTo(ORBS.angularSpeed * 1.6);
    expect(w.damage).toBeCloseTo(base.damage);
    expect(w.knockback).toBeCloseTo(base.knockback * 0.3);
    expect(w.orbRadius).toBe(ORBS.orbRadius);
  });

  it('les orbes géants touchent plus loin de leur trajectoire (hitbox agrandie)', () => {
    // Basique (rayon 14) à 35 px du cercle des orbes (de CETTE arme : l'orbite des géants est
    // plus large) : hors de portée d'un orbe normal (13 + 14 = 27 px), mais dans celle d'un
    // orbe géant (13 × 2,2 + 14 ≈ 43 px).
    const hitWith = (w: Weapon) => {
      const enemies = new Pool(10, (i) => new Enemy(i));
      enemies.acquire()?.spawn(ENEMY_TYPES.basic, w.orbitDistance + 35, 0);
      const collisions = new CollisionSystem(10);
      let hits = 0;
      const system = new WeaponSystem(10, collisions, new Pool(1, () => new Projectile()), {
        onHit: () => hits++,
        onKill: () => {},
      });
      collisions.rebuild(enemies);
      system.update(1 / 60, [w], 0, 0, 1);
      return hits;
    };
    const { base, w } = mutated(GIANT);
    expect(hitWith(base)).toBe(0);
    expect(hitWith(w)).toBe(1);
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

  it('Aura de givre ralentit de 45 % les ennemis gelés', () => {
    const { e } = hitOnce(FROST);
    expect(slowFactor(e, 10)).toBeCloseTo(0.55);
  });

  it('une aura à poison empoisonne, et le poison compte pour l’aura', () => {
    const { e, w } = hitOnce(POISON_TEST);
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
    w.mutation = POISON_TEST;
    w.recompute({ ...NO_MODS, damageMult: 1.5 });
    system.update(1 / 60, [w], 0, 0, 10);
    expect(e?.poisonDps).toBeCloseTo(6 * 1.5);
  });

  it('le poison suit les dégâts de l’aura (un tick de 0,5 s passe de 3 à 4,5 avec +50 %)', () => {
    const w = maxedAura();
    w.mutation = POISON_TEST;
    w.recompute({ ...NO_MODS, damageMult: 1.5 });
    const perTick = w.damage * (POISON_TEST.poison?.dpsRatio ?? 0) * 0.5;
    expect(perTick).toBeCloseTo(4.5);
  });
});

describe('Fournaise : souffle commun', () => {
  function setup() {
    const enemies = new Pool(10, (i) => new Enemy(i));
    const a = enemies.acquire();
    const b = enemies.acquire();
    a?.spawn(ENEMY_TYPES.tank, 50, 0);
    b?.spawn(ENEMY_TYPES.tank, -50, 0);
    const collisions = new CollisionSystem(10);
    collisions.rebuild(enemies);
    let hits = 0;
    let pulses = 0;
    const system = new WeaponSystem(10, collisions, new Pool(1, () => new Projectile()), {
      onHit: () => hits++,
      onKill: () => {},
      onAuraPulse: () => pulses++,
    });
    const w = maxedAura();
    w.mutation = FURNACE;
    w.recompute(NO_MODS);
    return { system, w, count: () => ({ hits, pulses }) };
  }

  it('brûle tous les ennemis de la zone en même temps, puis rien jusqu’au souffle suivant', () => {
    const { system, w, count } = setup();
    system.update(1 / 60, [w], 0, 0, 10);
    expect(count()).toEqual({ hits: 2, pulses: 1 });
    system.update(1 / 60, [w], 0, 0, 11); // 1 s plus tard : pas encore
    expect(count()).toEqual({ hits: 2, pulses: 1 });
    system.update(1 / 60, [w], 0, 0, 11.6); // 1,6 s après : souffle suivant
    expect(count()).toEqual({ hits: 4, pulses: 2 });
    expect(w.lastPulseAt).toBe(11.6);
  });
});
