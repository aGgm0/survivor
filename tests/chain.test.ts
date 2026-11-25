import { describe, expect, it } from 'vitest';
import { PLAIN_ENEMY_TYPES as ENEMY_TYPES } from '../sim/plainEnemies';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { WEAPONS } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const NO_MODS = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };

/** Ennemis basiques (sans résistances) en ligne, espacés de `gap` px à partir de x = `start`. */
function setup(count: number, gap: number, start = 100) {
  const enemies = new Pool(50, (i) => new Enemy(i));
  for (let i = 0; i < count; i++) {
    const e = enemies.acquire();
    e?.spawn(ENEMY_TYPES.basic, start + i * gap, 0);
    if (e) e.hp = 1000;
  }
  const collisions = new CollisionSystem(50);
  collisions.rebuild(enemies);
  const hits: number[] = [];
  const system = new WeaponSystem(
    50,
    collisions,
    new Pool(1, () => new Projectile()),
    { onHit: (_e, damage) => hits.push(damage), onKill: () => {} },
    new Rng(1),
  );
  const list = enemies.items.filter((e) => e.active);
  return { system, hits, list };
}

describe('Éclair en chaîne', () => {
  it('frappe le plus proche puis saute 3 fois, −15 % par saut', () => {
    const w = new Weapon(WEAPONS.chainLightning);
    w.recompute(NO_MODS);
    const { system, hits } = setup(6, 100);
    system.update(1 / 60, [w], 0, 0, 0);
    expect(hits).toHaveLength(4); // 1 cible + 3 sauts (il y a 6 ennemis)
    const d = w.damage;
    expect(hits).toEqual([d, d * 0.85, d * 0.85 ** 2, d * 0.85 ** 3].map((x) => Math.ceil(x)));
  });

  it('ne saute pas au-delà de sa portée de saut', () => {
    const w = new Weapon(WEAPONS.chainLightning);
    w.recompute(NO_MODS);
    const { system, hits } = setup(3, 400);
    system.update(1 / 60, [w], 0, 0, 0);
    expect(hits).toHaveLength(1);
  });

  it('personne à portée : reste prête, sans décharge', () => {
    const w = new Weapon(WEAPONS.chainLightning);
    w.recompute(NO_MODS);
    const { system, hits } = setup(1, 0, 900);
    system.update(1 / 60, [w], 0, 0, 0);
    expect(hits).toHaveLength(0);
    expect(w.cooldownTimer).toBe(0);
  });

  it('Arc continu : +3 sauts, perte réduite ; Orage : des chaînes en plus, sans retoucher un ennemi', () => {
    const arc = new Weapon(WEAPONS.chainLightning);
    arc.level = 5;
    arc.mutation = WEAPONS.chainLightning.mutations[1];
    arc.recompute(NO_MODS);
    expect(arc.jumps).toBe(3 + 1 + 2 + 3);
    expect(arc.falloff).toBe(0.08);
    const a = setup(20, 60);
    a.system.update(1 / 60, [arc], 0, 0, 0);
    expect(a.hits).toHaveLength(arc.jumps + 1);
    // Chaque saut perd un peu : le dernier coup est plus faible que le premier
    expect(a.hits.at(-1) ?? 0).toBeLessThan(a.hits[0] ?? 0);

    const storm = new Weapon(WEAPONS.chainLightning);
    storm.mutation = WEAPONS.chainLightning.mutations[0];
    storm.recompute(NO_MODS);
    const s = setup(30, 60);
    s.system.update(1 / 60, [storm], 0, 0, 0);
    // 3 chaînes de 4 coups au plus, jamais deux fois le même ennemi
    expect(s.hits.length).toBeGreaterThan(4);
    expect(s.hits.length).toBeLessThanOrEqual(12);
    expect(s.list.filter((e) => e.hp < 1000).length).toBe(s.hits.length);
  });
});
