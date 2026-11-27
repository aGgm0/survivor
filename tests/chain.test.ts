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

  it('Arc continu : +2 sauts jusqu’à 450 px, perte de 6 % + 1 % tous les 20 px de saut', () => {
    const arc = new Weapon(WEAPONS.chainLightning);
    arc.level = 5;
    arc.mutation = WEAPONS.chainLightning.mutations[1];
    arc.recompute(NO_MODS);
    expect(arc.jumps).toBe(3 + 1 + 2 + 2);
    // Ennemis espacés de 200 px : hors de portée sans mutation (150), atteints par l'Arc continu
    const far = setup(4, 200);
    far.system.update(1 / 60, [arc], 0, 0, 0);
    expect(far.hits).toHaveLength(4);
    // Perte d'un saut de 200 px : 6 % + 10 % = 16 %
    const d = arc.damage;
    expect(far.hits).toEqual([d, d * 0.84, d * 0.84 ** 2, d * 0.84 ** 3].map((x) => Math.ceil(x)));
    // Horde serrée (40 px) : perte de 8 % seulement par saut
    arc.cooldownTimer = 0;
    const near = setup(20, 40);
    near.system.update(1 / 60, [arc], 0, 0, 0);
    expect(near.hits).toHaveLength(arc.jumps + 1);
    expect(near.hits[1]).toBe(Math.ceil(d * 0.92));
  });

  it('Orage : 5 foudres sans chaîne en plus de la chaîne, jamais deux fois le même ennemi', () => {
    const storm = new Weapon(WEAPONS.chainLightning);
    storm.mutation = WEAPONS.chainLightning.mutations[0];
    storm.recompute(NO_MODS);
    const s = setup(30, 60);
    s.system.update(1 / 60, [storm], 0, 0, 0);
    // chaîne normale (1 + 3 sauts) + 5 foudres à pleins dégâts
    expect(s.hits).toHaveLength(4 + 5);
    expect(s.hits.slice(4)).toEqual(Array(5).fill(Math.ceil(storm.damage)));
    expect(s.list.filter((e) => e.hp < 1000).length).toBe(s.hits.length);
  });

  it('Orage : chaque foudre laisse une zone qui frappe toutes les 0,5 s pendant 1,5 s', () => {
    const storm = new Weapon(WEAPONS.chainLightning);
    storm.mutation = WEAPONS.chainLightning.mutations[0];
    storm.recompute(NO_MODS);
    // Un ennemi pour la chaîne (100 px), un autre loin d'elle (450 px) : la foudre tombe sur lui.
    const s = setup(2, 350);
    for (let t = 0; t < 1.25; t += 1 / 60) s.system.update(1 / 60, [storm], 0, 0, t);
    // chaîne, foudre, puis 3 coups de zone (≈ 0, 0,5 et 1 s) avant la décharge suivante (1,3 s)
    const d = storm.damage;
    expect(s.hits).toEqual([d, d, d * 0.3, d * 0.3, d * 0.3].map((x) => Math.ceil(x)));
  });
});
