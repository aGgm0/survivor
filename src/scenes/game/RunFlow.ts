import type { MusicControl } from '../../core/MusicPlayer';
import type { MusicName } from '../../data/audio';
import { CONTROLS, END_SCREEN_CLICK_DELAY } from '../../data/controls';
import { PLAYER_DEATH } from '../../data/feel';
import type { RunReport } from '../../types/RunReport';
import type { GameSceneDeps } from '../GameScene';

/** Bilan de la partie sans ce que décide le déroulement (victoire, sans fin) : fourni par la scène. */
export type RunStats = Omit<RunReport, 'victory' | 'endless'>;

/** Ce dont le déroulement a besoin : un sous-ensemble des dépendances de la scène. */
export type RunFlowDeps = Pick<
  GameSceneDeps,
  'input' | 'endOverlay' | 'onRestart' | 'onMenu' | 'onRunEnd' | 'unlocksFor'
> & {
  readonly hud: Pick<GameSceneDeps['hud'], 'setEndless'>;
  readonly music?: MusicControl<MusicName>;
};

/** Ce que le déroulement demande à la scène. */
export interface RunFlowHost {
  /** Chiffres de la partie à cet instant (temps, kills, armes...) */
  stats(): RunStats;
  /** Le joueur continue en sans fin à partir de maintenant (les vagues se durcissent) */
  startEndless(): void;
}

/**
 * Déroulement d'une partie (voir CLAUDE.md § 5.8), sorti de GameScene : en jeu → mort (animation)
 * → écran de fin ; victoire au timer si plus aucun boss ; prolongations ; sans fin ; une seule
 * inscription au profil quelle que soit la façon dont la partie finit. La scène garde les règles
 * du combat ; elle demande ici « est-ce fini ? » et « que faire sur l'écran de fin ? ».
 */
export class RunFlow {
  private report: RunReport | null = null;
  private endless = false;
  /** s passées sur l'écran de fin (les clics trop tôt sont ignorés) */
  private endScreenTime = 0;
  /** s depuis la mort du joueur (animation) ; null = pas en train de mourir */
  private dyingFor: number | null = null;
  /** La partie a déjà été ajoutée au profil */
  private recorded = false;
  /** Le menu de test a servi : la partie ne compte pas au profil */
  private testRun = false;

  constructor(
    private readonly deps: RunFlowDeps,
    private readonly host: RunFlowHost,
    /** s : survivre jusque-là (et plus aucun boss) = victoire */
    readonly duration: number,
  ) {}

  /** Vrai quand la partie est terminée (mort ou victoire) : écran de fin. */
  get isOver(): boolean {
    return this.report !== null;
  }

  /** Bilan de fin de partie, ou null si elle est en cours. */
  get result(): RunReport | null {
    return this.report;
  }

  get isEndless(): boolean {
    return this.endless;
  }

  get isDying(): boolean {
    return this.dyingFor !== null;
  }

  get isTestRun(): boolean {
    return this.testRun;
  }

  /** Le menu de test a servi : rien ne sera enregistré (stats, défis, déblocages). */
  markTestRun(): void {
    this.testRun = true;
  }

  /** Vrai sur l'écran de victoire, tant que le sans fin n'a pas été lancé. */
  get canContinueEndless(): boolean {
    return this.report !== null && this.report.victory && !this.endless;
  }

  /** Vrai pendant les prolongations : temps écoulé mais boss encore en vie. */
  isOvertime(elapsed: number): boolean {
    return !this.report && !this.endless && elapsed >= this.duration;
  }

  /**
   * Survécu jusqu'au bout ET plus de boss en vie. Boss encore là au timer → prolongations,
   * jusqu'à sa mort (ou celle du joueur). En sans fin, plus de victoire : seule la mort finit.
   */
  reachedVictory(elapsed: number, bossAlive: boolean): boolean {
    return !this.report && !this.endless && elapsed >= this.duration && !bossAlive;
  }

  /** PV à 0 : tout se fige et le perso rétrécit ; jingle de défaite tout de suite. */
  playerDied(): void {
    if (this.dyingFor !== null) return;
    this.dyingFor = 0;
    this.deps.music?.play('defeat');
  }

  /**
   * Animation de mort : renvoie l'échelle du perso (1 → 0). À la fin, l'écran de défaite.
   * (Les dates sont dans PLAYER_DEATH, data/feel.ts.)
   */
  updateDying(dt: number): number {
    if (this.dyingFor === null) return 1;
    this.dyingFor += dt;
    const t = (this.dyingFor - PLAYER_DEATH.hold) / PLAYER_DEATH.shrink;
    const scale = 1 - Math.min(1, Math.max(0, t));
    if (this.dyingFor >= PLAYER_DEATH.duration) this.end(false);
    return scale;
  }

  /** Fin de partie (mort ou victoire) : bilan, écran de fin, inscription au profil si c'est fini. */
  end(victory: boolean): void {
    this.dyingFor = null;
    if (victory) this.deps.music?.play('victory');
    this.report = this.buildReport(victory);
    this.endScreenTime = 0;
    this.deps.endOverlay.show(
      this.report,
      this.canContinueEndless,
      this.testRun ? [] : this.deps.unlocksFor(this.report),
    );
    // Victoire "normale" : le joueur peut encore continuer en sans fin, on attend pour
    // l'enregistrer (sinon la même partie compterait deux fois). Sinon, c'est fini.
    if (!this.canContinueEndless) this.recordOnce();
  }

  /** Écran de fin : Continuer en sans fin (victoire), Rejouer ou Menu, au clic ou au clavier. */
  updateEndScreen(dt: number): void {
    const { input } = this.deps;
    this.endScreenTime += dt;
    // Lu à chaque update même pendant le délai : un clic trop tôt est jeté, pas gardé pour plus tard.
    const action = this.deps.endOverlay.takeAction();
    const clicked = this.endScreenTime >= END_SCREEN_CLICK_DELAY ? action : null;
    if (this.canContinueEndless && (clicked === 'continue' || input.wasPressed(CONTROLS.continue)))
      this.startEndless();
    else if (clicked === 'restart' || input.wasPressed(CONTROLS.restart)) this.deps.onRestart();
    else if (clicked === 'menu' || input.wasPressed(CONTROLS.menu)) this.deps.onMenu();
  }

  /** C sur l'écran de victoire (ou menu de test) : la partie reprend, de plus en plus dure. */
  startEndless(): void {
    this.endless = true;
    this.report = null;
    this.deps.endOverlay.hide();
    this.deps.hud.setEndless(true);
    this.host.startEndless();
  }

  /**
   * On quitte la scène (Rejouer, Menu). Victoire sans sans fin : elle se termine vraiment ici.
   * Sans fin quitté par le menu pause : la victoire était acquise, elle compte quand même.
   */
  exit(): void {
    if (this.endless && !this.report) this.report = this.buildReport(true);
    this.recordOnce();
  }

  private buildReport(victory: boolean): RunReport {
    return {
      ...this.host.stats(),
      // Mourir en sans fin reste une victoire : le boss avait été tué avant.
      victory: victory || this.endless,
      endless: this.endless,
    };
  }

  /** Une partie ne compte qu'une fois dans le profil, quelle que soit la façon dont elle finit. */
  private recordOnce(): void {
    if (!this.report || this.recorded) return;
    this.recorded = true;
    if (!this.testRun) this.deps.onRunEnd(this.report);
  }
}
