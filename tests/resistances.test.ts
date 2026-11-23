import { describe, expect, it } from 'vitest';
import { MIN_DAMAGE, resistReduction } from '../src/data/combat';
import { ENEMY_TYPES, type EnemyType } from '../src/data/enemies';
import { WEAPON_LIST, WEAPONS, type MutationDef } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Player } from '../src/entities/Player';
import { Weapon } from '../src/entities/Weapon';
import { rebuildPassiveStats } from '../src/systems/upgrades';
import { damageEnemy, type HitEvents } from '../src/systems/damage';

const events: HitEvents = { onHit: () => {}, onKill: () => {} };

/** PV perdus par un ennemi de type `type` touché une fois pour `amount` par `weapon`. */
function hit(type: EnemyType, weapon: Weapon, amount: number): number {
  const e = new Enemy();
  e.type = type;
  e.hp = 10_000;
  damageEnemy(weapon, e, amount, events, 1, 0);
  return 10_000 - e.hp;
}

describe('résistances et pénétration', () => {
  it('réduction = A / (A + 100), jamais 100 %', () => {
    expect(resistReduction(0, 0)).toBe(0);
    expect(resistReduction(25, 0)).toBeCloseTo(0.2);
    expect(resistReduction(100, 0)).toBe(0.5);
    expect(resistReduction(1e9, 0)).toBeLessThan(1);
  });

  it('la pénétration retire de la résistance, sans jamais la rendre négative', () => {
    expect(resistReduction(50, 30)).toBeCloseTo(20 / 120);
    expect(resistReduction(50, 50)).toBe(0);
    expect(resistReduction(50, 80)).toBe(0);
  });

  it('le tank résiste à la magie, pas au physique', () => {
    const bolt = new Weapon(WEAPONS.arcaneBolt); // magique
    const sword = new Weapon(WEAPONS.sword); // physique
    expect(hit(ENEMY_TYPES.tank, bolt, 30)).toBe(20); // 30 × (1 − 50/150)
    expect(hit(ENEMY_TYPES.tank, sword, 30)).toBe(30);
    expect(hit(ENEMY_TYPES.fast, bolt, 30)).toBe(30); // le rapide ne résiste à rien
  });

  it('la pénétration de l’arme compte, et le damage meter compte les dégâts réduits', () => {
    const bolt = new Weapon(WEAPONS.arcaneBolt);
    bolt.penetration = 50;
    expect(hit(ENEMY_TYPES.tank, bolt, 30)).toBe(30);
    const plain = new Weapon(WEAPONS.arcaneBolt);
    hit(ENEMY_TYPES.tank, plain, 30);
    expect(plain.totalDamage).toBe(20);
  });

  it('un coup réduit fait toujours au moins MIN_DAMAGE', () => {
    const bolt = new Weapon(WEAPONS.arcaneBolt);
    const wall: EnemyType = { ...ENEMY_TYPES.tank, resistances: { magical: 1e6 } };
    expect(hit(wall, bolt, 5)).toBe(MIN_DAMAGE);
  });

  it('une mutation peut ajouter de la pénétration', () => {
    const sword = new Weapon(WEAPONS.sword);
    const base = WEAPONS.sword.mutations?.[1];
    if (!base) throw new Error('pas de mutation');
    sword.mutation = { ...base, penetration: 25 };
    sword.recompute({ damageMult: 1, cooldownMult: 1, knockbackMult: 1 });
    expect(sword.penetration).toBe(25);
  });
});

describe('passif Pénétration', () => {
  it('+10 par niveau, ajoutée à la pénétration de chaque arme ; le recalcul la remet à zéro', () => {
    const player = new Player();
    const levels = new Map([['penetration', 3]]);
    rebuildPassiveStats(player, levels);
    expect(player.penetration).toBe(30);
    const bolt = new Weapon(WEAPONS.arcaneBolt);
    bolt.recompute(player);
    expect(bolt.penetration).toBe(30);
    expect(hit(ENEMY_TYPES.tank, bolt, 30)).toBe(25); // 30 × (1 − 20/120)
    rebuildPassiveStats(player, new Map());
    expect(player.penetration).toBe(0);
  });
});

describe('valeurs de la 0.3', () => {
  it('le basique résiste un peu à tout mais meurt toujours en 2 coups de Trait', () => {
    const bolt = new Weapon(WEAPONS.arcaneBolt);
    bolt.recompute(new Player());
    expect(2 * hit(ENEMY_TYPES.basic, bolt, bolt.damage)).toBeGreaterThanOrEqual(
      ENEMY_TYPES.basic.hp,
    );
    expect(hit(ENEMY_TYPES.basic, bolt, 30)).toBeLessThan(30);
  });

  it('Estoc, Trait perçant et Fournaise ont de la pénétration ; les armes de base non', () => {
    const pen = (id: string) =>
      WEAPON_LIST.flatMap((w): readonly MutationDef[] => w.mutations ?? []).find((m) => m.id === id)
        ?.penetration;
    expect([pen('thrust'), pen('piercingBolt'), pen('furnace')]).toEqual([30, 20, 30]);
    expect(WEAPON_LIST.every((w) => !w.penetration)).toBe(true);
  });
});
