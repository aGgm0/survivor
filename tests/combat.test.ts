import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES, type EnemyType } from '../src/data/enemies';
import { MAX_ORBS, WEAPONS, weaponRange, type WeaponDef } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { ProjectileSystem } from '../src/systems/ProjectileSystem';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const DT = 1 / 60;
const BOLT = WEAPONS.arcaneBolt;

function setup(spawns: [EnemyType, number, number][] = [], def: WeaponDef = BOLT) {
  const enemies = new Pool(100, (i) => new Enemy(i));
  for (const [type, x, y] of spawns) enemies.acquire()?.spawn(type, x, y);
  const projectiles = new Pool(50, () => new Projectile());
  const collisions = new CollisionSystem(100);
  const killed: Enemy[] = [];
  const hits: [Enemy, number][] = [];
  const events = {
    onHit: (e: Enemy, damage: number) => hits.push([e, damage]),
    onKill: (e: Enemy) => {
      killed.push(e);
      enemies.release(e);
    },
  };
  const weaponSystem = new WeaponSystem(100, collisions, projectiles, events);
  const projectileSystem = new ProjectileSystem(100, collisions, events);
  const weapon = new Weapon(def);
  let now = 0;
  /** Simule `seconds` secondes de combat, joueur immobile en (0, 0). */
  const run = (seconds: number) => {
    for (let t = 0; t < Math.round(seconds / DT); t++) {
      now += DT;
      collisions.rebuild(enemies);
      weaponSystem.update(DT, [weapon], 0, 0, now);
      projectileSystem.update(DT, projectiles);
    }
  };
  const active = <T extends { active: boolean }>(pool: Pool<T>) =>
    pool.items.filter((x) => x.active);
  return { enemies, projectiles, collisions, weaponSystem, weapon, killed, hits, run, active };
}

describe('Aura ardente', () => {
  const AURA = WEAPONS.burningAura;

  it('un ennemi qui entre est brûlé tout de suite, puis toutes les 0,5 s', () => {
    const { hits, run, enemies, active } = setup([[ENEMY_TYPES.tank, 300, 0]], AURA);
    run(0.3); // dehors : rien
    expect(hits).toHaveLength(0);
    active(enemies)[0]?.teleport(50, 0); // il entre à 0,3 s
    run(DT);
    expect(hits).toHaveLength(1); // brûlé immédiatement, sans attendre un "tick commun"
    run(AURA.cooldown - 2 * DT);
    expect(hits).toHaveLength(1); // pas avant 0,5 s
    run(3 * DT);
    expect(hits).toHaveLength(2);
  });

  it('chaque ennemi a sa propre horloge', () => {
    const { hits, run, enemies, active } = setup(
      [
        [ENEMY_TYPES.tank, 50, 0], // dedans dès le début
        [ENEMY_TYPES.tank, 300, 0], // entrera plus tard
      ],
      AURA,
    );
    run(0.2);
    expect(hits).toHaveLength(1);
    active(enemies)[1]?.teleport(-50, 0); // entre à 0,2 s
    run(DT);
    expect(hits).toHaveLength(2); // le 2e est brûlé tout de suite, sans attendre le 1er
  });

  it('blesse à chaque tick les ennemis dans le cercle, pas ceux au-delà', () => {
    const { hits, run } = setup(
      [
        [ENEMY_TYPES.tank, 50, 0], // dans le cercle (rayon 70)
        [ENEMY_TYPES.tank, 300, 0], // hors du cercle
      ],
      AURA,
    );
    run(1.1); // ticks à 0 s, 0,5 s et 1 s
    expect(hits).toHaveLength(3);
    expect(hits.every(([e]) => e.x === 50)).toBe(true);
    expect(hits[0]?.[1]).toBe(AURA.damage);
  });

  it('touche un ennemi dont seul le bord entre dans le cercle', () => {
    const r = AURA.radius + ENEMY_TYPES.tank.radius - 2;
    const { hits, run } = setup([[ENEMY_TYPES.tank, r, 0]], AURA);
    run(DT);
    expect(hits).toHaveLength(1);
  });

  it('son rayon grandit avec les niveaux', () => {
    const { weapon } = setup([], AURA);
    weapon.level = 5;
    weapon.recompute({ damageMult: 1, cooldownMult: 1, knockbackMult: 1 });
    expect(weapon.radius).toBe(AURA.radius + 15 + 15 + 20);
    expect(weapon.damage).toBe(AURA.damage + 2 + 3);
  });

  it('ses kills et ses dégâts comptent pour le damage meter', () => {
    const { weapon, run, killed } = setup([[ENEMY_TYPES.fast, 30, 0]], AURA);
    run(DT);
    expect(killed).toHaveLength(1);
    expect(weapon.kills).toBe(1);
    expect(weapon.totalDamage).toBe(ENEMY_TYPES.fast.hp);
  });
});

