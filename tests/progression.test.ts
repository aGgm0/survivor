import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Pool } from '../src/core/Pool';
import { ENEMY_TYPES } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { EARLY_PASSIVES, MAX_PASSIVES, MAX_WEAPONS, xpToNext } from '../src/data/progression';
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
  choiceKey,
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
  it('suit la formule : 5 + niveau × 7 jusqu’au niveau 10 (début de partie inchangé)', () => {
    expect(xpToNext(1)).toBe(12);
    expect(xpToNext(2)).toBe(19);
    expect(xpToNext(10)).toBe(75);
    expect(new XpSystem().xpForNext).toBe(12);
  });

  it('se durcit après le niveau 10 : + 0,75 × (niveau − 10)²', () => {
    expect(xpToNext(11)).toBe(83); // 82 + 0,75 arrondi
    expect(xpToNext(20)).toBe(220);
    expect(xpToNext(30)).toBe(515);
  });

  it('monte de niveau et garde le surplus', () => {
    const xp = new XpSystem();
    expect(xp.addXp(10)).toBe(0);
    expect(xp.addXp(5)).toBe(1); // 15 ≥ 12
    expect(xp.level).toBe(2);
    expect(xp.xpIntoLevel).toBe(3);
    expect(xp.progress).toBeCloseTo(3 / 19);
  });

  it('xpMult multiplie l’XP requise (×4 quand tout est au max)', () => {
    const xp = new XpSystem();
    xp.xpMult = 4;
    expect(xp.xpForNext).toBe(xpToNext(1) * 4);
  });

  it('peut gagner plusieurs niveaux d’un coup', () => {
    const xp = new XpSystem();
    expect(xp.addXp(12 + 19 + 5)).toBe(2);
    expect(xp.level).toBe(3);
    expect(xp.xpIntoLevel).toBe(5);
    expect(xp.totalXp).toBe(36);
  });
});

