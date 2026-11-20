import { Camera } from '../core/Camera';
import type { DebugOverlay } from '../core/DebugOverlay';
import type { Input } from '../core/Input';
import { Rng } from '../core/math';
import { Pool } from '../core/Pool';
import type { Scene } from '../core/Scene';
import type { SpriteAtlas } from '../core/SpriteAtlas';
import type { EffectSheet } from '../core/EffectSheet';
import type { EffectName, SpriteDef } from '../data/sprites';
import { CONTACT_HIT_COOLDOWN } from '../data/combat';
import { AURA_LOOKS, PARTICLES, SHAKE, SHAKE_EVENTS } from '../data/feel';
import { ParticleSystem } from '../systems/ParticleSystem';
import { WorldRenderer } from './game/WorldRenderer';
import {
  buildDevView,
  devSetMutation,
  devSetPassive,
  devSetWeaponLevel,
  devToggleWeapon,
} from './game/devActions';
import { applyOptionsAction } from './options';
import { CONTROLS, END_SCREEN_CLICK_DELAY } from '../data/controls';
import {
  MAXED_XP_MULT,
  EARLY_PASSIVES,
  NEW_WEAPON_GUARANTEE_BELOW,
  REROLLS_PER_RUN,
  RUN_DURATION,
  UPGRADE_CHOICE_COUNT,
} from '../data/progression';
import { ENEMY_POOL_SIZE, SPAWN } from '../data/spawn';
import { BOSS_ABILITIES, BOSS_TYPE } from '../data/waves';
import { PROJECTILE_POOL_SIZE, WEAPONS, type WeaponDef } from '../data/weapons';
import { BOSS_CHALLENGES } from '../data/characters';
import { FURNITURE } from '../data/furniture';
import { applyShopBonuses } from '../data/shop';
import { PickupSystem } from '../systems/PickupSystem';
import { BossAbilitySystem } from '../systems/BossAbilitySystem';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Weapon } from '../entities/Weapon';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DamageNumberSystem } from '../systems/DamageNumberSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { GemSystem } from '../systems/GemSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { StatusSystem } from '../systems/status';
import type { HitKind } from '../systems/damage';
import { STATUS } from '../data/status';
import { WeaponSystem } from '../systems/WeaponSystem';
import { XpSystem } from '../systems/XpSystem';
import {
  applyUpgrade,
  availableUpgrades,
  choiceIconId,
  rollUpgradeChoices,
  type Build,
  type UpgradeChoice,
} from '../systems/upgrades';
import type { EndOverlay } from '../ui/EndOverlay';
import { buildDamageReport, type RunReport } from '../systems/runReport';
import type { Hud } from '../ui/Hud';
import type { LevelUpOverlay } from '../ui/LevelUpOverlay';
import type { PauseOverlay } from '../ui/PauseOverlay';
import type { OptionsOverlay } from '../ui/OptionsOverlay';
import type { DevAction, DevPanel } from '../ui/DevPanel';
import type { Settings } from '../data/settings';
import type { SoundPlayer } from '../core/AudioEngine';
import type { MusicControl } from '../core/MusicPlayer';
import { HIT_SOUNDS, type MusicName, type SfxName } from '../data/audio';

/** s pendant lesquelles un ennemi touché est affiché en blanc */
const ENEMY_HIT_FLASH = 0.08;
/** s minimum entre la fin d'un flash et le suivant (un ennemi pris sous un gros DPS clignote) */
const ENEMY_FLASH_GAP = 0.25;
/** Constante quelconque pour dériver la seed de l'aléatoire visuel de celle du jeu. */
const VISUAL_SEED_SALT = 0x9e3779b9;
/** Idem pour les particules */
const PARTICLE_SEED_SALT = 0xc2b2ae35;
/** Idem pour les étincelles d'aura */
const AURA_SEED_SALT = 0x27d4eb2f;

/**
 * Ce dont la scène a besoin. Les `Pick` ne demandent que les méthodes utilisées :
 * les tests peuvent fournir de faux objets sans navigateur.
 */
