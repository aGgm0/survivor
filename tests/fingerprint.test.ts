import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { WEAPONS } from '../src/data/weapons';
import { runSim, type ForcedWeapon } from '../sim/runSim';

// Empreinte de quelques parties du bot : elle doit rester identique tant qu'un changement ne
// touche pas au gameplay (refactor). Le moindre écart (un tir, un recul, un tirage) déplace les
// ennemis et le joueur, donc les chiffres. Si un changement de gameplay est voulu, mettre à jour
// l'instantané : `npx vitest run tests/fingerprint.test.ts -u`.

/** Arrondi pour l'instantané : assez fin pour voir le moindre écart, sans bruit de virgule. */
const r = (n: number) => Math.round(n * 1000) / 1000;

function fingerprint(seed: number, limit: number, characterId?: string, forced?: ForcedWeapon) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  const { scene, level, time } = runSim(seed, character, limit, forced);
  // Les 5 premiers ennemis actifs du pool : leur position dépend de toute la partie.
  const enemies = scene.enemies.items
    .filter((e) => e.active)
    .slice(0, 5)
    .map((e) => [e.type.id, r(e.x), r(e.y), r(e.hp)]);
  return {
    time: r(time),
    level,
    hp: r(scene.player.hp),
    player: [r(scene.player.x), r(scene.player.y)],
    gold: scene.gold,
    activeEnemies: scene.enemies.activeCount,
    enemies,
    weapons: scene.weapons.map((w) => [
      w.mutation?.id ?? w.def.id,
      w.level,
      r(w.totalDamage),
      w.kills,
    ]),
  };
}

describe('empreinte des parties (refactors sans changement de gameplay)', () => {
  for (const c of CHARACTERS) {
    it(`perso ${c.id}, 3 min`, () => {
      expect(fingerprint(7, 180, c.id)).toMatchSnapshot();
    });
  }
  // Chaque arme au niveau max, sans mutation puis avec chacune : tous les comportements passent.
  for (const def of Object.values(WEAPONS)) {
    for (const mutation of [-1, 0, 1]) {
      it(`${def.id} imposée, mutation ${mutation}, 1 min`, () => {
        expect(fingerprint(11, 60, undefined, { weaponId: def.id, mutation })).toMatchSnapshot();
      });
    }
  }
});
