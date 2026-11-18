import { Camera } from '../core/Camera';
import type { DebugOverlay } from '../core/DebugOverlay';
import type { Input } from '../core/Input';
import { lerp, Rng } from '../core/math';
import { Pool } from '../core/Pool';
import type { Scene } from '../core/Scene';
import {
  frameAt,
  type SpriteAnimation,
  type SpriteAtlas,
  type SpriteTint,
} from '../core/SpriteAtlas';
import { clipFrameIndex, type EffectSheet } from '../core/EffectSheet';
import {
  WAVE_FX,
  type EffectName,
  BOLT_SPRITE,
  ORB_SPRITE,
  ENEMY_ANIM_OFFSET,
  ENEMY_IDLE_SPEED,
  HIT_FLASH_TINT,
  type SpriteDef,
  enemySprite,
} from '../data/sprites';
import { CONTACT_HIT_COOLDOWN } from '../data/combat';
import { AURA_LOOKS, PARTICLES, SHAKE, SHAKE_EVENTS, type AuraLook } from '../data/feel';
import { ParticleSystem } from '../systems/ParticleSystem';
import { buildFloor } from './floor';
import { CONTROLS } from '../data/controls';
import { ENEMY_TYPE_LIST } from '../data/enemies';
import {
  MAXED_XP_MULT,
  NEW_WEAPON_GUARANTEE_BELOW,
  RUN_DURATION,
  UPGRADE_CHOICE_COUNT,
} from '../data/progression';
import { ENEMY_POOL_SIZE, SPAWN } from '../data/spawn';
import { BOSS_ABILITIES, BOSS_TYPE } from '../data/waves';
import {
  PROJECTILE_POOL_SIZE,
  WEAPON_LIST,
  WEAPONS,
  weaponMaxLevel,
  type WeaponDef,
} from '../data/weapons';
import { PASSIVES } from '../data/upgrades';
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
  rebuildPassiveStats,
  rollUpgradeChoices,
  type Build,
  type UpgradeChoice,
} from '../systems/upgrades';
import type { EndOverlay } from '../ui/EndOverlay';
import { buildDamageReport, type RunReport } from '../systems/runReport';
import type { Hud } from '../ui/Hud';
import type { LevelUpOverlay } from '../ui/LevelUpOverlay';
import type { PauseOverlay } from '../ui/PauseOverlay';
import type { DevAction, DevPanel, DevView } from '../ui/DevPanel';
import type { Settings } from '../data/settings';
import type { SoundPlayer } from '../core/AudioEngine';
import type { MusicControl } from '../core/MusicPlayer';
import { HIT_SOUNDS, type MusicName, type SfxName } from '../data/audio';

/** px entre deux lignes de la grille de fond */
const GRID_SIZE = 64;
const GRID_COLOR = '#2c2c3d';
const HITBOX_COLOR = '#00e5ff';
/** Halo autour des projectiles : taille (× rayon) et opacité */
const PROJECTILE_GLOW_SCALE = 2;
const PROJECTILE_GLOW_ALPHA = 0.3;
/** Deux passes de dessin (halo puis cœur), définies une fois pour ne rien allouer par frame. */
const PROJECTILE_PASSES = [PROJECTILE_GLOW_SCALE, 1] as const;
/** s pendant lesquelles un ennemi touché est affiché en blanc */
const ENEMY_HIT_FLASH = 0.08;
/** s minimum entre la fin d'un flash et le suivant (un ennemi pris sous un gros DPS clignote) */
const ENEMY_FLASH_GAP = 0.25;
/** Opacité du flash sur les sprites */
const ENEMY_FLASH_ALPHA = 0.65;
const ENEMY_FLASH_COLOR = '#ffffff';
/** Constante quelconque pour dériver la seed de l'aléatoire visuel de celle du jeu. */
const VISUAL_SEED_SALT = 0x9e3779b9;
/** Idem pour le tirage des dalles du sol */
const FLOOR_SEED_SALT = 0x85ebca6b;
/** Idem pour les particules */
const PARTICLE_SEED_SALT = 0xc2b2ae35;
/** Idem pour les étincelles d'aura */
const AURA_SEED_SALT = 0x27d4eb2f;