describe('upgrades — options et tirage', () => {
  it('au départ : Trait arcanique niv 2, les 3 autres armes et tous les passifs', () => {
    const options = availableUpgrades(makeBuild());
    expect(options).toHaveLength(1 + 3 + PASSIVES.length);
    expect(options.filter((o) => o.kind === 'newWeapon').map((o) => o.title)).toEqual([
      WEAPONS.burningAura.name,
      WEAPONS.runicOrbs.name,
      WEAPONS.sword.name,
    ]);
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

  it('relance : les cartes écartées ne reviennent pas s’il y a assez d’autres options', () => {
    const options = availableUpgrades(makeBuild());
    for (let seed = 0; seed < 100; seed++) {
      const first = rollUpgradeChoices(options, new Rng(seed), 3, true);
      const again = rollUpgradeChoices(options, new Rng(seed + 1000), 3, true, first);
      const firstKeys = first.map(choiceKey);
      expect(again).toHaveLength(3);
      for (const c of again) expect(firstKeys).not.toContain(choiceKey(c));
      // La garantie d'arme tient toujours après une relance.
      expect(again.some((c) => c.kind === 'newWeapon')).toBe(true);
    }
  });

  it('relance : pas assez de nouvelles cartes → on complète avec les anciennes', () => {
    const options = availableUpgrades(makeBuild()).slice(0, 4);
    const shown = options.slice(0, 3);
    const again = rollUpgradeChoices(options, new Rng(3), 3, false, shown);
    expect(again).toHaveLength(3);
    expect(again.map(choiceKey)).toContain(choiceKey(options[3]!));
    expect(new Set(again.map(choiceKey)).size).toBe(3);
  });

  it('début de partie : les passifs sortent environ 2 fois moins souvent', () => {
    const options = availableUpgrades(makeBuild());
    const passiveShare = (weight: number) => {
      let passives = 0;
      let total = 0;
      for (let seed = 0; seed < 2000; seed++) {
        for (const c of rollUpgradeChoices(options, new Rng(seed), 3, false, [], weight)) {
          total++;
          if (c.kind === 'passive') passives++;
        }
      }
      return passives / total;
    };
    const normal = passiveShare(1);
    const early = passiveShare(EARLY_PASSIVES.weight);
    expect(early).toBeLessThan(normal * 0.9);
    // Toujours 3 cartes différentes.
    const picks = rollUpgradeChoices(options, new Rng(5), 3, true, [], EARLY_PASSIVES.weight);
    expect(new Set(picks.map((c) => c.title)).size).toBe(3);
    expect(picks.some((c) => c.kind === 'newWeapon')).toBe(true);
  });

  it('n’en propose pas plus qu’il n’en existe', () => {
    const options = availableUpgrades(makeBuild()).slice(0, 2);
    expect(rollUpgradeChoices(options, new Rng(1), 3)).toHaveLength(2);
  });

  it('garantie : une nouvelle arme est toujours proposée tant qu’il en reste', () => {
    const options = availableUpgrades(makeBuild());
    for (let seed = 0; seed < 200; seed++) {
      const choices = rollUpgradeChoices(options, new Rng(seed), 3, true);
      expect(choices).toHaveLength(3);
      expect(choices.some((c) => c.kind === 'newWeapon')).toBe(true);
      expect(new Set(choices.map((c) => c.title)).size).toBe(3); // toujours sans doublon
    }
  });

  it('sans garantie, il arrive qu’aucune nouvelle arme ne sorte', () => {
    const options = availableUpgrades(makeBuild());
    let without = 0;
    for (let seed = 0; seed < 200; seed++) {
      const choices = rollUpgradeChoices(options, new Rng(seed), 3, false);
      if (!choices.some((c) => c.kind === 'newWeapon')) without++;
    }
    expect(without).toBeGreaterThan(0);
  });

  it('une arme déjà possédée n’est plus proposée comme nouvelle', () => {
    const build = makeBuild();
    const aura = availableUpgrades(build).find(
      (o) => o.kind === 'newWeapon' && o.def === WEAPONS.burningAura,
    );
    if (!aura) throw new Error();
    applyUpgrade(aura, build);
    expect(build.weapons.map((w) => w.def.id)).toEqual(['arcaneBolt', 'burningAura']);
    const again = availableUpgrades(build).filter((o) => o.kind === 'newWeapon');
    expect(again.map((o) => o.title)).toEqual([WEAPONS.runicOrbs.name, WEAPONS.sword.name]);
  });

  it('4 passifs possédés : plus de nouveau passif, mais les possédés montent encore', () => {
    const build = makeBuild();
    const owned = PASSIVES.slice(0, MAX_PASSIVES);
    for (const p of owned) build.passiveLevels.set(p.id, 1);
    const passives = availableUpgrades(build).filter((o) => o.kind === 'passive');
    expect(passives.map((o) => o.title)).toEqual(owned.map((p) => p.name));
  });

  it('4 armes possédées : plus de nouvelle arme proposée', () => {
    const build = makeBuild();
    while (build.weapons.length < MAX_WEAPONS) build.weapons.push(new Weapon(BOLT));
    expect(availableUpgrades(build).some((o) => o.kind === 'newWeapon')).toBe(false);
  });

  it('exclut ce qui est au maximum, et propose le soin quand tout est au max', () => {
    const build = makeBuild();
    build.weapons.push(
      new Weapon(WEAPONS.burningAura),
      new Weapon(WEAPONS.runicOrbs),
      new Weapon(WEAPONS.sword),
    );
    for (const w of build.weapons) w.level = weaponMaxLevel(w.def);
    for (const p of PASSIVES) build.passiveLevels.set(p.id, p.maxLevel);
    // Armes au niveau 5 : il reste leurs mutations (le niveau 6), 2 par arme.
    expect(availableUpgrades(build).every((o) => o.kind === 'mutation')).toBe(true);
    expect(availableUpgrades(build)).toHaveLength(8);
    for (const w of build.weapons) {
      w.mutation = w.def.mutations?.[0] ?? null;
      w.level++;
    }
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

  it('Vitalité : +15 PV max, soigne 15 et +0,3 PV/s de régénération', () => {
    const build = makeBuild();
    build.player.hp = 50;
    pick(build, 'vitality');
    expect(build.player.maxHp).toBe(PLAYER_BASE.maxHp + 15);
    expect(build.player.hp).toBe(65);
    expect(build.player.regen).toBeCloseTo(PLAYER_BASE.regen + 0.3);
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
    const mods = { damageMult: 1, cooldownMult: 1, knockbackMult: 1 };
    w.recompute(mods);
    expect([w.damage, w.count, w.cooldown]).toEqual([BOLT.damage, 1, 1]);

    w.level = 5; // +5 dégâts, +2 projectiles, cooldown -20 %
    w.recompute(mods);
    expect(w.damage).toBe(BOLT.damage + 5);
    expect(w.count).toBe(3);
    expect(w.cooldown).toBeCloseTo(0.8);

    w.recompute({ damageMult: 1.5, cooldownMult: 0.5, knockbackMult: 1 });
    expect(w.damage).toBeCloseTo((BOLT.damage + 5) * 1.5);
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
    weapon.recompute({ damageMult: 1, cooldownMult: 1, knockbackMult: 1 });

    new WeaponSystem(10, collisions, projectiles, { onHit: () => {}, onKill: () => {} }).update(
      1 / 60,
      [weapon],
      0,
      0,
      0,
    );
    const shots = projectiles.items.filter((p) => p.active);
    expect(shots).toHaveLength(2);
    // Symétriques de part et d'autre de l'axe vers la cible (axe x)
    const angles = shots.map((p) => (Math.atan2(p.vy, p.vx) * 180) / Math.PI).sort((a, b) => a - b);
    expect(angles[0]).toBeCloseTo(-BOLT.spreadDeg / 2);
    expect(angles[1]).toBeCloseTo(BOLT.spreadDeg / 2);
    expect(shots[0]?.damage).toBe(weapon.damage);
  });
});
