import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';
import { CHARACTERS } from '../src/data/characters';
import { ENEMY_TYPES } from '../src/data/enemies';
import { WEAPONS, weaponMaxLevel } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Player } from '../src/entities/Player';
import { Projectile } from '../src/entities/Projectile';
import { Weapon, type WeaponModifiers } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { ProjectileSystem } from '../src/systems/ProjectileSystem';
import { WeaponSystem } from '../src/systems/WeaponSystem';

const DT = 1 / 60;
const SWORD = WEAPONS.sword;
const [WHIRL, THRUST] = SWORD.mutations;
const NEUTRAL: WeaponModifiers = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };

/**
 * Joueur immobile en (0, 0), regardant vers la droite (+x). Des tanks (90 PV) placés aux
 * positions données : assez résistants pour encaisser plusieurs coups sans mourir.
 */
function setup(positions: [number, number][], weapon = new Weapon(SWORD)) {
  const enemies = new Pool(50, (i) => new Enemy(i));
  for (const [x, y] of positions) enemies.acquire()?.spawn(ENEMY_TYPES.tank, x, y, 100);
  const collisions = new CollisionSystem(50);
  const projectiles = new Pool(20, () => new Projectile());
  const hits: Enemy[] = [];
  const slashes: number[] = [];
  const events = {
    onHit: (e: Enemy) => hits.push(e),
    onKill: (e: Enemy) => enemies.release(e),
    onSlash: (_x: number, _y: number, _a: number, arc: number) => slashes.push(arc),
  };
  const system = new WeaponSystem(50, collisions, projectiles, events);
  const flight = new ProjectileSystem(50, collisions, events);
  let now = 0;
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      now += DT;
      collisions.rebuild(enemies);
      system.update(DT, [weapon], 0, 0, now, 1, 0);
      flight.update(DT, projectiles);
    }
  };
  const list = enemies.items.filter((e) => e.active);
  return { run, hits, slashes, weapon, list, projectiles };
}

describe('Épée — le coup', () => {
  it('frappe tout de suite, devant (dans la portée et l’arc), pas derrière ni trop loin', () => {
    const { run, hits, list } = setup([
      [80, 0], // devant
      [60, 60], // devant, à 45° : dans l'arc de 120°
      [-80, 0], // derrière
      [300, 0], // trop loin
    ]);
    run(DT);
    expect(hits).toHaveLength(2);
    expect(hits).toContain(list[0]);
    expect(hits).toContain(list[1]);
  });

  it('un coup toutes les 1,2 s (chaque ennemi touché une fois par coup)', () => {
    const { run, hits, slashes } = setup([[80, 0]]);
    run(1.1);
    expect(hits).toHaveLength(1);
    run(0.2);
    expect(hits).toHaveLength(2);
    expect(slashes).toHaveLength(2);
  });

  it('suit la direction du joueur (gardée à l’arrêt)', () => {
    const p = new Player();
    p.update(DT, 0, -1); // vers le haut
    p.update(DT, 0, 0); // arrêt
    expect(p.facingX).toBeCloseTo(0);
    expect(p.facingY).toBeCloseTo(-1);
  });
});

describe('Épée — niveaux et passifs', () => {
  it('niveau 5 : 28 dégâts, arc 160°, délai −20 %, portée 135 px', () => {
    const w = new Weapon(SWORD);
    w.level = weaponMaxLevel(SWORD);
    w.recompute(NEUTRAL);
    expect(w.damage).toBe(SWORD.damage + 5 + 7);
    expect(w.damage).toBe(28);
    expect(w.arc).toBeCloseTo((160 * Math.PI) / 180);
    expect(w.cooldown).toBeCloseTo(0.96);
    expect(w.range).toBe(135);
  });

  it('Duplicateur : aucun effet sur l’Épée (nerf)', () => {
    const w = new Weapon(SWORD);
    w.recompute({ ...NEUTRAL, extraCount: 2 });
    expect(w.count).toBe(1);
    const { run, hits } = setup([[80, 0]], w);
    run(0.5); // un seul coup par attaque
    expect(hits).toHaveLength(1);
  });

  it('Taille : portée plus longue, même ouverture', () => {
    const w = new Weapon(SWORD);
    w.recompute({ ...NEUTRAL, sizeMult: 1.2 });
    expect(w.range).toBeCloseTo(110 * 1.2);
    expect(w.arc).toBeCloseTo((120 * Math.PI) / 180);
  });
});

describe('Épée — mutations', () => {
  function mutated(index: 0 | 1, mods: WeaponModifiers = NEUTRAL) {
    const w = new Weapon(SWORD);
    w.level = weaponMaxLevel(SWORD) + 1;
    w.mutation = SWORD.mutations[index];
    w.recompute(mods);
    return w;
  }

  it('Tourbillon : tout autour (360°), dégâts ×0,75', () => {
    const w = mutated(0);
    expect(WHIRL.name).toBe('Tourbillon');
    expect(w.damage).toBeCloseTo(28 * 0.75);
    const { run, hits } = setup(
      [
        [80, 0],
        [-80, 0],
        [0, 80],
      ],
      w,
    );
    run(DT);
    expect(hits).toHaveLength(3);
  });

  it('Tourbillon + Duplicateur : toujours un seul tour (nerf)', () => {
    const w = mutated(0, { ...NEUTRAL, extraCount: 1 });
    const { run, hits } = setup([[-80, 0]], w);
    run(0.3);
    expect(hits).toHaveLength(1);
  });

  it('Estoc : portée ×2, 30°, dégâts ×2, recul ×1,5', () => {
    const base = new Weapon(SWORD);
    base.level = weaponMaxLevel(SWORD);
    base.recompute(NEUTRAL);
    const w = mutated(1);
    expect(THRUST.name).toBe('Estoc');
    expect(w.range).toBeCloseTo(base.range * 2);
    expect(w.arc).toBeCloseTo((30 * Math.PI) / 180);
    expect(w.damage).toBeCloseTo(base.damage * 2);
    expect(w.knockback).toBeCloseTo(base.knockback * 1.5);
  });

  it('Estoc : transperce toute la ligne, de près comme de loin, mais pas sur les côtés', () => {
    const w = mutated(1);
    const { run, hits, list } = setup(
      [
        [40, 20], // proche et un peu décalé : il chevauche la lame (raté par un simple test d'angle)
        [150, 0], // sur la ligne
        [260, 30], // loin, dans le cône élargi
        [60, 120], // sur le côté
        [-60, 0], // derrière
      ],
      w,
    );
    run(DT);
    expect(hits).toHaveLength(3);
    for (const e of list.slice(0, 3)) expect(hits).toContain(e);
  });
});

describe('Lame-mage', () => {
  it('perso de l’Épée, débloqué à 3 000 kills cumulés avec elle', () => {
    const mage = CHARACTERS.find((c) => c.id === 'bladeMage');
    expect(mage?.weapon).toBe(SWORD);
    expect(mage?.challenge).toEqual({ kind: 'weaponKills', weaponId: 'sword', count: 3000 });
  });
});
