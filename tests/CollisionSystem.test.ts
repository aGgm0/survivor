import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { Enemy } from '../src/entities/Enemy';
import { CollisionSystem } from '../src/systems/CollisionSystem';

const R = ENEMY_TYPES.basic.radius;

function setup(positions: [number, number][]) {
  const pool = new Pool(50, (i) => new Enemy(i));
  const enemies = positions.map(([x, y]) => {
    const e = pool.acquire();
    if (!e) throw new Error();
    e.spawn(ENEMY_TYPES.basic, x, y);
    return e;
  });
  return { pool, enemies, touching: new Array<Enemy>(50), system: new CollisionSystem(50) };
}

describe('CollisionSystem — grille', () => {
  it('trouve les voisins proches après rebuild', () => {
    const { pool, enemies, system } = setup([
      [0, 0],
      [20, 0],
      [500, 500],
    ]);
    system.rebuild(pool);
    const out = new Array<Enemy>(10);
    const n = system.queryNeighbors(0, 0, 30, out);
    const found = out.slice(0, n);
    expect(found).toContain(enemies[0]);
    expect(found).toContain(enemies[1]);
    expect(found).not.toContain(enemies[2]);
  });
});

describe('CollisionSystem — joueur', () => {
  it('sort un ennemi du joueur et le compte comme contact', () => {
    const player = { x: 0, y: 0, vx: 0, vy: 0, radius: 16 };
    const { pool, enemies, touching, system } = setup([[10, 0]]);
    const count = system.pushOutOfPlayer(pool, player, touching);
    const e = enemies[0];
    if (!e) throw new Error();
    expect(count).toBe(1);
    expect(touching[0]).toBe(e);
    expect(Math.hypot(e.x, e.y)).toBeCloseTo(player.radius + R);
  });

  it('annule la vitesse qui rentre dans le joueur, garde celle qui glisse le long', () => {
    const player = { x: 0, y: 0, vx: 0, vy: 0, radius: 16 };
    const { pool, enemies, touching, system } = setup([[20, 0]]);
    const e = enemies[0];
    if (!e) throw new Error();
    e.vx = -80; // fonce vers le joueur
    e.vy = 30; // et glisse sur le côté
    system.pushOutOfPlayer(pool, player, touching);
    expect(e.vx).toBeCloseTo(0);
    expect(e.vy).toBeCloseTo(30);
  });

  it('un ennemi bousculé prend l’élan du joueur (pas de re-téléportation à chaque update)', () => {
    const player = { x: 0, y: 0, vx: 200, vy: 0, radius: 16 }; // fonce vers la droite
    const { pool, enemies, touching, system } = setup([[20, 0]]);
    const e = enemies[0];
    if (!e) throw new Error();
    e.vx = -80;
    system.pushOutOfPlayer(pool, player, touching);
    expect(e.vx).toBeCloseTo(200);
  });

  it('ne compte pas un ennemi éloigné', () => {
    const player = { x: 0, y: 0, vx: 0, vy: 0, radius: 16 };
    const { pool, touching, system } = setup([[200, 0]]);
    expect(system.pushOutOfPlayer(pool, player, touching)).toBe(0);
  });

  it('ne déplace jamais le joueur', () => {
    const player = { x: 0, y: 0, vx: 0, vy: 0, radius: 16 };
    const { pool, touching, system } = setup([
      [5, 0],
      [-5, 3],
    ]);
    system.pushOutOfPlayer(pool, player, touching);
    expect(player).toEqual({ x: 0, y: 0, vx: 0, vy: 0, radius: 16 });
  });
});