describe('Orbes runiques', () => {
  const ORBS = WEAPONS.runicOrbs;

  it('les orbes tournent autour du joueur', () => {
    const { weapon, run } = setup([], ORBS);
    run(1);
    expect(weapon.angle).toBeCloseTo(ORBS.angularSpeed * 1);
  });

  it('un ennemi sur la trajectoire est touché, puis pas retouché avant le délai', () => {
    // Tank immobile pile sur le cercle des orbes : chaque orbe passe dessus.
    const { hits, run } = setup([[ENEMY_TYPES.tank, 0, ORBS.orbitDistance]], ORBS);
    run(ORBS.rehitCooldown * 0.9);
    expect(hits.length).toBe(1);
    run(3);
    // Sur ~3,45 s avec 0,5 s de délai : au plus ~7 coups, jamais un par update (207 updates).
    expect(hits.length).toBeGreaterThan(1);
    expect(hits.length).toBeLessThanOrEqual(Math.ceil(3.45 / ORBS.rehitCooldown) + 1);
  });

  it('délai par orbe : plusieurs orbes sur un boss frappent tous (Tempête d’orbes)', () => {
    const { hits, run, weapon, enemies, active } = setup([[ENEMY_TYPES.boss, 0, 0]], ORBS);
    weapon.level = 5;
    weapon.mutation = ORBS.mutations[1]; // Tempête : 9 orbes
    weapon.recompute({ damageMult: 1, cooldownMult: 1, knockbackMult: 1 });
    // Sur l'orbite, à mi-chemin entre les orbes n° 0 et n° 1 : il chevauche les deux.
    const between = Math.PI / weapon.count;
    active(enemies)[0]?.teleport(
      Math.cos(between) * weapon.orbitDistance,
      Math.sin(between) * weapon.orbitDistance,
    );
    run(DT);
    // Le boss (rayon 48) chevauche plusieurs orbes à la fois : chacun frappe.
    expect(hits.length).toBeGreaterThan(1);
    // Mais un même orbe ne frappe toujours qu'une fois par délai (pas 60 coups/s).
    const first = hits.length;
    run(ORBS.rehitCooldown * 0.5);
    expect(hits.length).toBeLessThanOrEqual(first + weapon.count);
  });

  it('orbite plus large au niveau 5, et encore plus large en Orbes géants', () => {
    const w = new Weapon(ORBS);
    const mods = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };
    w.recompute(mods);
    expect(w.orbitDistance).toBe(80);
    w.level = 5;
    w.recompute(mods);
    expect(w.orbitDistance).toBe(105);
    w.mutation = ORBS.mutations[1]; // Tempête : garde l'orbite du niveau 5
    w.recompute(mods);
    expect(w.orbitDistance).toBe(105);
    w.mutation = ORBS.mutations[0]; // Géants : ×1,25
    w.recompute(mods);
    expect(w.orbitDistance).toBeCloseTo(131.25);
  });

  it('les orbes maximum tiennent dans le tableau de délais', () => {
    const maxBase = ORBS.count + ORBS.levels.reduce((n, l) => n + l.count, 0);
    for (const m of ORBS.mutations) expect(m.count).toBeLessThanOrEqual(MAX_ORBS);
    expect(maxBase).toBeLessThanOrEqual(MAX_ORBS);
  });

  it('un ennemi loin des orbes n’est jamais touché', () => {
    const { hits, run } = setup([[ENEMY_TYPES.tank, 400, 0]], ORBS);
    run(3);
    expect(hits).toHaveLength(0);
  });

  it('+1 orbe par niveau', () => {
    const { weapon } = setup([], ORBS);
    weapon.level = 5;
    weapon.recompute({ damageMult: 1, cooldownMult: 1, knockbackMult: 1 });
    expect(weapon.count).toBe(ORBS.count + 4);
    expect(weapon.damage).toBe(ORBS.damage + 3);
  });
});

describe('WeaponSystem — ciblage', () => {
  it('vise l’ennemi le plus proche à portée', () => {
    const { enemies, collisions, weaponSystem, active } = setup([
      [ENEMY_TYPES.basic, 300, 0],
      [ENEMY_TYPES.basic, -120, 50],
      [ENEMY_TYPES.basic, 0, 400],
    ]);
    collisions.rebuild(enemies);
    expect(weaponSystem.findNearest(0, 0, 1000)).toBe(active(enemies)[1]);
  });

  it('ignore les ennemis hors de portée', () => {
    const { enemies, collisions, weaponSystem } = setup([[ENEMY_TYPES.basic, 900, 0]]);
    collisions.rebuild(enemies);
    expect(weaponSystem.findNearest(0, 0, 500)).toBeNull();
  });
});