/**
 * Teinte « multiply » à la couleur d'une arme. Une seule par couleur, créée la première fois puis
 * gardée : c'est l'objet qui sert de clé à la copie teintée de l'atlas.
 */
const WEAPON_TINTS = new Map<string, SpriteTint>();
function weaponTint(color: string): SpriteTint {
  let tint = WEAPON_TINTS.get(color);
  if (!tint) {
    tint = { color, mode: 'multiply' };
    WEAPON_TINTS.set(color, tint);
  }
  return tint;
}

/** Opacité du disque de l'aura (le contour est plus marqué) */
const AURA_FILL_ALPHA = 0.12;
const AURA_STROKE_ALPHA = 0.5;
/** rad/s du scintillement des braises d'aura */
const EMBER_FLICKER_SPEED = 6;
/** Opacité du trait sombre sous les braises */
const EMBER_RING_ALPHA = 0.6;
/** Mini-boss : anneau doré pulsant (réglages purement visuels) */
const ELITE_LOOK = {
  ringColor: '#ffd54f',
  ringWidth: 3,
  ringGap: 5,
  ringPulse: 4,
  pulseSpeed: 6,
  barScale: 0.6,
} as const;
/** Annonces des capacités de boss (purement visuel) */
const TELEGRAPH = {
  chargeColor: '#ff3b3b',
  summonColor: '#b14cff',
  summonWidth: 4,
  alpha: 0.35,
} as const;
/** Barre de PV au-dessus du boss */
const BOSS_BAR = { width: 90, height: 7, offset: 12, fill: '#e5484d', bg: '#1a1a1a' } as const;

/**
 * Ce dont la scène a besoin. Les `Pick` ne demandent que les méthodes utilisées :
 * les tests peuvent fournir de faux objets sans navigateur.
 */
