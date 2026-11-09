import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { xpToNext } from '../src/data/progression';
import { HEAL_UPGRADE, PASSIVES } from '../src/data/upgrades';
import { WEAPONS, weaponMaxLevel } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Player } from '../src/entities/Player';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import {
  applyUpgrade,
  availableUpgrades,
  rollUpgradeChoices,
  type Build,
} from '../src/systems/upgrades';
import { WeaponSystem } from '../src/systems/WeaponSystem';
import { XpSystem } from '../src/systems/XpSystem';

const BOLT = WEAPONS.arcaneBolt;

function makeBuild(): Build {
  return {
    player: new Player(),
    weapons: [new Weapon(BOLT)],
    passiveLevels: new Map(),
  };
}

describe('XpSystem', () => {
  it('suit la formule du brief : 5 + niveau × 10', () => {
    expect(xpToNext(1)).toBe(15);
    expect(xpToNext(2)).toBe(25);
    expect(new XpSystem().xpForNext).toBe(15);
  });

  it('monte de niveau et garde le surplus', () => {
    const xp = new XpSystem();
    expect(xp.addXp(10)).toBe(0);
    expect(xp.addXp(8)).toBe(1); // 18 ≥ 15
    expect(xp.level).toBe(2);
    expect(xp.xpIntoLevel).toBe(3);
    expect(xp.progress).toBeCloseTo(3 / 25);
  });

  it('peut gagner plusieurs niveaux d’un coup', () => {
    const xp = new XpSystem();
    expect(xp.addXp(15 + 25 + 5)).toBe(2);
    expect(xp.level).toBe(3);
    expect(xp.xpIntoLevel).toBe(5);
    expect(xp.totalXp).toBe(45);
  });
});

describe('upgrades — options et tirage', () => {
  it('au départ : le Trait arcanique niveau 2 et tous les passifs', () => {
    const options = availableUpgrades(makeBuild());
    expect(options).toHaveLength(1 + PASSIVES.length);
    const bolt = options.find((o) => o.kind === 'weaponLevel');
    expect(bolt?.levelText).toBe('Niv 2');
    expect(bolt?.description).toBe(BOLT.levels[0]?.description);
  });

  it('tire 3 choix différents, de façon reproductible', () => {
    const options = availableUpgrades(makeBuild());
    const a = rollUpgradeChoices(options, new Rng(7), 3);
    const b = rollUpgradeChoices(options, new Rng(7), 3);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((c) => c.title)).size).toBe(3);
    expect(a.map((c) => c.title)).toEqual(b.map((c) => c.title));
  });

  it('n’en propose pas plus qu’il n’en existe', () => {
    const options = availableUpgrades(makeBuild()).slice(0, 2);
    expect(rollUpgradeChoices(options, new Rng(1), 3)).toHaveLength(2);
  });

  it('exclut ce qui est au maximum, et propose le soin quand tout est au max', () => {
    const build = makeBuild();
    const bolt = build.weapons[0] as Weapon;
    bolt.level = weaponMaxLevel(BOLT);
    for (const p of PASSIVES) build.passiveLevels.set(p.id, p.maxLevel);
    expect(availableUpgrades(build)).toHaveLength(0);
    const choices = rollUpgradeChoices([], new Rng(1), 3);
    expect(choices).toHaveLength(1);
    expect(choices[0]?.kind).toBe('heal');
  });
});

describe('upgrades — effets', () => {
  const pick = (build: Build, id: string) => {
    const choice = availableUpgrades(build).find(
      (o) => o.kind === 'passive' && o.passive.id === id,
    );
    if (!choice) throw new Error(id);
    applyUpgrade(choice, build);
  };

  it('Vitalité : +20 PV max et soigne 20', () => {
    const build = makeBuild();
    build.player.hp = 50;
    pick(build, 'vitality');
    expect(build.player.maxHp).toBe(PLAYER_BASE.maxHp + 20);
    expect(build.player.hp).toBe(70);
    expect(build.passiveLevels.get('vitality')).toBe(1);
  });

  it('Célérité, Attraction, Puissance, Hâte modifient les bonnes stats', () => {
    const build = makeBuild();
    pick(build, 'swiftness');
    pick(build, 'attraction');
    pick(build, 'power');
    pick(build, 'haste');
    expect(build.player.speed).toBeCloseTo(PLAYER_BASE.speed * 1.08);
    expect(build.player.pickupRadius).toBeCloseTo(PLAYER_BASE.pickupRadius * 1.3);
    expect(build.player.damageMult).toBeCloseTo(1.1);
    expect(build.player.cooldownMult).toBeCloseTo(0.92);
  });

  it('le soin ne dépasse pas les PV max', () => {
    const build = makeBuild();
    build.player.hp = PLAYER_BASE.maxHp - 10;
    applyUpgrade({ kind: 'heal', title: '', description: '', levelText: '' }, build);
    expect(build.player.hp).toBe(PLAYER_BASE.maxHp);
    build.player.hp = 1;
    applyUpgrade({ kind: 'heal', title: '', description: '', levelText: '' }, build);
    expect(build.player.hp).toBe(1 + HEAL_UPGRADE.amount);
  });
});

describe('Weapon — stats par niveau', () => {
  it('cumule les bonus des niveaux et les passifs', () => {
    const w = new Weapon(BOLT);
    const mods = { damageMult: 1, cooldownMult: 1 };
    w.recompute(mods);
    expect([w.damage, w.projectileCount, w.cooldown]).toEqual([10, 1, 1]);

    w.level = 5; // +5 dégâts, +2 projectiles, cooldown -20 %
    w.recompute(mods);
    expect(w.damage).toBe(15);
    expect(w.projectileCount).toBe(3);
    expect(w.cooldown).toBeCloseTo(0.8);

    w.recompute({ damageMult: 1.5, cooldownMult: 0.5 });
    expect(w.damage).toBeCloseTo(22.5);
    expect(w.cooldown).toBeCloseTo(0.4);
  });
});

describe('WeaponSystem — plusieurs projectiles', () => {
  it('tire en éventail centré sur la cible', () => {
    const enemies = new Pool(10, (i) => new Enemy(i));
    enemies.acquire()?.spawn(ENEMY_TYPES.tank, 300, 0);
    const projectiles = new Pool(10, () => new Projectile());
    const collisions = new CollisionSystem(10);
    collisions.rebuild(enemies);
    const weapon = new Weapon(BOLT);
    weapon.level = 3; // 2 projectiles
    weapon.recompute({ damageMult: 1, cooldownMult: 1 });

    new WeaponSystem(10, collisions, projectiles).update(1 / 60, [weapon], 0, 0);
    const shots = projectiles.items.filter((p) => p.active);
    expect(shots).toHaveLength(2);
    // Symétriques de part et d'autre de l'axe vers la cible (axe x)
    const angles = shots.map((p) => (Math.atan2(p.vy, p.vx) * 180) / Math.PI).sort((a, b) => a - b);
    expect(angles[0]).toBeCloseTo(-BOLT.spreadDeg / 2);
    expect(angles[1]).toBeCloseTo(BOLT.spreadDeg / 2);
    expect(shots[0]?.damage).toBe(weapon.damage);
  });
});
