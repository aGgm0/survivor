import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES, type EnemyType } from '../src/data/enemies';
import { CROWD } from '../src/data/physics';
import { Enemy } from '../src/entities/Enemy';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { MovementSystem } from '../src/systems/MovementSystem';

const DT = 1 / 60;
const PLAYER = { x: 0, y: 0, vx: 0, vy: 0, radius: 16 };

function setup(spawns: [EnemyType, number, number][]) {
  const pool = new Pool(200, (i) => new Enemy(i));
  const enemies = spawns.map(([type, x, y]) => {
    const e = pool.acquire();
    if (!e) throw new Error();
    e.spawn(type, x, y);
    return e;
  });
  const collisions = new CollisionSystem(200);
  const movement = new MovementSystem(200, collisions);
  const touching = new Array<Enemy>(200);
  /** Simule `seconds` secondes comme GameScene (sans le spawn). */
  const run = (seconds: number) => {
    for (let t = 0; t < seconds / DT; t++) {
      collisions.rebuild(pool);
      movement.update(pool, PLAYER.x, PLAYER.y, DT);
      collisions.pushOutOfPlayer(pool, PLAYER, touching);
    }
  };
  return { enemies, run };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('MovementSystem — poursuite', () => {
  it('accélère progressivement jusqu’à sa vitesse, sans la dépasser', () => {
    const { enemies, run } = setup([[ENEMY_TYPES.basic, 2000, 0]]);
    const e = enemies[0] as Enemy;
    run(DT);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(CROWD.maxAcceleration * DT);
    run(2);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(ENEMY_TYPES.basic.speed);
    expect(e.vx).toBeLessThan(0); // vers le joueur
  });

  it('la vitesse ne change jamais plus vite que l’accélération max (pas de saut)', () => {
    const spawns: [EnemyType, number, number][] = [];
    for (let i = 0; i < 40; i++) {
      spawns.push([i % 3 === 0 ? ENEMY_TYPES.tank : ENEMY_TYPES.fast, 100 + (i % 5) * 8, i * 6]);
    }
    const { enemies, run } = setup(spawns);
    const maxDv = CROWD.maxAcceleration * DT + 1e-9;
    for (let step = 0; step < 300; step++) {
      const before = enemies.map((e) => [e.vx, e.vy] as const);
      run(DT);
      enemies.forEach((e, i) => {
        const [vx, vy] = before[i] as readonly [number, number];
        // pushOutOfPlayer peut seulement RETIRER de la vitesse : on mesure avant ce retrait
        // en vérifiant que la vitesse finale ne dépasse jamais la borne autour de l'ancienne.
        const change = Math.hypot(e.vx - vx, e.vy - vy);
        const removed = Math.hypot(vx, vy) + maxDv - Math.hypot(e.vx, e.vy);
        expect(change <= maxDv || removed >= 0).toBe(true);
      });
    }
  });
});

describe('MovementSystem — vitesse des vagues', () => {
  it('un ennemi de fin de partie (speedMult 1,3) atteint 1,3× sa vitesse de base', () => {
    const { enemies, run } = setup([[ENEMY_TYPES.basic, 3000, 0]]);
    const e = enemies[0] as Enemy;
    e.speedMult = 1.3;
    run(2);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(ENEMY_TYPES.basic.speed * 1.3);
  });
});

describe('MovementSystem — ralentissement', () => {
  it('un ennemi ralenti de 30 % plafonne à 70 % de sa vitesse', () => {
    const pool = new Pool(10, (i) => new Enemy(i));
    const e = pool.acquire();
    if (!e) throw new Error();
    e.spawn(ENEMY_TYPES.basic, 3000, 0);
    e.slowAmount = 0.3;
    e.slowUntil = 100;
    const collisions = new CollisionSystem(10);
    const movement = new MovementSystem(10, collisions);
    for (let i = 0; i < 120; i++) {
      collisions.rebuild(pool);
      movement.update(pool, 0, 0, DT, 1);
    }
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(ENEMY_TYPES.basic.speed * 0.7);
  });
});

describe('MovementSystem — horde', () => {
  it('écarte deux ennemis superposés', () => {
    const { enemies, run } = setup([
      [ENEMY_TYPES.basic, 1000, 0],
      [ENEMY_TYPES.basic, 1000, 0],
    ]);
    run(1);
    const [a, b] = enemies as [Enemy, Enemy];
    expect(dist(a, b)).toBeGreaterThan(ENEMY_TYPES.basic.radius);
  });

  it('un petit coincé contre un tank recule plus que le tank', () => {
    // Loin du joueur et côte à côte (perpendiculaire à la poursuite) pour isoler la répulsion.
    const { enemies, run } = setup([
      [ENEMY_TYPES.tank, 3000, 0],
      [ENEMY_TYPES.fast, 3000, 15],
    ]);
    const [tank, small] = enemies as [Enemy, Enemy];
    run(0.3);
    expect(Math.abs(small.y - 15)).toBeGreaterThan(Math.abs(tank.y - 0) * 2);
  });

  it('un tank derrière un petit collé au joueur le fait glisser sur le côté', () => {
    // Joueur en (0,0). Petit collé au joueur en (26,0), tank qui le chevauche par derrière.
    const contact = PLAYER.radius + ENEMY_TYPES.fast.radius;
    const { enemies, run } = setup([
      [ENEMY_TYPES.fast, contact, 0],
      [ENEMY_TYPES.tank, contact + ENEMY_TYPES.fast.radius + ENEMY_TYPES.tank.radius - 8, 0],
    ]);
    const [small, tank] = enemies as [Enemy, Enemy];
    run(1.5);
    expect(Math.abs(small.y)).toBeGreaterThan(10); // le petit s'est écarté
    expect(dist(tank, PLAYER)).toBeLessThan(PLAYER.radius + ENEMY_TYPES.tank.radius + 4); // le tank a pris sa place
  });

  it('un tank traverse une horde de petits pour atteindre le joueur', () => {
    const spawns: [EnemyType, number, number][] = [];
    // Deux anneaux pleins (sans chevauchement de départ) : basiques collés au joueur, rapides derrière.
    const ring = (type: EnemyType, r: number) => {
      const count = Math.floor((2 * Math.PI * r) / (type.radius * 2));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        spawns.push([type, Math.cos(a) * r, Math.sin(a) * r]);
      }
    };
    ring(ENEMY_TYPES.basic, PLAYER.radius + ENEMY_TYPES.basic.radius);
    ring(ENEMY_TYPES.fast, PLAYER.radius + ENEMY_TYPES.basic.radius * 2 + ENEMY_TYPES.fast.radius);
    // ... et un tank qui arrive de l'extérieur.
    spawns.push([ENEMY_TYPES.tank, 200, 0]);
    const { enemies, run } = setup(spawns);
    const tank = enemies[enemies.length - 1] as Enemy;
    run(10);
    expect(dist(tank, PLAYER)).toBeLessThan(PLAYER.radius + ENEMY_TYPES.tank.radius + 6);
  });

  it('file d’attente : un ennemi bloqué derrière un égal arrête de pousser', () => {
    const contact = PLAYER.radius + ENEMY_TYPES.basic.radius;
    const { enemies, run } = setup([
      [ENEMY_TYPES.basic, contact, 0], // collé au joueur
      [ENEMY_TYPES.basic, contact + ENEMY_TYPES.basic.radius * 2, 0], // juste derrière
    ]);
    const [front, back] = enemies as [Enemy, Enemy];
    run(3);
    // Celui de derrière ne s'enfonce pas dans celui de devant (< 40 % de chevauchement)...
    expect(dist(front, back)).toBeGreaterThan(ENEMY_TYPES.basic.radius * 2 * 0.6);
    // ... et il est presque à l'arrêt au lieu de forcer vers le joueur.
    expect(Math.abs(back.vx)).toBeLessThan(ENEMY_TYPES.basic.speed * 0.3);
  });

  it('même départ → même résultat (déterministe)', () => {
    const make = () =>
      setup([
        [ENEMY_TYPES.basic, 100, 0],
        [ENEMY_TYPES.fast, 100, 0],
        [ENEMY_TYPES.tank, 110, 5],
      ]);
    const a = make();
    const b = make();
    a.run(2);
    b.run(2);
    expect(a.enemies.map((e) => [e.x, e.y])).toEqual(b.enemies.map((e) => [e.x, e.y]));
  });
});
