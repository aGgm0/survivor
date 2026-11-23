// Types d'ennemis sans résistances, pour les tests qui prennent un tank ou un boss comme
// cible solide et vérifient autre chose (ticks d'aura, arrondi, poison...) : ils ne doivent
// pas dépendre des résistances (testées à part, tests/resistances.test.ts).

import { ENEMY_TYPES, type EnemyType } from '../src/data/enemies';

type EnemyTypes = typeof ENEMY_TYPES;

function plain<T extends EnemyType>(type: T): T {
  return { ...type, resistances: undefined };
}

export const PLAIN_ENEMY_TYPES = Object.fromEntries(
  Object.entries(ENEMY_TYPES).map(([id, type]) => [id, plain(type)]),
) as unknown as EnemyTypes;
