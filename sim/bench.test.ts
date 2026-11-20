// `npm run bench` : temps d'une update avec 600 ennemis (objectif du projet : 500+ ennemis à
// 60 FPS, soit bien moins de 16,7 ms par frame, rendu compris). À relancer après un changement
// qui touche aux collisions, aux armes ou à la horde, et à comparer avec la valeur d'avant.

import { expect, it } from 'vitest';
import { GameScene } from '../src/scenes/GameScene';
import { makeHeadlessDeps } from './headlessDeps';

const DT = 1 / 60;
const ENEMIES = 600;
/** s mesurées (après 1 s pour laisser la horde se tasser autour du joueur) */
const MEASURE = 10;

it(`bench : ${ENEMIES} ennemis`, () => {
  const { deps } = makeHeadlessDeps();
  const scene = new GameScene(deps, 7);
  scene.enter();
  scene.applyDevAction({ kind: 'god' });
  for (const id of ['burningAura', 'runicOrbs', 'sword']) {
    scene.applyDevAction({ kind: 'weaponToggle', id });
  }
  scene.applyDevAction({ kind: 'close' });
  const steps = MEASURE * 60;
  const times: number[] = [];
  for (let i = 0; i < 60 + steps; i++) {
    // Garde la horde à 600 : les armes en tuent, on en remet.
    const missing = ENEMIES - scene.enemies.activeCount;
    if (missing > 0) scene.applyDevAction({ kind: 'spawn', count: missing });
    if (scene.isChoosingUpgrade) scene.chooseUpgrade(0);
    const t0 = performance.now();
    scene.update(DT);
    if (i >= 60) times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  process.stdout.write(
    `\n=== Bench : ${ENEMIES} ennemis, 4 armes, ${MEASURE} s ===\n` +
      `Moyenne ${mean.toFixed(3)} ms / update, 95 % sous ${p95.toFixed(3)} ms\n` +
      `(budget d'une frame à 60 FPS : 16,7 ms, logique + rendu)\n\n`,
  );
  expect(mean).toBeGreaterThan(0);
}, 600_000);