export interface GameSceneDeps {
  input: Pick<Input, 'isDown' | 'wasPressed'>;
  pauseOverlay: Pick<PauseOverlay, 'setVisible' | 'takeAction'>;
  endOverlay: Pick<EndOverlay, 'show' | 'hide' | 'takeAction'>;
  levelUpOverlay: Pick<LevelUpOverlay, 'show' | 'hide' | 'takeClick' | 'setRerolls' | 'takeReroll'>;
  hud: Pick<
    Hud,
    | 'setVisible'
    | 'setEndless'
    | 'setTest'
    | 'setGold'
    | 'setTime'
    | 'setProgress'
    | 'setHp'
    | 'setKills'
    | 'setInventory'
  >;
  debug: Pick<DebugOverlay, 'setStat' | 'showHitboxes'>;
  /** Réglages du joueur (écran Options), lus en direct ; modifiables depuis la pause */
  settings: Settings;
  /** Écran Options, ouvert depuis le menu pause */
  optionsOverlay: Pick<OptionsOverlay, 'show' | 'hide' | 'refresh' | 'takeAction'>;
  /** Un réglage vient de changer : main.ts l'applique et le sauvegarde. */
  onSettingsChanged: () => void;
  /** Appelé quand le joueur demande à rejouer : main.ts crée une scène neuve. */
  onRestart: () => void;
  /** Appelé quand le joueur demande le menu principal (écran de fin ou pause). */
  onMenu: () => void;
  /** Appelé une fois quand la partie se termine (mort ou victoire) : main.ts met le profil à jour. */
  onRunEnd: (report: RunReport) => void;
  /** Menu de test (F2), seulement en dev : absent du build et des tests qui n'en ont pas besoin. */
  devPanel?: Pick<DevPanel, 'setVisible' | 'takeActions' | 'refresh'>;
  /** Noms des persos que cette partie débloque (annoncés sur l'écran de fin) */
  unlocksFor: (report: RunReport) => readonly string[];
  /** Atlas des sprites. Absent (pas encore chargé, tests) : on dessine des formes simples. */
  sprites?: SpriteAtlas | null;
  /** Atlas des effets (gemmes, projectiles, orbes). Absent : formes simples. */
  fx?: SpriteAtlas | null;
  /** Effets animés du pack PVFX (explosion, épée, auras, vague). Absents : formes simples. */
  effects?: Readonly<Record<EffectName, EffectSheet>> | null;
  /** Bruitages. Absent (tests) : partie muette. */
  sfx?: SoundPlayer<SfxName>;
  /** Musique. Absente (tests) : partie muette. */
  music?: MusicControl<MusicName>;
}

/** La partie en cours. Map infinie : pas de bords, le joueur va où il veut. */
export class GameScene implements Scene, Build {
  readonly player = new Player();
  readonly camera = new Camera();
  readonly enemies = new Pool(ENEMY_POOL_SIZE, (i) => new Enemy(i));
  private readonly rng: Rng;
  private readonly spawner: SpawnSystem;
  private readonly collisions = new CollisionSystem(ENEMY_POOL_SIZE);
  private readonly movement = new MovementSystem(ENEMY_POOL_SIZE, this.collisions);
  /** Ennemis au contact du joueur à cette update (rempli par CollisionSystem, réutilisé). */
  private readonly touching = new Array<Enemy>(ENEMY_POOL_SIZE);
  private touchingCount = 0;
  /** Armes du joueur. Une seule au départ ; les autres se gagneront en montant de niveau (Phase 4b). */
  readonly weapons: Weapon[];
  readonly projectiles = new Pool(PROJECTILE_POOL_SIZE, () => new Projectile());
  private readonly weaponSystem: WeaponSystem;
  private readonly projectileSystem: ProjectileSystem;
  private readonly statusSystem: StatusSystem;
  readonly damageNumbers: DamageNumberSystem;
  /** Éclats purement visuels (morts, caisses, level up) */
  readonly particles: ParticleSystem;
  /** Aléatoire visuel des étincelles d'aura (séparé de celui du jeu, comme les particules) */
  private readonly auraRng: Rng;
  /** Étincelles d'aura dues mais pas encore émises (fraction qui s'accumule d'une update à l'autre) */
  private auraSparkDebt = 0;
  readonly gems = new GemSystem();
  /** Rangs de boutique de cette partie, et le bonus d'XP qu'ils donnent (Sagesse) */
  private readonly shopRanks: Readonly<Record<string, number>>;
  private readonly xpGainMult: number;
  private readonly bossAbilities = new BossAbilitySystem();
  /** Pièces d'or et nourriture lâchées par le mobilier */
  readonly pickups = new PickupSystem();
  /** Or gagné pendant cette partie (ajouté au total du profil à la fin) */
  gold = 0;
  readonly effects: EffectsSystem;
  readonly progression = new XpSystem();
  /** Niveau de chaque passif possédé (absent = 0) */
  readonly passiveLevels = new Map<string, number>();
  /** Level up gagnés mais pas encore choisis (plusieurs d'un coup avec une grosse gemme) */
  private pendingLevelUps = 0;
  /** Choix affichés à l'écran ; null = pas de level up en cours */
  private choices: UpgradeChoice[] | null = null;
  /** Relances de cartes restantes pour cette partie (une scène neuve à chaque partie) */
  rerollsLeft: number = REROLLS_PER_RUN;
  /** Augmente à chaque upgrade choisi : le HUD ne redessine l'inventaire que quand il change. */
  private buildVersion = 0;
  private paused = false;
  /** Écran Options ouvert par-dessus la pause */
  private optionsOpen = false;
  /** Tout le dessin du monde (la scène ne garde que le HUD) */
  private readonly renderer: WorldRenderer;
  /** Bilan de la partie une fois terminée (victoire ou défaite) ; null = partie en cours */
  private report: RunReport | null = null;
  /** secondes de survie (n'avance pas pendant la pause) */
  private elapsed = 0;
  private killCount = 0;
  /** s passées sur l'écran de fin (temps réel : `elapsed` y est figé) */
  private endScreenTime = 0;
  /** s : moment où plus rien n'était améliorable ; null = build pas encore complet */
  private maxedAt: number | null = null;
  /** Mode sans fin lancé depuis l'écran de victoire */
  private endless = false;
  /** Défis réussis pendant cette partie (ids) */
  private readonly challenges: string[] = [];
  /** Menu de test ouvert (F2) */
  private devOpen = false;
  /** Menu de test : le joueur ne prend plus de dégâts */
  private god = false;
  /** Le menu de test a servi : la partie ne compte pas au profil */
  private testRun = false;
  /** La partie a déjà été ajoutée au profil */
  private recorded = false;
  private readonly runDuration: number;

