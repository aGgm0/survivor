import { describe, expect, it } from 'vitest';
import { PLAYER_BASE } from '../src/data/player';
import { WEAPONS, weaponMaxLevel } from '../src/data/weapons';
import { Player } from '../src/entities/Player';
import { Weapon } from '../src/entities/Weapon';
import {
  buildDevView,
  devSetMutation,
  devSetPassive,
  devSetWeaponLevel,
  devToggleWeapon,
} from '../src/scenes/game/devActions';

describe('menu de test : armes', () => {
  it('ajoute une arme absente, retire une arme présente, ignore un id inconnu', () => {
    const weapons: Weapon[] = [];
    expect(devToggleWeapon(weapons, 'sword')).toBe(true);
    expect(weapons.map((w) => w.def.id)).toEqual(['sword']);
    expect(devToggleWeapon(weapons, 'sword')).toBe(true);
    expect(weapons).toHaveLength(0);
    expect(devToggleWeapon(weapons, 'inconnue')).toBe(false);
  });

  it('niveau borné entre 1 et le max normal, et retire la mutation', () => {
    const w = new Weapon(WEAPONS.runicOrbs);
    const weapons = [w];
    devSetWeaponLevel(weapons, 'runicOrbs', 99);
    expect(w.level).toBe(weaponMaxLevel(w.def));
    devSetMutation(weapons, 'runicOrbs', 0);
    devSetWeaponLevel(weapons, 'runicOrbs', -99);
    expect(w.level).toBe(1);
    expect(w.mutation).toBeNull();
    expect(devSetWeaponLevel(weapons, 'sword', 1)).toBe(false); // arme absente
  });

  it('mutation = niveau 6 ; -1 la retire et remet le niveau max normal', () => {
    const w = new Weapon(WEAPONS.arcaneBolt);
    devSetMutation([w], 'arcaneBolt', 1);
    expect(w.mutation).toBe(WEAPONS.arcaneBolt.mutations?.[1]);
    expect(w.level).toBe(weaponMaxLevel(w.def) + 1);
    devSetMutation([w], 'arcaneBolt', -1);
    expect(w.mutation).toBeNull();
    expect(w.level).toBe(weaponMaxLevel(w.def));
  });
});

describe('menu de test : passifs', () => {
  it('monte, redescend à 0 (passif retiré), et garde les bonus de boutique', () => {
    const player = new Player();
    const levels = new Map<string, number>();
    const shop = { startVitality: 1 };
    devSetPassive(player, levels, shop, 'vitality', 2);
    expect(levels.get('vitality')).toBe(2);
    const withPassive = player.maxHp;
    devSetPassive(player, levels, shop, 'vitality', -5);
    expect(levels.has('vitality')).toBe(false);
    expect(player.maxHp).toBeLessThan(withPassive);
    expect(player.maxHp).toBe(PLAYER_BASE.maxHp + 5); // +5 PV : Vitalité de départ rang 1
    expect(devSetPassive(player, levels, shop, 'inconnu', 1)).toBe(false);
  });
});

describe('menu de test : vue du panneau', () => {
  it('liste toutes les armes et tous les passifs, avec niveau et mutation', () => {
    const w = new Weapon(WEAPONS.burningAura);
    devSetMutation([w], 'burningAura', 1);
    const view = buildDevView([w], new Map([['haste', 3]]), true);
    expect(view.god).toBe(true);
    expect(view.weapons.find((x) => x.id === 'burningAura')).toEqual({
      id: 'burningAura',
      owned: true,
      level: weaponMaxLevel(w.def) + 1,
      mutation: 1,
    });
    expect(view.weapons.find((x) => x.id === 'sword')?.owned).toBe(false);
    expect(view.passives.find((p) => p.id === 'haste')?.level).toBe(3);
  });
});
