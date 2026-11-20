// `npm run sim` : le bot joue N parties (seeds 1 à N) et affiche le bilan.
// Réglages par variables d'environnement :
//   SIM_SEEDS=50 npm run sim            (nombre de parties, 20 par défaut)
//   SIM_PERSO=pyromancer npm run sim    (perso de départ : arcanist, pyromancer, runist, bladeMage)

import { expect, it } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { runSim, type SimResult } from './runSim';
import { formatRuns, formatSummary } from './summary';

const SEEDS = Number(process.env.SIM_SEEDS ?? 20);
const PERSO = process.env.SIM_PERSO;

it(`le bot joue ${SEEDS} parties`, () => {
  const character = PERSO ? CHARACTERS.find((c) => c.id === PERSO) : undefined;
  if (PERSO && !character) {
    throw new Error(`Perso inconnu : ${PERSO} (${CHARACTERS.map((c) => c.id).join(', ')})`);
  }
  const results: SimResult[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) results.push(runSim(seed, character));
  const title = `=== Bot : ${SEEDS} parties, perso ${character?.name ?? 'Arcaniste'} ===`;
  process.stdout.write(`\n${title}\n\n${formatRuns(results)}\n\n${formatSummary(results)}\n\n`);
  expect(results).toHaveLength(SEEDS);
}, 3_600_000);