  /**
   * @param options.runDuration durée de la partie avant la victoire (s). Les tests la raccourcissent
   * pour ne pas simuler 10 minutes.
   */
  constructor(
    private readonly deps: GameSceneDeps,
    seed: number,
    options: {
      runDuration?: number;
      startWeapon?: WeaponDef;
      /** Apparence du perso choisi (purement visuel) */
      sprite?: SpriteDef;
      /** Rangs achetés à la boutique (bonus de départ) */
      shopRanks?: Readonly<Record<string, number>>;
    } = {},
  ) {
    this.effects = new EffectsSystem(deps.effects ?? null);
    if (options.sprite) this.player.sprite = options.sprite;
    // Bonus de boutique : appliqués avant tout, sans prendre d'emplacement de passif.
    this.shopRanks = options.shopRanks ?? {};
    this.xpGainMult = applyShopBonuses(this.player, this.shopRanks);
    this.player.hp = this.player.maxHp;
    // L'arme de départ dépend du perso choisi (Trait arcanique par défaut).
    this.weapons = [new Weapon(options.startWeapon ?? WEAPONS.arcaneBolt)];
    this.runDuration = options.runDuration ?? RUN_DURATION;
    this.rng = new Rng(seed);
    this.spawner = new SpawnSystem(this.enemies, this.rng);
    const hitEvents = {
      onHit: (e: Enemy, damage: number, kind: HitKind, source: Weapon) =>
        this.onEnemyHit(e, damage, kind, source),
      onKill: (e: Enemy) => this.killEnemy(e),
      onExplosion: (x: number, y: number, r: number, color: string) => {
        this.effects.explosion(x, y, r, color);
        this.shake('explosion');
        this.sound('bolt-burst');
      },
      onSlash: (x: number, y: number, angle: number, arc: number, r: number, color: string) => {
        this.effects.slash(x, y, angle, arc, r, color);
        this.sound('sword-slash');
      },
      onFire: () => this.sound('bolt-shoot'),
    };
    this.weaponSystem = new WeaponSystem(
      ENEMY_POOL_SIZE,
      this.collisions,
      this.projectiles,
      hitEvents,
    );
    this.damageNumbers = new DamageNumberSystem(new Rng(seed ^ VISUAL_SEED_SALT));
    this.particles = new ParticleSystem(
      PARTICLES.poolSize,
      new Rng(seed ^ PARTICLE_SEED_SALT),
      PARTICLES.drag,
    );
    this.auraRng = new Rng(seed ^ AURA_SEED_SALT);
    this.renderer = new WorldRenderer(
      this,
      {
        sprites: deps.sprites ?? null,
        fx: deps.fx ?? null,
        effects: deps.effects ?? null,
        showHitboxes: () => deps.debug.showHitboxes,
      },
      seed,
    );
    this.projectileSystem = new ProjectileSystem(ENEMY_POOL_SIZE, this.collisions, hitEvents);
    this.statusSystem = new StatusSystem(hitEvents);
    this.recomputeWeapons();
  }

  get kills(): number {
    return this.killCount;
  }

  /** Vrai pendant l'écran de choix d'upgrade (le jeu est figé). */
  get isChoosingUpgrade(): boolean {
    return this.choices !== null;
  }

  /** Les choix affichés (pour les tests et le debug). */
  get currentChoices(): readonly UpgradeChoice[] {
    return this.choices ?? [];
  }

  enter(): void {
    this.deps.hud.setVisible(true);
    this.deps.hud.setEndless(false);
    this.deps.hud.setTest(false);
    this.deps.devPanel?.setVisible(false);
    this.setPaused(false);
    this.deps.endOverlay.hide();
    this.deps.levelUpOverlay.hide();
    this.deps.music?.play('run');
    // Afficher la seed permet de rejouer exactement la même partie pour reproduire un bug.
    this.deps.debug.setStat('seed', this.rng.seed);
  }

  exit(): void {
    // Victoire sans avoir continué en sans fin : la partie se termine vraiment ici (R ou M).
    // Sans fin quitté par le menu pause : la victoire était acquise, elle compte quand même.
    if (this.endless && !this.report) this.report = this.buildReport(true);
    this.recordRunOnce();
    this.setPaused(false);
    this.deps.optionsOverlay.hide();
    this.deps.endOverlay.hide();
    this.deps.levelUpOverlay.hide();
  }

  /** Onglet caché : on met en pause, pour ne pas reprendre en pleine horde au retour. */
  onHidden(): void {
    // Partie finie ou en plein choix d'upgrade : le jeu est déjà figé, pas besoin de pause.
    // Réglage désactivé : la partie reprend telle quelle au retour (la boucle s'arrête quand même).
    // Déjà en pause dans les options : ne pas réafficher le menu pause par-dessus.
    if (this.optionsOpen) return;
    if (!this.report && !this.choices && this.deps.settings.pauseOnHidden) this.setPaused(true);
  }