export interface GameSceneDeps {
  input: Pick<Input, 'isDown' | 'wasPressed'>;
  pauseOverlay: Pick<PauseOverlay, 'setVisible' | 'takeAction'>;
  endOverlay: Pick<EndOverlay, 'show' | 'hide'>;
  levelUpOverlay: Pick<LevelUpOverlay, 'show' | 'hide' | 'takeClick'>;
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
  /** Réglages du joueur (écran Options), lus en direct */
  settings: Readonly<Settings>;
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
  private readonly camera = new Camera();
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
  /** Augmente à chaque upgrade choisi : le HUD ne redessine l'inventaire que quand il change. */
  private buildVersion = 0;
  private paused = false;
  /** Image du sol (dalles tirées au hasard), préparée une fois ; null = pas de sprites, grille */
  private readonly floorTiles: HTMLCanvasElement | null;
  /** Motif répété tiré de `floorTiles`, créé au premier rendu (il faut le contexte du canvas) */
  private floorPattern: CanvasPattern | null = null;
  /** Bilan de la partie une fois terminée (victoire ou défaite) ; null = partie en cours */
  private report: RunReport | null = null;
  /** secondes de survie (n'avance pas pendant la pause) */
  private elapsed = 0;
  private killCount = 0;
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
    this.floorTiles = deps.sprites
      ? buildFloor(deps.sprites, new Rng(seed ^ FLOOR_SEED_SALT))
      : null;
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
    this.deps.endOverlay.hide();
    this.deps.levelUpOverlay.hide();
  }

  /** Onglet caché : on met en pause, pour ne pas reprendre en pleine horde au retour. */
  onHidden(): void {
    // Partie finie ou en plein choix d'upgrade : le jeu est déjà figé, pas besoin de pause.
    // Réglage désactivé : la partie reprend telle quelle au retour (la boucle s'arrête quand même).
    if (!this.report && !this.choices && this.deps.settings.pauseOnHidden) this.setPaused(true);
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
      if (this.canContinueEndless && input.wasPressed(CONTROLS.continue)) this.startEndless();
      else if (input.wasPressed(CONTROLS.restart)) this.deps.onRestart();
      else if (input.wasPressed(CONTROLS.menu)) this.deps.onMenu();
      return;
    }

    if (this.choices) {
      // Écran de level up : le jeu est figé, on attend un choix (clic ou 1-2-3).
      this.freeze();
      const index = this.readChoiceInput();
      if (index !== null) this.chooseUpgrade(index);
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
  private openLevelUp(): void {
    // Niveau atteint par CE level up (s'il en reste plusieurs à choisir, on les montre dans l'ordre).
    const level = this.progression.level - this.pendingLevelUps + 1;

    this.choices = rollUpgradeChoices(
      availableUpgrades(this),
      this.rng,
      UPGRADE_CHOICE_COUNT,
      this.weapons.length < NEW_WEAPON_GUARANTEE_BELOW,
    );
    // Créer ces petits objets est sans risque : seulement au level up.
    this.deps.levelUpOverlay.show(
      level,
      this.choices.map((c) => ({
        ...c,
        iconId: choiceIconId(c),
        weaponName: c.kind === 'mutation' ? c.weapon.def.name : undefined,
      })),
    );
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
    this.deathBurst(e);
    this.sound(e.type === BOSS_TYPE ? 'boss-death' : 'enemy-death');
    if (e.type === BOSS_TYPE) this.shake('bossKill');
    else if (e.type.elite) this.shake('eliteKill');
    this.gems.drop(e.x, e.y, e.type.xp * e.xpMult, this.player.x, this.player.y);
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
    // La caméra est un réglage d'affichage, pas de l'état de jeu : la placer ici
    // sur la position interpolée évite que le joueur "tremble" par rapport au décor.
    this.camera.lookAt(this.player.renderX(alpha), this.player.renderY(alpha));

    this.camera.begin(ctx);
    this.renderGrid(ctx);
    // Les gemmes sont au sol : dessinées sous les ennemis.
    this.gems.render(ctx, alpha, this.camera, this.deps.fx);
    this.pickups.render(ctx, alpha, this.camera, this.deps.sprites, this.elapsed);
    this.renderAuras(ctx, alpha); // au sol, sous les ennemis
    this.renderBossTelegraphs(ctx, alpha); // au sol aussi : la zone à éviter
    this.renderEnemies(ctx, alpha);
    this.particles.render(ctx, alpha, this.camera); // éclats par-dessus les corps, sous le joueur
    this.renderEliteRings(ctx, alpha);
    this.renderBossBars(ctx, alpha);
    this.player.render(ctx, alpha, this.deps.sprites);
    this.renderOrbs(ctx, alpha);
    this.renderProjectiles(ctx, alpha);
    this.effects.render(ctx, this.camera);
    this.damageNumbers.render(ctx, alpha, this.camera);
    if (this.deps.debug.showHitboxes) this.renderHitboxes(ctx, alpha);
    this.camera.end(ctx);

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

  /** Barre de PV au-dessus de chaque boss visible (1000 PV : on veut voir où il en est). */
  private renderBossBars(ctx: CanvasRenderingContext2D, alpha: number): void {
    const items = this.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      // Barre de PV pour les boss et les mini-boss (plus courte pour ces derniers).
      if (!e?.active || (e.type !== BOSS_TYPE && !e.type.elite)) continue;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      // Au-dessus de la tête (le sprite dépasse la hitbox vers le haut).
      const barY = this.enemyTop(e, y) - BOSS_BAR.offset - BOSS_BAR.height;
      if (!this.isOnScreen(x, y, y - barY)) continue;
      const width = e.type.elite ? BOSS_BAR.width * ELITE_LOOK.barScale : BOSS_BAR.width;
      const barX = x - width / 2;
      ctx.fillStyle = BOSS_BAR.bg;
      ctx.fillRect(barX, barY, width, BOSS_BAR.height);
      ctx.fillStyle = BOSS_BAR.fill;
      ctx.fillRect(barX, barY, width * Math.max(0, e.hp / e.maxHp), BOSS_BAR.height);
    }
  }

  /** Anneau doré qui pulse autour des mini-boss : on les repère au milieu de la horde. */
  private renderEliteRings(ctx: CanvasRenderingContext2D, alpha: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * ELITE_LOOK.pulseSpeed);
    ctx.strokeStyle = ELITE_LOOK.ringColor;
    ctx.lineWidth = ELITE_LOOK.ringWidth;
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.beginPath();
    for (const e of this.enemies.items) {
      if (!e.active || !e.type.elite) continue;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      const r = e.type.radius + ELITE_LOOK.ringGap + pulse * ELITE_LOOK.ringPulse;
      if (!this.isOnScreen(x, y, r)) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Annonces des capacités de boss : ligne rouge (trajectoire de la charge) et cercle violet
   * qui grandit (invocation). Lisibles même en pleine horde : c'est ce qui permet d'esquiver.
   */
  private renderBossTelegraphs(ctx: CanvasRenderingContext2D, alpha: number): void {
    const charge = BOSS_ABILITIES.charge;
    const summon = BOSS_ABILITIES.summon;
    for (const e of this.enemies.items) {
      if (!e.active || e.type !== BOSS_TYPE) continue;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      if (e.chargeState === 'windup') {
        const length = e.type.speed * e.speedMult * charge.speedMult * charge.duration;
        ctx.strokeStyle = TELEGRAPH.chargeColor;
        ctx.lineWidth = e.type.radius * 2;
        ctx.globalAlpha = TELEGRAPH.alpha;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + e.chargeDirX * length, y + e.chargeDirY * length);
        ctx.stroke();
      }
      if (e.summonAt > 0) {
        const progress = 1 - Math.max(0, e.summonAt - this.elapsed) / summon.cast;
        ctx.strokeStyle = TELEGRAPH.summonColor;
        ctx.lineWidth = TELEGRAPH.summonWidth;
        ctx.globalAlpha = TELEGRAPH.alpha + (1 - TELEGRAPH.alpha) * progress;
        ctx.beginPath();
        ctx.arc(x, y, summon.radius * progress + e.type.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Auras : disque très léger (pour voir la zone) et anneau de braises carrées posé sur le bord,
   * qui tourne et scintille (voir AURA_LOOKS). Rien n'est modifié ici : tout dépend du temps.
   */
  private renderAuras(ctx: CanvasRenderingContext2D, alpha: number): void {
    const px = this.player.renderX(alpha);
    const py = this.player.renderY(alpha);
    for (const w of this.weapons) {
      if (w.def.kind !== 'aura') continue;
      const look = AURA_LOOKS[w.mutation?.id ?? w.def.id];
      ctx.beginPath();
      ctx.arc(px, py, w.radius, 0, Math.PI * 2);
      ctx.fillStyle = w.color; // couleur de la mutation si l'aura a muté
      ctx.globalAlpha = look ? look.fillAlpha : AURA_FILL_ALPHA;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (look) this.renderEmbers(ctx, px, py, w.radius, look);
      else {
        ctx.globalAlpha = AURA_STROKE_ALPHA;
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /**
   * Braises le long du cercle : leur nombre suit la circonférence (l'anneau garde le même aspect
   * quand le rayon grandit). Chacune scintille à son rythme et prend la couleur claire, moyenne
   * ou sombre selon sa luminosité. Un passage par couleur : 3 changements de fillStyle seulement.
   */
  private renderEmbers(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    look: AuraLook,
  ): void {
    const count = Math.max(24, Math.round((Math.PI * 2 * radius) / look.emberSpacing));
    const t = this.elapsed;
    const spin = t * look.spin;
    const size = look.emberSize;
    // Trait sombre continu sous les braises : l'anneau reste lisible entre deux scintillements.
    ctx.beginPath();
    ctx.arc(cx, cy, radius - size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = look.colors[2];
    ctx.lineWidth = 2;
    ctx.globalAlpha = EMBER_RING_ALPHA;
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (let shade = 0; shade < 3; shade++) {
      ctx.fillStyle = look.colors[shade] ?? look.colors[1];
      for (let k = 0; k < count; k++) {
        // Scintillement de 0 à 1, décalé d'une braise à l'autre.
        const flicker = 0.5 + 0.5 * Math.sin(t * EMBER_FLICKER_SPEED + k * 2.3);
        const kShade = flicker > 0.66 ? 0 : flicker > 0.33 ? 1 : 2;
        if (kShade !== shade) continue;
        const a = spin + (k / count) * Math.PI * 2;
        // Une braise sur deux légèrement à l'intérieur : un anneau épais, pas une ligne.
        const r = radius - (k % 2) * size;
        // Positions calées sur une grille de 2 px : des pixels nets, comme les sprites ×2.
        const x = Math.round((cx + Math.cos(a) * r - size / 2) / 2) * 2;
        const y = Math.round((cy + Math.sin(a) * r - size / 2) / 2) * 2;
        ctx.fillRect(x, y, size, size);
      }
    }
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

  /** Orbes autour du joueur, à leur angle interpolé (rotation fluide à 144/240 Hz). */
  private renderOrbs(ctx: CanvasRenderingContext2D, alpha: number): void {
    const px = this.player.renderX(alpha);
    const py = this.player.renderY(alpha);
    for (const w of this.weapons) {
      if (w.def.kind !== 'orbit') continue;
      const angle = lerp(w.prevAngle, w.angle, alpha);
      const fx = this.deps.fx;
      const frame =
        fx && frameAt(fx.animation(ORB_SPRITE.anim), this.elapsed, ORB_SPRITE.frameTime);
      if (fx && frame) {
        // Sprite à la taille exacte de la hitbox (niveaux, mutation, passif Taille compris).
        const scale = (w.orbRadius * 2) / ORB_SPRITE.diameter;
        const tint = weaponTint(w.color);
        for (let o = 0; o < w.count; o++) {
          const x = WeaponSystem.orbX(px, angle, o, w.count, w.orbitDistance);
          const y = WeaponSystem.orbY(py, angle, o, w.count, w.orbitDistance);
          fx.draw(ctx, frame, x, y + (frame.h * scale) / 2, scale, false, tint);
        }
        continue;
      }
      ctx.beginPath();
      for (let o = 0; o < w.count; o++) {
        const x = WeaponSystem.orbX(px, angle, o, w.count, w.orbitDistance);
        const y = WeaponSystem.orbY(py, angle, o, w.count, w.orbitDistance);
        ctx.moveTo(x + w.orbRadius, y);
        ctx.arc(x, y, w.orbRadius, 0, Math.PI * 2);
      }
      ctx.fillStyle = w.color;
      ctx.fill();
    }
  }

  /** Projectiles groupés par arme (une couleur = un chemin) : un halo, puis le cœur. */
  private renderProjectiles(ctx: CanvasRenderingContext2D, alpha: number): void {
    const items = this.projectiles.items;
    for (const weapon of this.weapons) {
      // Projectiles du Trait, et vagues de la Lame d'onde (l'Épée lance aussi des projectiles).
      if (weapon.def.kind !== 'projectile' && !weapon.mutation?.wave) continue;
      // Trait arcanique : halo rond, puis sprite orienté. Vagues de la Lame d'onde : ronds.
      const wave = weapon.mutation?.wave;
      const waveSheet = this.deps.effects?.wave;
      if (wave && waveSheet) {
        this.renderWaves(ctx, alpha, weapon, waveSheet, wave.lifetime);
        continue;
      }
      const fx = weapon.def.kind === 'projectile' ? this.deps.fx : null;
      const bolt = fx?.animation(BOLT_SPRITE.anim);
      for (const pass of PROJECTILE_PASSES) {
        if (fx && bolt && bolt.length > 0 && pass === 1) {
          this.renderBolts(ctx, alpha, weapon, fx, bolt);
          continue;
        }
        ctx.beginPath();
        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          if (!p?.active || p.source !== weapon) continue;
          const x = p.renderX(alpha);
          const y = p.renderY(alpha);
          const r = p.radius * pass;
          if (!this.isOnScreen(x, y, r)) continue;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.globalAlpha = pass === 1 ? 1 : PROJECTILE_GLOW_ALPHA;
        ctx.fillStyle = weapon.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Vagues de la Lame d'onde : lame de vent orientée dans le sens du tir, jouée sur la durée de
   * vie de la vague, sa hauteur visible = le diamètre de la hitbox.
   */
  private renderWaves(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    weapon: Weapon,
    sheet: EffectSheet,
    lifetime: number,
  ): void {
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p?.active || p.source !== weapon) continue;
      const x = p.renderX(alpha);
      const y = p.renderY(alpha);
      const scale = (p.radius * 2) / WAVE_FX.artHeight;
      if (!this.isOnScreen(x, y, sheet.clip.width * scale)) continue;
      const progress = Math.min(0.999, Math.max(0, 1 - p.life / lifetime));
      const index = clipFrameIndex(sheet.clip, progress * sheet.clip.totalMs);
      sheet.draw(ctx, index, x, y, scale, Math.atan2(p.vy, p.vx), 'visibleCenter');
    }
  }

  /** Projectiles d'une arme en sprites, tournés dans le sens du tir, tête = taille de la hitbox. */
  private renderBolts(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    weapon: Weapon,
    fx: SpriteAtlas,
    bolt: SpriteAnimation,
  ): void {
    ctx.globalAlpha = 1;
    const tint = weaponTint(weapon.color);
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p?.active || p.source !== weapon) continue;
      const x = p.renderX(alpha);
      const y = p.renderY(alpha);
      const scale = (p.radius * 2) / BOLT_SPRITE.headDiameter;
      if (!this.isOnScreen(x, y, BOLT_SPRITE.headCenterX * scale)) continue;
      const frame = frameAt(bolt, this.elapsed + i * ENEMY_ANIM_OFFSET, BOLT_SPRITE.frameTime);
      if (!frame) continue;
      const angle = Math.atan2(p.vy, p.vx);
      fx.drawRotated(ctx, frame, x, y, scale, angle, BOLT_SPRITE.headCenterX, tint);
    }
  }

  private isOnScreen(x: number, y: number, r: number): boolean {
    const cam = this.camera;
    return x + r >= cam.left && x - r <= cam.right && y + r >= cam.top && y - r <= cam.bottom;
  }

  /** Debug (F3) : contour des hitboxes, pour vérifier visuellement les collisions. */
  private renderHitboxes(ctx: CanvasRenderingContext2D, alpha: number): void {
    const items = this.enemies.items;
    ctx.beginPath();
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active) continue;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      const r = e.type.radius;
      if (!this.isOnScreen(x, y, r)) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    const px = this.player.renderX(alpha);
    const py = this.player.renderY(alpha);
    ctx.moveTo(px + this.player.radius, py);
    ctx.arc(px, py, this.player.radius, 0, Math.PI * 2);
    ctx.strokeStyle = HITBOX_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** F2 ouvre/ferme ; Échap ferme aussi. Les actions cliquées sont appliquées ici, dans l'update. */
  private updateDevPanel(panel: NonNullable<GameSceneDeps['devPanel']>): void {
    const { input } = this.deps;
    if (!this.devOpen) {
      this.devOpen = true;
      panel.setVisible(true);
      panel.refresh(this.devView());
      return;
    }
    let close = input.wasPressed(CONTROLS.devPanel) || input.wasPressed(CONTROLS.back);
    for (const action of panel.takeActions()) {
      if (action.kind === 'close') close = true;
      else this.applyDevAction(action);
    }
    panel.refresh(this.devView());
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
      case 'weaponToggle': {
        const index = this.weapons.findIndex((w) => w.def.id === action.id);
        const def = WEAPON_LIST.find((d) => d.id === action.id);
        if (index >= 0) this.weapons.splice(index, 1);
        else if (def) this.weapons.push(new Weapon(def));
        break;
      }
      case 'weaponLevel': {
        const w = this.weapons.find((x) => x.def.id === action.id);
        if (!w) return;
        // Les niveaux normaux seulement (1 à 5) ; la mutation (niveau 6) a ses propres boutons.
        w.mutation = null;
        w.level = Math.max(1, Math.min(weaponMaxLevel(w.def), w.level + action.delta));
        break;
      }
      case 'mutation': {
        const w = this.weapons.find((x) => x.def.id === action.id);
        if (!w) return;
        w.mutation = w.def.mutations?.[action.index] ?? null;
        w.level = weaponMaxLevel(w.def) + (w.mutation ? 1 : 0);
        break;
      }
      case 'passive': {
        const passive = PASSIVES.find((p) => p.id === action.id);
        if (!passive) return;
        const level = Math.max(
          0,
          Math.min(passive.maxLevel, (this.passiveLevels.get(passive.id) ?? 0) + action.delta),
        );
        if (level > 0) this.passiveLevels.set(passive.id, level);
        else this.passiveLevels.delete(passive.id);
        rebuildPassiveStats(player, this.passiveLevels);
        // Le recalcul repart des stats de base : on remet les bonus de boutique par-dessus.
        applyShopBonuses(player, this.shopRanks);
        break;
      }
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

  /** Ce que le menu de test affiche. Créé seulement quand il est ouvert (pas en jeu). */
  private devView(): DevView {
    return {
      god: this.god,
      weapons: WEAPON_LIST.map((def) => {
        const w = this.weapons.find((x) => x.def.id === def.id);
        const mutation = w?.mutation ? (def.mutations?.indexOf(w.mutation) ?? -1) : -1;
        return { id: def.id, owned: !!w, level: w?.level ?? 0, mutation };
      }),
      passives: PASSIVES.map((p) => ({ id: p.id, level: this.passiveLevels.get(p.id) ?? 0 })),
    };
  }

  /** Vrai si le menu de test a servi pendant cette partie. */
  get isTestRun(): boolean {
    return this.testRun;
  }

  /** Menu pause : clic sur un bouton, ou raccourci clavier (Échap/P, R, M). */
  private updatePauseMenu(): void {
    const { input, pauseOverlay } = this.deps;
    // Le clic d'abord : `takeAction` le consomme même si une touche est aussi pressée.
    const clicked = pauseOverlay.takeAction();
    if (clicked === 'resume' || input.wasPressed(CONTROLS.pause)) this.setPaused(false);
    else if (clicked === 'restart' || input.wasPressed(CONTROLS.restart)) this.deps.onRestart();
    else if (clicked === 'menu' || input.wasPressed(CONTROLS.menu)) this.deps.onMenu();
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.deps.music?.setDucked(paused);
    this.deps.pauseOverlay.setVisible(paused);
  }

  /**
   * Dessin groupé par type : un seul chemin + un seul `fill()` par couleur,
   * au lieu d'un `fill()` par ennemi. Les ennemis hors écran sont ignorés.
   * Les ennemis qui viennent d'être touchés sont dessinés à part, en blanc.
   */
  private renderEnemies(ctx: CanvasRenderingContext2D, alpha: number): void {
    this.renderEnemySprites(ctx, alpha);
    for (const type of ENEMY_TYPE_LIST) {
      ctx.beginPath();
      this.addEnemyCircles(ctx, alpha, type, false);
      ctx.fillStyle = type.color;
      ctx.fill();
    }
    ctx.beginPath();
    this.addEnemyCircles(ctx, alpha, null, true);
    ctx.fillStyle = ENEMY_FLASH_COLOR;
    ctx.fill();
  }

  /**
   * Ajoute au chemin en cours les cercles des ennemis visibles qui correspondent au filtre :
   * `type` (null = tous) et `flashing` (vient d'être touché ou non).
   */
  private addEnemyCircles(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    type: Enemy['type'] | null,
    flashing: boolean,
  ): void {
    const items = this.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active || (type && e.type !== type)) continue;
      if (this.deps.sprites && enemySprite(e.type.id)) continue; // déjà dessiné en sprite
      if (e.flashUntil > this.elapsed !== flashing) continue;
      const r = e.type.radius;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      if (!this.isOnScreen(x, y, r)) continue;
      // moveTo évite qu'un trait relie chaque cercle au précédent.
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }

  /**
   * Ennemis qui ont un sprite (voir data/sprites.ts) : pieds sur le bas de la hitbox, tournés
   * vers le joueur, silhouette blanche quand ils viennent d'être touchés. Sans atlas : rien ici,
   * les cercles prennent le relais.
   */
  private renderEnemySprites(ctx: CanvasRenderingContext2D, alpha: number): void {
    const sprites = this.deps.sprites;
    if (!sprites) return;
    const px = this.player.renderX(alpha);
    const items = this.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active) continue;
      const look = enemySprite(e.type.id);
      if (!look) continue;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      const r = e.type.radius;
      const moving = e.vx * e.vx + e.vy * e.vy > ENEMY_IDLE_SPEED * ENEMY_IDLE_SPEED;
      const anim = sprites.animation(moving ? look.run : look.idle);
      // Décalage par ennemi : sinon toute la horde pose le pied au même moment.
      const frame = frameAt(anim, this.elapsed + e.id * ENEMY_ANIM_OFFSET, look.frameTime);
      if (!frame) continue;
      // Le sprite dépasse la hitbox vers le haut : marge de sa hauteur pour ne pas le couper au bord.
      if (!this.isOnScreen(x, y, r + frame.h * look.scale)) continue;
      // Tournés vers le joueur (et non selon leur vitesse, qui change de signe dans la mêlée).
      const mirrored = x > px;
      sprites.draw(ctx, frame, x, y + r, look.scale, mirrored, look.tint);
      if (e.flashUntil > this.elapsed) {
        // Flash par-dessus, à demi transparent : on voit encore le monstre sous le blanc.
        ctx.globalAlpha = ENEMY_FLASH_ALPHA;
        sprites.draw(ctx, frame, x, y + r, look.scale, mirrored, HIT_FLASH_TINT);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Haut de l'ennemi à l'écran : haut de son sprite s'il en a un, sinon haut de sa hitbox. */
  private enemyTop(e: Enemy, y: number): number {
    const look = this.deps.sprites ? enemySprite(e.type.id) : undefined;
    const frame = look && this.deps.sprites?.animation(look.run)[0];
    return look && frame ? y + e.type.radius - frame.h * look.scale : y - e.type.radius;
  }

  /** Ne dessine que les lignes visibles : la grille paraît infinie sans rien coûter. */
  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const cam = this.camera;
    if (this.floorTiles) {
      // Sol en dalles : un motif répété, un seul fillRect. Le motif suit le repère monde
      // (translation de la caméra), donc le sol défile avec le joueur.
      this.floorPattern ??= ctx.createPattern(this.floorTiles, 'repeat');
      if (this.floorPattern) {
        ctx.fillStyle = this.floorPattern;
        ctx.fillRect(cam.left, cam.top, cam.right - cam.left, cam.bottom - cam.top);
        return;
      }
    }
    const startX = Math.floor(cam.left / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(cam.top / GRID_SIZE) * GRID_SIZE;

    // Un seul chemin pour toutes les lignes = un seul appel de dessin (stroke).
    ctx.beginPath();
    for (let x = startX; x <= cam.right; x += GRID_SIZE) {
      ctx.moveTo(x, cam.top);
      ctx.lineTo(x, cam.bottom);
    }
    for (let y = startY; y <= cam.bottom; y += GRID_SIZE) {
      ctx.moveTo(cam.left, y);
      ctx.lineTo(cam.right, y);
    }
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
