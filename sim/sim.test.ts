// `npm run sim` : le bot joue N parties (seeds 1 à N) et affiche le bilan.
// Réglages par variables d'environnement :
//   SIM_SEEDS=50 npm run sim            (nombre de parties, 20 par défaut)
//   SIM_PERSO=pyromancer npm run sim    (perso de départ : arcanist, pyromancer, runist, bladeMage)
//   SIM_FORCE=burningAura:1 npm run sim (arme imposée au niveau max, mutation n° 0 ou 1, -1 : sans)

import { expect, it } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { runSim, type ForcedWeapon, type SimResult } from './runSim';
import { formatRuns, formatSummary } from './summary';

const SEEDS = Number(process.env.SIM_SEEDS ?? 20);
const PERSO = process.env.SIM_PERSO;
const FORCE = process.env.SIM_FORCE;

function parseForce(text: string | undefined): ForcedWeapon | undefined {
  if (!text) return undefined;
  const [weaponId = '', mutation = '-1'] = text.split(':');
  return { weaponId, mutation: Number(mutation) };
}

it(`le bot joue ${SEEDS} parties`, () => {
  const character = PERSO ? CHARACTERS.find((c) => c.id === PERSO) : undefined;
  if (PERSO && !character) {
    throw new Error(`Perso inconnu : ${PERSO} (${CHARACTERS.map((c) => c.id).join(', ')})`);
  }
  const forced = parseForce(FORCE);
  const results: SimResult[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    results.push(runSim(seed, character, undefined, forced));
  }
  const title =
    `=== Bot : ${SEEDS} parties, perso ${character?.name ?? 'Arcaniste'}` +
    `${forced ? `, arme imposée ${FORCE}` : ''} ===`;
  process.stdout.write(`\n${title}\n\n${formatRuns(results)}\n\n${formatSummary(results)}\n\n`);
  expect(results).toHaveLength(SEEDS);
}, 3_600_000);