  /**
   * Sortie du plein écran : souvent avec Échap, que le navigateur garde pour lui (le jeu ne le
   * reçoit pas). On met en pause pour ne pas reprendre la main en pleine horde.
   */
  onFullscreenExit(): void {
    if (this.report || this.choices || this.paused || this.devOpen) return;
    this.setPaused(true);
  }

  /** Vrai quand la partie est terminée (mort ou victoire). */
  get isOver(): boolean {
    return this.report !== null;
  }

  /** Bilan de fin de partie, ou null si elle est en cours. */
  get result(): RunReport | null {
    return this.report;
  }

  /** Temps de partie écoulé, en secondes (figé pendant la pause et les choix). */
  get runTime(): number {
    return this.elapsed;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  update(dt: number): void {
    const { input } = this.deps;

    if (this.report) {
      this.freeze();
      this.endScreenTime += dt;
      // Lu à chaque update même pendant le délai : un clic trop tôt est jeté, pas gardé pour plus tard.
      const action = this.deps.endOverlay.takeAction();
      const clicked = this.endScreenTime >= END_SCREEN_CLICK_DELAY ? action : null;
      if (
        this.canContinueEndless &&
        (clicked === 'continue' || input.wasPressed(CONTROLS.continue))
      )
        this.startEndless();
      else if (clicked === 'restart' || input.wasPressed(CONTROLS.restart)) this.deps.onRestart();
      else if (clicked === 'menu' || input.wasPressed(CONTROLS.menu)) this.deps.onMenu();
      return;
    }

    if (this.choices) {
      // Écran de level up : le jeu est figé, on attend un choix (clic ou 1-2-3).
      this.freeze();
      const index = this.readChoiceInput();
      if (index !== null) this.chooseUpgrade(index);
      else if (this.readRerollInput()) this.rerollChoices();
      return;
    }

    // Menu de test (F2, dev seulement) : le jeu est figé pendant qu'on règle.
    if (this.deps.devPanel && (this.devOpen || input.wasPressed(CONTROLS.devPanel))) {
      this.freeze();
      this.updateDevPanel(this.deps.devPanel);
      return;
    }

    if (this.paused) {
      this.freeze();
      this.updatePauseMenu();
      return;
    }
    if (input.wasPressed(CONTROLS.pause)) {
      this.setPaused(true);
      return;
    }

    this.elapsed += dt;
    // Tremblement de l'écran (option) : purement visuel, il ne touche qu'au dessin.
    if (this.deps.settings.screenShake) this.camera.updateShake(dt, this.elapsed, SHAKE);
    else this.camera.resetShake();
    // Survécu jusqu'au bout ET plus de boss en vie : tout se fige, écran de victoire.
    // Boss encore là à 10:00 → prolongations : la partie continue jusqu'à sa mort (ou la tienne).
    // En sans fin, plus de victoire : seule la mort termine la partie.
    if (!this.endless && this.elapsed >= this.runDuration && !this.isBossAlive()) {
      // Victoire pile au timer : on affiche 10:00, pas l'arrondi du dernier pas fixe.
      if (this.elapsed - dt < this.runDuration) this.elapsed = this.runDuration;
      this.endRun(true);
      return;
    }

    const axisX = Number(input.isDown(CONTROLS.right)) - Number(input.isDown(CONTROLS.left));
    const axisY = Number(input.isDown(CONTROLS.down)) - Number(input.isDown(CONTROLS.up));
    this.player.update(dt, axisX, axisY);

    if (input.wasPressed(CONTROLS.debugSpawn)) {
      this.spawner.spawnBatch(SPAWN.debugBatch, this.elapsed, this.player.x, this.player.y);
    }
    this.spawner.update(dt, this.elapsed, this.player.x, this.player.y);
    // Musique du boss tant qu'un boss est en vie (le lecteur ne fait rien si elle joue déjà).
    // Parcourir le pool à chaque update est bon marché : ~900 cases, aucune allocation.
    this.deps.music?.play(this.isBossAlive() ? 'boss' : 'run');
    const charges = this.bossAbilities.update(
      this.enemies,
      this.elapsed,
      this.player.x,
      this.player.y,
      this.spawner,
    );
    if (charges > 0) this.shake('bossCharge');
    if (this.bossAbilities.chargeWarnings > 0) this.sound('boss-charge');
    if (this.bossAbilities.summonWarnings > 0) this.sound('boss-summon');
    this.collisions.rebuild(this.enemies);
    this.movement.update(this.enemies, this.player.x, this.player.y, dt, this.elapsed);
    this.touchingCount = this.collisions.pushOutOfPlayer(this.enemies, this.player, this.touching);
    this.applyContactDamage();
    if (this.report) return;

    this.weaponSystem.update(
      dt,
      this.weapons,
      this.player.x,
      this.player.y,
      this.elapsed,
      this.player.facingX,
      this.player.facingY,
    );
    this.projectileSystem.update(dt, this.projectiles);
    this.statusSystem.update(this.enemies, this.elapsed);
    // Sagesse (boutique) : plus d'XP par gemme.
    const gemXp = this.gems.update(dt, this.player);
    if (gemXp > 0) this.sound('gem-pickup');
    const levelsGained = this.progression.addXp(gemXp * this.xpGainMult);
    if (levelsGained > 0) {
      this.sound('level-up');
      // Anneau d'étincelles : il part au moment du level up, puis reprend après le choix.
      this.particles.burst(
        this.player.x,
        this.player.y,
        PARTICLES.levelUp,
        PARTICLES.levelUpColor,
        PARTICLES.levelUp.count,
        true,
      );
    }
    this.pendingLevelUps += levelsGained;
    this.pickups.update(dt, this.player);
    this.gold += this.pickups.gold;
    if (this.pickups.gold > 0) this.sound('coin-pickup');
    if (this.pickups.heal > 0) {
      this.player.heal(this.pickups.heal);
      this.sound('heal');
    }
    this.damageNumbers.update(dt);
    this.effects.update(dt);
    this.emitAuraSparks(dt);
    this.particles.update(dt);
    if (this.pendingLevelUps > 0) this.openLevelUp();
  }

  /** Tire 3 choix (avec l'aléatoire du jeu : même seed → mêmes choix) et les affiche. */
  private openLevelUp(exclude: readonly UpgradeChoice[] = []): void {
    // Niveau atteint par CE level up (s'il en reste plusieurs à choisir, on les montre dans l'ordre).
    const level = this.progression.level - this.pendingLevelUps + 1;

    this.choices = rollUpgradeChoices(
      availableUpgrades(this),
      this.rng,
      UPGRADE_CHOICE_COUNT,
      this.weapons.length < NEW_WEAPON_GUARANTEE_BELOW,
      exclude,
      // Début de partie : passifs moins souvent (un passif niv 1 pèse peu face à une arme).
      level < EARLY_PASSIVES.untilLevel ? EARLY_PASSIVES.weight : 1,
    );
    // Créer ces petits objets est sans risque : seulement au level up.
    this.deps.levelUpOverlay.show(
      level,
      this.choices.map((c) => ({
        ...c,
        iconId: choiceIconId(c),
        weaponName: c.kind === 'mutation' ? c.weapon.def.name : undefined,
        accent: c.kind === 'mutation' ? c.mutation.color : undefined,
      })),
    );
    this.deps.levelUpOverlay.setRerolls(this.rerollsLeft, this.canReroll);
  }

  /** Relance possible : il en reste, et il y a de vraies cartes (pas seulement le soin). */
  get canReroll(): boolean {
    return this.rerollsLeft > 0 && availableUpgrades(this).length > 0;
  }

  private readRerollInput(): boolean {
    const clicked = this.deps.levelUpOverlay.takeReroll();
    return this.deps.input.wasPressed(CONTROLS.reroll) || clicked;
  }

  /** Retire de nouvelles cartes à la place de celles affichées (même niveau, même aléatoire). */
  rerollChoices(): void {
    if (!this.choices || !this.canReroll) return;
    this.rerollsLeft--;
    this.sound('ui-click');
    this.openLevelUp(this.choices);
  }

  /** Index choisi (0, 1, 2) au clavier ou à la souris, ou null s'il n'y a rien de valide. */
  private readChoiceInput(): number | null {
    const { input, levelUpOverlay } = this.deps;
    let index = levelUpOverlay.takeClick();
    if (input.wasPressed(CONTROLS.choice1)) index = 0;
    else if (input.wasPressed(CONTROLS.choice2)) index = 1;
    else if (input.wasPressed(CONTROLS.choice3)) index = 2;
    // Moins de 3 choix possible (fin de partie) : la touche 3 ne doit rien faire.
    if (index === null || !this.choices || index >= this.choices.length) return null;
    return index;
  }

  chooseUpgrade(index: number): void {
    const choice = this.choices?.[index];
    if (!choice) return;
    // Ici plutôt que sur le clic : le choix au clavier (1-2-3) sonne aussi.
    this.sound('ui-click');
    applyUpgrade(choice, this);
    this.recomputeWeapons();
    this.buildVersion++;
    // Plus rien à améliorer (mutations comprises) : les prochains niveaux demandent ×4 d'XP.
    const maxedOut = availableUpgrades(this).length === 0;
    this.progression.xpMult = maxedOut ? MAXED_XP_MULT : 1;
    // Noté une seule fois, pour l'équilibrage : à quel moment le build a été complet.
    if (maxedOut && this.maxedAt === null) this.maxedAt = this.elapsed;
    this.pendingLevelUps--;
    if (this.pendingLevelUps > 0) {
      this.openLevelUp();
    } else {
      this.choices = null;
      this.deps.levelUpOverlay.hide();
    }
  }

  /** Après un changement de niveau d'arme ou de passif : recalcule les stats de chaque arme. */
  private recomputeWeapons(): void {
    for (const weapon of this.weapons) weapon.recompute(this.player);
  }

  /** Retour visuel d'un impact : flash blanc + nombre de dégâts au-dessus de l'ennemi. */
  private onEnemyHit(e: Enemy, damage: number, kind: HitKind, source: Weapon): void {
    // Bruitage selon l'arme (le poison n'en a pas : il tique sans arrêt). Une caisse ne fait
    // pas de bruit d'impact, seulement celui de sa casse.
    if (kind === 'direct' && !e.type.prop) this.sound(HIT_SOUNDS[source.def.kind]);
    const showNumbers = this.deps.settings.damageNumbers; // réglage Options
    if (kind === 'poison') {
      // Poison : nombre vert, sans flash (sinon les empoisonnés clignoteraient sans arrêt).
      if (showNumbers) {
        this.damageNumbers.spawn(e.x, e.y - e.type.radius, damage, STATUS.poisonColor);
      }
      return;
    }
    // Pas de nouveau flash juste après le précédent : sous un gros DPS, l'ennemi resterait blanc.
    if (this.elapsed - e.flashUntil >= ENEMY_FLASH_GAP) {
      e.flashUntil = this.elapsed + ENEMY_HIT_FLASH;
    }
    if (showNumbers) this.damageNumbers.spawn(e.x, e.y - e.type.radius, damage);
  }

  /**
   * Défis des persos du type « tuer tel boss avec telle arme au niveau N » (le Runiste).
   * Le niveau compte la mutation (niveau 6), donc une arme mutée remplit aussi le défi.
   */
  private checkBossChallenges(bossIndex: number): void {
    for (const c of BOSS_CHALLENGES) {
      if (c.bossIndex !== bossIndex || this.challenges.includes(c.id)) continue;
      const weapon = this.weapons.find((w) => w.def.id === c.weaponId);
      if (weapon && weapon.level >= c.minLevel) this.challenges.push(c.id);
    }
  }

  /** Vrai si un boss est encore actif (victoire, musique du boss). Parcours du pool. */
  private isBossAlive(): boolean {
    for (const e of this.enemies.items) if (e.active && e.type === BOSS_TYPE) return true;
    return false;
  }

  /** Vrai pendant les prolongations : temps écoulé mais boss encore en vie. */
  get isOvertime(): boolean {
    return !this.report && !this.endless && this.elapsed >= this.runDuration;
  }

  /** Bruitage (réglages et limites dans data/audio.ts). Sans moteur audio (tests) : rien. */
  private sound(name: SfxName): void {
    this.deps.sfx?.play(name);
  }

  /** Choc qui fait trembler l'écran (voir SHAKE_EVENTS dans data/feel.ts). */
  private shake(event: keyof typeof SHAKE_EVENTS): void {
    const { amount, cap } = SHAKE_EVENTS[event];
    this.camera.addTrauma(amount, cap);
  }

  /** Éclats à la couleur du monstre : plus il est gros, plus il y en a ; une gerbe pour le boss. */
  private deathBurst(e: Enemy): void {
    if (e.type === BOSS_TYPE) {
      this.particles.burst(e.x, e.y, PARTICLES.bossDeath, e.type.color);
      return;
    }
    const d = PARTICLES.death;
    this.particles.burst(
      e.x,
      e.y,
      d,
      e.type.color,
      d.count + Math.round(e.type.radius * d.perRadius),
    );
  }

  /** Un ennemi tombe à 0 PV : il lâche sa gemme d'XP et retourne au pool. */
  private killEnemy(e: Enemy): void {
    // Mobilier cassé : de l'or ou de la nourriture, pas d'XP ni de kill.
    if (e.type.prop) {
      this.particles.burst(e.x, e.y, PARTICLES.crate, PARTICLES.crateColor);
      this.sound('crate-break');
      this.dropLoot(e.x, e.y);
      this.enemies.release(e);
      return;
    }
    if (e.bossIndex >= 0) this.checkBossChallenges(e.bossIndex);
    if (e.type === BOSS_TYPE) this.gold += FURNITURE.bossGold;
    if (e.type.elite) this.gold += BOSS_ABILITIES.eliteGold;
    if (e.type.elite && FURNITURE.eliteFood)
      this.pickups.drop('food', FURNITURE.foodHeal, e.x, e.y);
    this.deathBurst(e);
    this.sound(e.type === BOSS_TYPE ? 'boss-death' : 'enemy-death');
    if (e.type === BOSS_TYPE) this.shake('bossKill');
    else if (e.type.elite) this.shake('eliteKill');
    // Gemme verte (basique) : tirée avec l'aléatoire de la partie, donc reproductible avec la seed.
    const bonusGem = 'bonusGem' in e.type ? e.type.bonusGem : undefined;
    const bonus = bonusGem !== undefined && this.rng.next() < bonusGem.chance;
    const xp = e.type.xp * e.xpMult * (bonus && bonusGem ? bonusGem.xpMult : 1);
    this.gems.drop(e.x, e.y, xp, this.player.x, this.player.y, bonus);
    this.enemies.release(e);
    this.killCount++;
  }

  /** Butin d'un meuble : or (un peu plus en fin de partie) ou nourriture. Tiré avec l'aléatoire du jeu. */
  private dropLoot(x: number, y: number): void {
    if (this.rng.next() < FURNITURE.goldChance) {
      const bonus = Math.floor(this.elapsed / FURNITURE.goldBonusEvery);
      this.pickups.drop('gold', this.rng.int(FURNITURE.goldMin, FURNITURE.goldMax) + bonus, x, y);
    } else {
      this.pickups.drop('food', FURNITURE.foodHeal, x, y);
    }
  }

  /**
   * Chaque ennemi au contact frappe, puis doit attendre CONTACT_HIT_COOLDOWN avant de
   * pouvoir refrapper. Les délais sont indépendants : 10 ennemis au contact = 10 coups.
   * On compare à `elapsed` (temps de partie) : rien à décompter sur chaque ennemi.
   */
  private applyContactDamage(): void {
    for (let i = 0; i < this.touchingCount; i++) {
      const e = this.touching[i];
      // Mobilier : on le casse en marchant dessus (sinon, avec le Trait seul, qui ne le vise pas,
      // il serait presque impossible à casser).
      if (e?.active && e.type.prop) {
        this.killEnemy(e);
        continue;
      }
      if (this.god) continue; // menu de test : invincible
      if (!e || this.elapsed < e.nextContactHitAt) continue;
      this.player.takeHit(e.type.contactDamage);
      this.shake('playerHit');
      this.sound('player-hurt');
      e.nextContactHitAt = this.elapsed + CONTACT_HIT_COOLDOWN;
      if (this.player.isDead) break;
    }
    if (this.player.isDead) this.endRun(false);
  }

  /** Fin de partie (mort ou victoire) : on fige tout et on affiche le bilan. */
  private endRun(victory: boolean): void {
    this.setPaused(false);
    this.deps.music?.play(victory ? 'victory' : 'defeat');
    this.report = this.buildReport(victory);
    this.endScreenTime = 0;
    this.deps.endOverlay.show(
      this.report,
      this.canContinueEndless,
      this.testRun ? [] : this.deps.unlocksFor(this.report),
    );
    // Victoire "normale" : le joueur peut encore continuer en sans fin, on attend pour
    // l'enregistrer (sinon la même partie compterait deux fois). Sinon, c'est fini.
    if (!this.canContinueEndless) this.recordRunOnce();
  }

  private buildReport(victory: boolean): RunReport {
    return {
      // Mourir en sans fin reste une victoire : le boss avait été tué avant.
      victory: victory || this.endless,
      endless: this.endless,
      time: this.elapsed,
      kills: this.killCount,
      gold: this.gold,
      level: this.progression.level,
      challenges: this.challenges.slice(),
      maxedAt: this.maxedAt,
      weapons: buildDamageReport(this.weapons),
    };
  }

  /** Vrai sur l'écran de victoire, tant que le sans fin n'a pas été lancé. */
  private get canContinueEndless(): boolean {
    return this.report !== null && this.report.victory && !this.endless;
  }

  /** C sur l'écran de victoire : la partie reprend, de plus en plus dure, jusqu'à la mort. */
  private startEndless(): void {
    this.endless = true;
    this.report = null;
    this.deps.endOverlay.hide();
    this.deps.hud.setEndless(true);
    this.spawner.startEndless(this.elapsed);
  }

  /** Une partie ne compte qu'une fois dans le profil, quelle que soit la façon dont elle finit. */
  private recordRunOnce(): void {
    if (!this.report || this.recorded) return;
    this.recorded = true;
    // Partie de test (menu F2) : rien n'est enregistré (stats, défis, déblocages).
    if (!this.testRun) this.deps.onRunEnd(this.report);
  }

  /** Vrai en mode sans fin (après avoir continué depuis l'écran de victoire). */
  get isEndless(): boolean {
    return this.endless;
  }

  /** Plus rien ne bouge : sans ça, l'interpolation ferait osciller les entités sur place. */
  private freeze(): void {
    this.camera.resetShake();
    this.player.syncPrevious();
    for (const e of this.enemies.items) e.syncPrevious();
    for (const p of this.projectiles.items) {
      p.prevX = p.x;
      p.prevY = p.y;
    }
    this.damageNumbers.freeze();
    this.particles.freeze();
    this.gems.freeze();
    this.pickups.freeze();
    for (const w of this.weapons) w.prevAngle = w.angle;
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    this.renderer.render(ctx, alpha);
    this.deps.hud.setTime(this.elapsed);
    this.deps.hud.setProgress(this.progression.level, this.progression.progress);
    this.deps.hud.setHp(this.player.hp, this.player.maxHp);
    this.deps.hud.setKills(this.killCount);
    this.deps.hud.setGold(this.gold);
    this.deps.hud.setInventory(this.buildVersion, this.weapons, this.passiveLevels);
    this.deps.debug.setStat('gemmes', this.gems.gems.activeCount);
    this.deps.debug.setStat('ennemis', this.enemies.activeCount);
    this.deps.debug.setStat('contacts', this.touchingCount);
    this.deps.debug.setStat('projectiles', this.projectiles.activeCount);
    this.deps.debug.setStat('kills', this.killCount);
  }

  /** Étincelles qui montent de l'intérieur des auras (purement visuel, aléatoire séparé). */
  private emitAuraSparks(dt: number): void {
    for (const w of this.weapons) {
      if (w.def.kind !== 'aura') continue;
      const look = AURA_LOOKS[w.mutation?.id ?? w.def.id];
      if (!look) continue;
      this.auraSparkDebt += look.sparksPerSecond * dt;
      while (this.auraSparkDebt >= 1) {
        this.auraSparkDebt -= 1;
        // Point au hasard dans le disque (racine carrée : répartition uniforme, pas tassée au centre).
        const a = this.auraRng.range(0, Math.PI * 2);
        const d = Math.sqrt(this.auraRng.next()) * w.radius;
        this.particles.spawn(
          this.player.x + Math.cos(a) * d,
          this.player.y + Math.sin(a) * d,
          this.auraRng.range(-15, 15),
          -look.sparkRise * this.auraRng.range(0.7, 1),
          look.sparkSize,
          look.sparkLife * this.auraRng.range(0.6, 1),
          look.sparkColor,
        );
      }
    }
  }

  /** F2 ouvre/ferme ; Échap ferme aussi. Les actions cliquées sont appliquées ici, dans l'update. */
  private updateDevPanel(panel: NonNullable<GameSceneDeps['devPanel']>): void {
    const { input } = this.deps;
    if (!this.devOpen) {
      this.devOpen = true;
      panel.setVisible(true);
      panel.refresh(buildDevView(this.weapons, this.passiveLevels, this.god));
      return;
    }
    let close = input.wasPressed(CONTROLS.devPanel) || input.wasPressed(CONTROLS.back);
    for (const action of panel.takeActions()) {
      if (action.kind === 'close') close = true;
      else this.applyDevAction(action);
    }
    panel.refresh(buildDevView(this.weapons, this.passiveLevels, this.god));
    // +N niveaux : on ferme pour laisser place à l'écran de level up.
    if (close || this.choices) {
      this.devOpen = false;
      panel.setVisible(false);
    }
  }

  /** Applique une action du menu de test. Toute action fait de la partie une partie de test. */
  applyDevAction(action: DevAction): void {
    this.testRun = true;
    this.deps.hud.setTest(true);
    const player = this.player;
    switch (action.kind) {
      case 'god':
        this.god = !this.god;
        return;
      case 'heal':
        player.hp = player.maxHp;
        return;
      case 'levels':
        this.progression.level += action.count;
        this.pendingLevelUps += action.count;
        if (!this.choices) this.openLevelUp();
        return;
      case 'weaponToggle':
        if (!devToggleWeapon(this.weapons, action.id)) return;
        break;
      case 'weaponLevel':
        if (!devSetWeaponLevel(this.weapons, action.id, action.delta)) return;
        break;
      case 'mutation':
        if (!devSetMutation(this.weapons, action.id, action.index)) return;
        break;
      case 'passive':
        if (!devSetPassive(player, this.passiveLevels, this.shopRanks, action.id, action.delta))
          return;
        break;
      case 'time':
        this.elapsed = action.seconds;
        this.spawner.jumpTo(action.seconds);
        return;
      case 'endless':
        if (this.endless) return;
        this.elapsed = Math.max(this.elapsed, this.runDuration);
        this.startEndless();
        return;
      case 'spawn':
        this.spawner.spawnBatch(action.count, this.elapsed, player.x, player.y);
        return;
      case 'killAll':
        for (const e of this.enemies.items) {
          if (e.active && e.type !== BOSS_TYPE) this.killEnemy(e);
        }
        return;
      case 'boss':
        this.spawner.spawnBoss(player.x, player.y, this.elapsed);
        return;
      case 'gold':
        this.gold += action.amount;
        return;
      case 'elite':
        this.spawner.spawnElite(action.index, player.x, player.y, this.elapsed);
        return;
      case 'close':
        return;
    }
    // Armes ou passifs changés : stats recalculées, inventaire du HUD redessiné.
    this.recomputeWeapons();
    this.buildVersion++;
  }

  /** Vrai si le menu de test a servi pendant cette partie. */
  get isTestRun(): boolean {
    return this.testRun;
  }

  /** Menu pause : clic sur un bouton, ou raccourci clavier (Échap/P, O, R, M). */
  private updatePauseMenu(): void {
    if (this.optionsOpen) {
      this.updateOptions();
      return;
    }
    const { input, pauseOverlay } = this.deps;
    // Le clic d'abord : `takeAction` le consomme même si une touche est aussi pressée.
    const clicked = pauseOverlay.takeAction();
    if (clicked === 'resume' || input.wasPressed(CONTROLS.pause)) this.setPaused(false);
    else if (clicked === 'options' || input.wasPressed(CONTROLS.options)) this.setOptionsOpen(true);
    else if (clicked === 'restart' || input.wasPressed(CONTROLS.restart)) this.deps.onRestart();
    else if (clicked === 'menu' || input.wasPressed(CONTROLS.menu)) this.deps.onMenu();
  }

  /**
   * Écran Options ouvert depuis la pause (le même que celui du menu principal).
   * Échap ou Retour ramène au menu pause, sans reprendre la partie.
   */
  private updateOptions(): void {
    const { input, optionsOverlay, settings } = this.deps;
    const action = optionsOverlay.takeAction();
    if (action?.kind === 'back' || input.wasPressed(CONTROLS.back)) {
      this.setOptionsOpen(false);
    } else if (applyOptionsAction(action, settings)) {
      optionsOverlay.refresh(settings);
      this.deps.onSettingsChanged();
    }
  }

  private setOptionsOpen(open: boolean): void {
    this.optionsOpen = open;
    if (open) this.deps.optionsOverlay.show(this.deps.settings);
    else this.deps.optionsOverlay.hide();
    // Un seul écran à la fois : le menu pause revient quand on ferme les options.
    this.deps.pauseOverlay.setVisible(!open);
    // L'écran Options est haut : son titre passerait sur le timer du HUD.
    this.deps.hud.setVisible(!open);
  }

  /** Vrai pendant que l'écran Options est ouvert par-dessus la pause. */
  get isOptionsOpen(): boolean {
    return this.optionsOpen;
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.deps.music?.setDucked(paused);
    this.deps.pauseOverlay.setVisible(paused);
  }
}
