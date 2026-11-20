// Une partie jouée par le bot, du début à la mort ou à la victoire, sans navigateur.

import { Rng } from '../src/core/math';
import type { CharacterDef } from '../src/data/characters';
import { GameScene } from '../src/scenes/GameScene';
import type { RunReport } from '../src/types/RunReport';
import { BotInput } from './BotInput';
import { BOT, decideMove, pickUpgrade } from './botBrain';
import { makeHeadlessDeps } from './headlessDeps';

const DT = 1 / 60;
/** s : on arrête une partie qui traîne (boss jamais tué en prolongations) */
const MAX_RUN_TIME = 15 * 60;
/** Pour dériver la seed du bot (ses choix de cartes) de celle de la partie */
const BOT_SEED_SALT = 0x5bd1e995;

export interface SimResult {
  readonly seed: number;
  /** null si la partie a été arrêtée par MAX_RUN_TIME (prolongations sans fin) */
  readonly report: RunReport | null;
  /** Vrai si le joueur est encore en vie à l'arrêt (limite atteinte, ou victoire) */
  readonly alive: boolean;
  readonly level: number;
  /** s de jeu au moment de l'arrêt */
  readonly time: number;
  /** PV les plus bas de la partie, en part des PV max (0 à 1) */
  readonly minHpShare: number;
  /** s réelles pour simuler la partie */
  readonly wallSeconds: number;
}

/** `limit` : s de jeu après lesquelles on arrête (test rapide) ; par défaut toute la partie. */
export function runSim(
  seed: number,
  character?: CharacterDef,
  limit: number = MAX_RUN_TIME,
): SimResult {
  const input = new BotInput();
  const { deps, ui } = makeHeadlessDeps(input.isDown);
  const scene = new GameScene(deps, seed, character ? { startWeapon: character.weapon } : {});
  scene.enter();
  const rng = new Rng(seed ^ BOT_SEED_SALT);
  const thinkSteps = Math.round(BOT.thinkEvery / DT);
  let minHpShare = 1;
  const t0 = performance.now();

  for (let step = 0; !scene.isOver && scene.runTime < limit; step++) {
    if (scene.isChoosingUpgrade) scene.chooseUpgrade(pickUpgrade(scene, rng));
    if (step % thinkSteps === 0) {
      const dir = decideMove(scene);
      input.setDirection(dir.x, dir.y);
    }
    scene.update(DT);
    minHpShare = Math.min(minHpShare, scene.player.hp / scene.player.maxHp);
  }

  return {
    seed,
    alive: !scene.isOver || (scene.result?.victory ?? false),
    level: scene.progression.level,
    report: ui.end ?? scene.result,
    time: scene.runTime,
    minHpShare,
    wallSeconds: (performance.now() - t0) / 1000,
  };
}