describe('WeaponSystem — tir', () => {
  it('ne tire pas sans cible, mais reste prête', () => {
    const { projectiles, weapon, run } = setup();
    run(3);
    expect(projectiles.activeCount).toBe(0);
    expect(weapon.cooldownTimer).toBeLessThanOrEqual(0);
  });

  it('tire immédiatement dès qu’une cible arrive, puis respecte le cooldown', () => {
    const { enemies, projectiles, run } = setup();
    run(2); // pas de cible pendant 2 s
    enemies.acquire()?.spawn(ENEMY_TYPES.tank, weaponRange(BOLT) - 50, 0);
    run(DT);
    expect(projectiles.activeCount).toBe(1); // tir immédiat, pas de "rattrapage" des 2 s
    run(BOLT.cooldown - 3 * DT);
    expect(projectiles.activeCount).toBe(1); // pas de 2e tir avant le cooldown
  });

  it('le projectile part vers la cible', () => {
    const { enemies, projectiles, run, active } = setup();
    enemies.acquire()?.spawn(ENEMY_TYPES.tank, 0, 400);
    run(DT);
    const p = active(projectiles)[0];
    if (!p) throw new Error();
    expect(p.vx).toBeCloseTo(0);
    expect(p.vy).toBeCloseTo(BOLT.projectileSpeed);
  });
});

describe('ProjectileSystem', () => {
  it('un rapide (5 PV) meurt en un coup et est compté', () => {
    const { killed, weapon, run, enemies } = setup([[ENEMY_TYPES.fast, 200, 0]]);
    run(0.9);
    expect(killed).toHaveLength(1);
    expect(enemies.activeCount).toBe(0);
    expect(weapon.kills).toBe(1);
  });

  it('un basique (20 PV) encaisse exactement 2 coups', () => {
    const { killed, run, active, enemies } = setup([[ENEMY_TYPES.basic, 200, 0]]);
    run(0.9); // 1er coup
    expect(killed).toHaveLength(0);
    expect(active(enemies)[0]?.hp).toBe(ENEMY_TYPES.basic.hp - BOLT.damage);
    run(1); // 2e coup
    expect(killed).toHaveLength(1);
  });

  it('un tank (60 PV) encaisse plusieurs coups avant de mourir', () => {
    const { killed, run, active, enemies } = setup([[ENEMY_TYPES.tank, 200, 0]]);
    run(2.5);
    expect(killed).toHaveLength(0);
    expect(active(enemies)[0]?.hp).toBeLessThan(ENEMY_TYPES.tank.hp);
    run(5);
    expect(killed).toHaveLength(1);
  });

  it('damage meter : seuls les dégâts utiles sont comptés (pas l’excédent)', () => {
    const { weapon, run } = setup([[ENEMY_TYPES.fast, 200, 0]]); // 5 PV, l'arme fait 10
    run(1);
    expect(weapon.totalDamage).toBe(ENEMY_TYPES.fast.hp);
  });

  it('le projectile disparaît après sa durée de vie s’il ne touche rien', () => {
    const { projectiles, run, enemies, active } = setup([[ENEMY_TYPES.basic, 300, 0]]);
    run(DT); // tir
    const target = active(enemies)[0];
    if (target) enemies.release(target); // la cible disparaît : le projectile file dans le vide
    run(BOLT.projectileLifetime + 0.1);
    expect(projectiles.activeCount).toBe(0);
  });

  it('signale chaque impact (y compris le coup fatal) avec ses dégâts', () => {
    const { hits, run, killed } = setup([[ENEMY_TYPES.basic, 200, 0]]);
    run(2); // 2 coups pour un basique
    expect(hits.map(([, d]) => d)).toEqual([BOLT.damage, BOLT.damage]);
    expect(killed).toHaveLength(1);
  });

  it('un projectile ne touche qu’un seul ennemi', () => {
    // Deux rapides (morts en 1 coup) collés, dans l'axe du tir.
    const { killed, run } = setup([
      [ENEMY_TYPES.fast, 200, 0],
      [ENEMY_TYPES.fast, 212, 0],
    ]);
    run(0.6); // un seul tir a eu le temps de partir et d'arriver
    expect(killed).toHaveLength(1);
  });
});
