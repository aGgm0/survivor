import { describe, expect, it } from 'vitest';
import { fakeCanvasContext } from '../sim/fakeCanvas';
import { runSim } from '../sim/runSim';
import { CHARACTERS } from '../src/data/characters';
import { WEAPONS, type WeaponDef } from '../src/data/weapons';
import { describeChoice } from '../src/systems/choiceDetails';
import { buildDamageReport } from '../src/systems/runReport';

// Critère du bloc A de la 0.3 : une nouvelle arme d'un type existant s'ajoute en ne touchant que
// des données. Ici, une arme par type, construite à partir de rien d'autre qu'une définition
// (inconnue du jeu : ni dans WEAPONS, ni dans les icônes, ni dans AURA_LOOKS).

/** Une arme neuve : nouvel id et nouveau nom, mêmes réglages de type que `base`, plus forte. */
function fakeWeapon(base: WeaponDef): WeaponDef {
  return {
    ...base,
    id: `fake-${base.kind}`,
    name: `Fausse arme (${base.kind})`,
    short: 'FX',
    color: '#ff00ff',
    damage: base.damage * 2,
    mutations: undefined,
  };
}

const FAKES = [
  WEAPONS.arcaneBolt,
  WEAPONS.burningAura,
  WEAPONS.runicOrbs,
  WEAPONS.sword,
  WEAPONS.chainLightning,
  WEAPONS.throwingAxe,
].map(fakeWeapon);

describe('nouvelle arme faite seulement de données', () => {
  const base = CHARACTERS[0];
  if (!base) throw new Error('aucun perso');
  for (const def of FAKES) {
    it(`${def.kind} : tire, tue, compte dans le damage meter, se dessine et a sa carte`, () => {
      const { scene } = runSim(5, { ...base, weapon: def }, 40);
      const weapon = scene.weapons.find((w) => w.def.id === def.id);
      expect(weapon).toBeDefined();
      if (!weapon) return;
      expect(weapon.totalDamage).toBeGreaterThan(0);
      expect(weapon.kills).toBeGreaterThan(0);
      const report = buildDamageReport(scene.weapons).find((r) => r.id === def.id);
      expect(report?.name).toBe(def.name);
      // Rendu de la partie (sol, armes...) sans erreur, avec l'arme inconnue.
      expect(() => scene.render(fakeCanvasContext(), 0.5)).not.toThrow();
      // Carte de niveau : les stats qui changent au niveau suivant (dégâts au moins à un niveau).
      const changes = [1, 2, 3, 4].flatMap((level) => {
        weapon.level = level;
        weapon.recompute(scene.player);
        return describeChoice(
          { kind: 'weaponLevel', weapon, title: '', description: '', levelText: '' },
          scene,
        ).changes;
      });
      expect(changes.length).toBeGreaterThan(0);
    });
  }
});
