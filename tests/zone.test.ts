import { describe, expect, it } from 'vitest';
import { PLAIN_ENEMY_TYPES as ENEMY_TYPES } from '../sim/plainEnemies';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES as REAL_TYPES, type EnemyType } from '../src/data/enemies';
import { WEAPONS } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { slowFactor } from '../src/systems/status';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const NO_MODS = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };
const DT = 1 / 60;

/** Ennemis immobiles aux positions données ; le joueur pose ses zones en (0, 0) puis s'en va. */
function setup(positions: [number, number][], type: EnemyType = ENEMY_TYPES.basic) {
  const enemies = new Pool(20, (i) => new Enemy(i));
  for (const [x, y] of positions) {
    const e = enemies.acquire();
    e?.spawn(type, x, y);
    if (e) e.hp = 10_000;
  }
  const list = enemies.items.filter((e) => e.active);
  const collisions = new CollisionSystem(20);
  const hits = new Map<Enemy, number>();
  let explosions = 0;
  const system = new WeaponSystem(20, collisions, new Pool(1, () => new Projectile()), {
    onHit: (e) => hits.set(e, (hits.get(e) ?? 0) + 1),
    onKill: () => {},
    onExplosion: () => explosions++,
  });
  const run = (w: Weapon, from: number, seconds: number, playerX = 0) => {
    for (let t = 0; t < seconds - 1e-9; t += DT) {
      list.forEach((e, i) => {
        const [x, y] = positions[i] ?? [0, 0];
        e.x = x; // on les garde en place (le recul les pousserait)
        e.y = y;
      });
      collisions.rebuild(enemies);
      system.update(DT, [w], playerX, 0, from + t);
    }
  };
  return { list, hits, run, explosions: () => explosions };
}

function caltrops(mutation?: 0 | 1): Weapon {
  const w = new Weapon(WEAPONS.caltrops);
  if (mutation !== undefined) w.mutation = WEAPONS.caltrops.mutations[mutation];
  w.recompute(NO_MODS);
  return w;
}

describe('Chausse-trapes', () => {
  it('blesse dès l’entrée puis toutes les 0,5 s, seulement dans la zone, pendant 4 s', () => {
    const { list, hits, run } = setup([
      [20, 0], // dans la zone (rayon 40)
      [200, 0], // loin
    ]);
    const w = caltrops();
    run(w, 0, 1.1); // la zone est posée tout de suite (t = 0) ; le joueur reste là
    expect(hits.get(list[0]!)).toBe(3); // t = 0, ~0,5 et ~1 (à la frame près)
    expect(hits.get(list[1]!)).toBeUndefined();
  });

  it('la zone reste quand le joueur part, puis disparaît au bout de sa durée', () => {
    const { list, hits, run } = setup([[0, 0]]);
    const w = caltrops();
    run(w, 0, DT); // pose en (0, 0)
    hits.clear();
    run(w, DT, 1.5, 1000); // le joueur est loin : la zone, elle, blesse toujours
    expect(hits.get(list[0]!)).toBeGreaterThan(0);
    hits.clear();
    run(w, 5, 1, 1000); // après 4 s : plus rien (les nouvelles zones sont loin, sous le joueur)
    expect(hits.get(list[0]!)).toBeUndefined();
  });

  it('Mines : une seule explosion au premier contact, qui touche tout autour', () => {
    const { list, hits, run, explosions } = setup([
      [10, 0],
      [60, 0], // hors de la mine (40) mais dans l'explosion (80)
    ]);
    const w = caltrops(0);
    run(w, 0, 0.5);
    expect(explosions()).toBe(1);
    expect(hits.get(list[0]!)).toBe(1);
    expect(hits.get(list[1]!)).toBe(1);
  });

  it('Champ de ronces : ralentit les ennemis, pas les élites', () => {
    const { list, run } = setup([[10, 0]]);
    run(caltrops(1), 0, 0.1);
    expect(slowFactor(list[0]!, 0.05)).toBeCloseTo(0.7);
    const elite = setup([[10, 0]], REAL_TYPES.basicElite);
    elite.run(caltrops(1), 0, 0.1);
    expect(slowFactor(elite.list[0]!, 0.05)).toBe(1);
  });
});
