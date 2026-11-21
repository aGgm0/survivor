// Faux objets pour faire tourner GameScene sans navigateur : partagés par les tests et par le
// bot de simulation (sim/).

import type { GameSceneDeps } from '../src/scenes/GameScene';
import { DEFAULT_SETTINGS } from '../src/data/settings';
import type { RunReport } from '../src/types/RunReport';
import type { EndAction } from '../src/ui/EndOverlay';
import type { OptionsAction } from '../src/ui/OptionsOverlay';
import type { PauseAction } from '../src/ui/PauseOverlay';

/**
 * Faux objets à la place du navigateur : la partie tourne sans DOM ni canvas. `ui` garde ce que
 * la scène a « affiché » ; `pressed` contient les touches appuyées pendant la frame en cours.
 * `isDown` : touches tenues (le bot de simulation s'en sert pour se déplacer).
 */
export function makeHeadlessDeps(isDown: (codes: readonly string[]) => boolean = () => false) {
  const pressed = new Set<string>();
  const ui = {
    paused: false,
    /** Bilan affiché sur l'écran de fin (null = masqué) */
    end: null as RunReport | null,
    /** Bouton « Continuer en sans fin » affiché sur l'écran de fin */
    endCanContinue: false,
    /** Clic simulé sur un bouton de l'écran de fin */
    endClick: null as EndAction | null,
    restarts: 0,
    menus: 0,
    /** Fins de partie signalées (pour le profil) */
    runEnds: 0,
    /** Dernier bilan envoyé au profil */
    recorded: null as RunReport | null,
    endlessShown: false,
    testShown: false,
    /** Clic simulé sur un bouton du menu pause */
    pauseClick: null as PauseAction | null,
    hudVisible: false,
    levelUpShown: null as { level: number; titles: string[] } | null,
    /** Clic simulé sur une carte de level up (lu une fois par la scène) */
    click: null as number | null,
    /** Bouton de relance : compteur affiché et état (null = jamais affiché) */
    rerolls: null as { left: number; enabled: boolean } | null,
    /** Clic simulé sur le bouton de relance */
    rerollClick: false,
    /** Écran Options affiché (depuis la pause) */
    optionsShown: false,
    /** Action simulée sur l'écran Options */
    optionsAction: null as OptionsAction | null,
    /** Réglages changés (= sauvegardes demandées à main.ts) */
    settingsSaves: 0,
    /** Grande barre du boss du HUD : PV / PV max (null = masquée) */
    bossBar: null as number | null,
    /** Contour rouge des PV bas */
    lowHp: 'none' as 'none' | 'warn' | 'critical',
  };
  const deps: GameSceneDeps = {
    input: {
      isDown,
      wasPressed: (codes) => codes.some((c) => pressed.has(c)),
    },
    pauseOverlay: {
      setVisible: (v) => (ui.paused = v),
      takeAction: () => {
        const a = ui.pauseClick;
        ui.pauseClick = null;
        return a;
      },
    },
    endOverlay: {
      show: (report, canContinue = false) => {
        ui.end = report;
        ui.endCanContinue = canContinue;
      },
      hide: () => (ui.end = null),
      takeAction: () => {
        const a = ui.endClick;
        ui.endClick = null;
        return a;
      },
    },
    levelUpOverlay: {
      show: (level, choices) => (ui.levelUpShown = { level, titles: choices.map((c) => c.title) }),
      hide: () => (ui.levelUpShown = null),
      takeClick: () => {
        const c = ui.click;
        ui.click = null;
        return c;
      },
      setRerolls: (left, enabled) => (ui.rerolls = { left, enabled }),
      takeReroll: () => {
        const c = ui.rerollClick;
        ui.rerollClick = false;
        return c;
      },
    },
    hud: {
      setVisible: (v) => (ui.hudVisible = v),
      setEndless: (v) => (ui.endlessShown = v),
      setTest: (v) => (ui.testShown = v),
      setGold: () => {},
      setTime: () => {},
      setProgress: () => {},
      setHp: () => {},
      setKills: () => {},
      setInventory: () => {},
      setBoss: (ratio) => (ui.bossBar = ratio),
      setLowHp: (level) => (ui.lowHp = level),
    },
    debug: { setStat: () => {}, showHitboxes: false },
    settings: { ...DEFAULT_SETTINGS },
    optionsOverlay: {
      show: () => (ui.optionsShown = true),
      hide: () => (ui.optionsShown = false),
      refresh: () => {},
      takeAction: () => {
        const a = ui.optionsAction;
        ui.optionsAction = null;
        return a;
      },
    },
    onSettingsChanged: () => ui.settingsSaves++,
    onRestart: () => ui.restarts++,
    onMenu: () => ui.menus++,
    onRunEnd: (report) => {
      ui.runEnds++;
      ui.recorded = report;
    },
    unlocksFor: () => [],
  };
  /** Simule un appui unique (vu par une seule update, comme Input.endUpdate). */
  return { deps, ui, pressed };
}
