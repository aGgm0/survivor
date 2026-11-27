import { describe, expect, it } from 'vitest';
import { PLAYER_DEATH } from '../src/data/feel';
import { RunFlow, type RunFlowDeps, type RunStats } from '../src/scenes/game/RunFlow';
import type { RunReport } from '../src/types/RunReport';

const STATS: RunStats = {
  character: '',
  time: 600,
  kills: 0,
  gold: 0,
  level: 1,
  challenges: [],
  maxedAt: null,
  weapons: [],
  passives: [],
};

/** Faux écran de fin et faux profil : on note ce que le déroulement leur demande. */
function setup() {
  const recorded: RunReport[] = [];
  let endless = 0;
  let shown: { report: RunReport; canContinue: boolean } | null = null;
  const deps: RunFlowDeps = {
    input: { isDown: () => false, wasPressed: () => false },
    endOverlay: {
      show: (report, canContinue = false) => (shown = { report, canContinue }),
      hide: () => (shown = null),
      takeAction: () => null,
    },
    hud: { setEndless: () => {} },
    onRestart: () => {},
    onMenu: () => {},
    onRunEnd: (report) => recorded.push(report),
    unlocksFor: () => [],
  };
  const flow = new RunFlow(deps, { stats: () => STATS, startEndless: () => endless++ }, 600);
  return { flow, recorded, shown: () => shown, endlessStarts: () => endless };
}

describe('RunFlow', () => {
  it('victoire seulement au timer et sans boss en vie (sinon prolongations)', () => {
    const { flow } = setup();
    expect(flow.reachedVictory(599, false)).toBe(false);
    expect(flow.reachedVictory(600, true)).toBe(false);
    expect(flow.isOvertime(600)).toBe(true);
    expect(flow.reachedVictory(600, false)).toBe(true);
  });

  it('victoire : pas enregistrée tant que le sans fin reste possible, puis une seule fois', () => {
    const { flow, recorded, shown } = setup();
    flow.end(true);
    expect(shown()?.canContinue).toBe(true);
    expect(recorded).toHaveLength(0);
    flow.exit();
    flow.exit();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.victory).toBe(true);
  });

  it('mourir en sans fin compte comme victoire + sans fin', () => {
    const { flow, recorded, endlessStarts } = setup();
    flow.end(true);
    flow.startEndless();
    expect(endlessStarts()).toBe(1);
    expect(flow.isOver).toBe(false);
    flow.playerDied();
    flow.updateDying(PLAYER_DEATH.duration);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ victory: true, endless: true });
  });

  it('mort : le perso rétrécit, puis la défaite est enregistrée', () => {
    const { flow, recorded } = setup();
    flow.playerDied();
    expect(flow.updateDying(PLAYER_DEATH.hold / 2)).toBe(1);
    expect(flow.isOver).toBe(false);
    expect(flow.updateDying(PLAYER_DEATH.duration)).toBe(0);
    expect(flow.isOver).toBe(true);
    expect(recorded[0]?.victory).toBe(false);
  });

  it('une partie de test ne va jamais au profil', () => {
    const { flow, recorded } = setup();
    flow.markTestRun();
    flow.end(false);
    flow.exit();
    expect(recorded).toHaveLength(0);
  });
});
