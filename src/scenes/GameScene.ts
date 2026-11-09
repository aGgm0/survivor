import { Camera } from '../core/Camera';
import type { DebugOverlay } from '../core/DebugOverlay';
import type { Input } from '../core/Input';
import { Rng } from '../core/math';
import { Pool } from '../core/Pool';
import type { Scene } from '../core/Scene';
import { CONTACT_HIT_COOLDOWN } from '../data/combat';
import { CONTROLS } from '../data/controls';
import { ENEMY_TYPE_LIST } from '../data/enemies';
import { UPGRADE_CHOICE_COUNT } from '../data/progression';
import { ENEMY_POOL_SIZE, SPAWN } from '../data/spawn';
import { PROJECTILE_POOL_SIZE, WEAPON_LIST, WEAPONS } from '../data/weapons';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Weapon } from '../entities/Weapon';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DamageNumberSystem } from '../systems/DamageNumberSystem';
import { GemSystem } from '../systems/GemSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { XpSystem } from '../systems/XpSystem';
import {
  applyUpgrade,
  availableUpgrades,
  rollUpgradeChoices,
  type Build,
  type UpgradeChoice,
} from '../systems/upgrades';
import type { DeathOverlay } from '../ui/DeathOverlay';
import type { Hud } from '../ui/Hud';
import type { LevelUpOverlay } from '../ui/LevelUpOverlay';
import type { PauseOverlay } from '../ui/PauseOverlay';

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
const ENEMY_HIT_FLASH = 0.1;
const ENEMY_FLASH_COLOR = '#ffffff';
/** Constante quelconque pour dériver la seed de l'aléatoire visuel de celle du jeu. */
const VISUAL_SEED_SALT = 0x9e3779b9;

/**
 * Ce dont la scène a besoin. Les `Pick` ne demandent que les méthodes utilisées :
 * les tests peuvent fournir de faux objets sans navigateur.
 */
export interface GameSceneDeps {
  input: Pick<Input, 'isDown' | 'wasPressed'>;
  pauseOverlay: Pick<PauseOverlay, 'setVisible'>;
  deathOverlay: Pick<DeathOverlay, 'show' | 'hide'>;
  levelUpOverlay: Pick<LevelUpOverlay, 'show' | 'hide' | 'takeClick'>;
  hud: Pick<Hud, 'setTime' | 'setProgress'>;
  debug: Pick<DebugOverlay, 'setStat' | 'showHitboxes'>;
  /** Appelé quand le joueur demande à rejouer : main.ts crée une scène neuve. */
  onRestart: () => void;
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
  readonly weapons: Weapon[] = [new Weapon(WEAPONS.arcaneBolt)];
  readonly projectiles = new Pool(PROJECTILE_POOL_SIZE, () => new Projectile());
  private readonly weaponSystem: WeaponSystem;
  private readonly projectileSystem: ProjectileSystem;
  readonly damageNumbers: DamageNumberSystem;
  readonly gems = new GemSystem();
  readonly progression = new XpSystem();
  /** Niveau de chaque passif possédé (absent = 0) */
  readonly passiveLevels = new Map<string, number>();
  /** Level up gagnés mais pas encore choisis (plusieurs d'un coup avec une grosse gemme) */
  private pendingLevelUps = 0;
  /** Choix affichés à l'écran ; null = pas de level up en cours */
  private choices: UpgradeChoice[] | null = null;
  private paused = false;
  private dead = false;
  /** secondes de survie (n'avance pas pendant la pause) */
  private elapsed = 0;
  private killCount = 0;

  constructor(
    private readonly deps: GameSceneDeps,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.spawner = new SpawnSystem(this.enemies, this.rng);
    this.weaponSystem = new WeaponSystem(ENEMY_POOL_SIZE, this.collisions, this.projectiles);
    this.damageNumbers = new DamageNumberSystem(new Rng(seed ^ VISUAL_SEED_SALT));
    this.projectileSystem = new ProjectileSystem(ENEMY_POOL_SIZE, this.collisions, {
      onHit: (e, damage) => this.onEnemyHit(e, damage),
      onKill: (e) => this.killEnemy(e),
    });
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
    this.setPaused(false);
    this.deps.deathOverlay.hide();
    this.deps.levelUpOverlay.hide();
    // Afficher la seed permet de rejouer exactement la même partie pour reproduire un bug.
    this.deps.debug.setStat('seed', this.rng.seed);
  }

  exit(): void {
    this.setPaused(false);
    this.deps.deathOverlay.hide();
    this.deps.levelUpOverlay.hide();
  }

  /** Onglet caché : on met en pause, pour ne pas reprendre en pleine horde au retour. */
  onHidden(): void {
    // Mort ou en plein choix d'upgrade : le jeu est déjà figé, pas besoin de pause.
    if (!this.dead && !this.choices) this.setPaused(true);
  }

  get isDead(): boolean {
    return this.dead;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  update(dt: number): void {
    const { input } = this.deps;

    if (this.dead) {
      this.freeze();
      if (input.wasPressed(CONTROLS.restart)) this.deps.onRestart();
      return;
    }

    if (this.choices) {
      // Écran de level up : le jeu est figé, on attend un choix (clic ou 1-2-3).
      this.freeze();
      const index = this.readChoiceInput();
      if (index !== null) this.chooseUpgrade(index);
      return;
    }

    if (input.wasPressed(CONTROLS.pause)) this.setPaused(!this.paused);
    if (this.paused) {
      this.freeze();
      return;
    }

    this.elapsed += dt;

    const axisX = Number(input.isDown(CONTROLS.right)) - Number(input.isDown(CONTROLS.left));
    const axisY = Number(input.isDown(CONTROLS.down)) - Number(input.isDown(CONTROLS.up));
    this.player.update(dt, axisX, axisY);

    if (input.wasPressed(CONTROLS.debugSpawn)) {
      this.spawner.spawnBatch(SPAWN.debugBatch, this.player.x, this.player.y);
    }
    this.spawner.update(dt, this.player.x, this.player.y);
    this.collisions.rebuild(this.enemies);
    this.movement.update(this.enemies, this.player.x, this.player.y, dt);
    this.touchingCount = this.collisions.pushOutOfPlayer(this.enemies, this.player, this.touching);
    this.applyContactDamage();
    if (this.dead) return;

    this.weaponSystem.update(dt, this.weapons, this.player.x, this.player.y);
    this.projectileSystem.update(dt, this.projectiles);
    this.pendingLevelUps += this.progression.addXp(this.gems.update(dt, this.player));
    this.damageNumbers.update(dt);
    if (this.pendingLevelUps > 0) this.openLevelUp();
  }

  /** Tire 3 choix (avec l'aléatoire du jeu : même seed → mêmes choix) et les affiche. */
  private openLevelUp(): void {
    this.choices = rollUpgradeChoices(availableUpgrades(this), this.rng, UPGRADE_CHOICE_COUNT);
    // Niveau atteint par CE level up (s'il en reste plusieurs à choisir, on les montre dans l'ordre).
    const level = this.progression.level - this.pendingLevelUps + 1;
    this.deps.levelUpOverlay.show(level, this.choices);
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
    applyUpgrade(choice, this);
    this.recomputeWeapons();
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
  private onEnemyHit(e: Enemy, damage: number): void {
    e.flashUntil = this.elapsed + ENEMY_HIT_FLASH;
    this.damageNumbers.spawn(e.x, e.y - e.type.radius, damage);
  }

  /** Un ennemi tombe à 0 PV : il lâche sa gemme d'XP et retourne au pool. */
  private killEnemy(e: Enemy): void {
    this.gems.drop(e.x, e.y, e.type.xp, this.player.x, this.player.y);
    this.enemies.release(e);
    this.killCount++;
  }

  /**
   * Chaque ennemi au contact frappe, puis doit attendre CONTACT_HIT_COOLDOWN avant de
   * pouvoir refrapper. Les délais sont indépendants : 10 ennemis au contact = 10 coups.
   * On compare à `elapsed` (temps de partie) : rien à décompter sur chaque ennemi.
   */
  private applyContactDamage(): void {
    for (let i = 0; i < this.touchingCount; i++) {
      const e = this.touching[i];
      if (!e || this.elapsed < e.nextContactHitAt) continue;
      this.player.takeHit(e.type.contactDamage);
      e.nextContactHitAt = this.elapsed + CONTACT_HIT_COOLDOWN;
      if (this.player.isDead) break;
    }
    if (this.player.isDead) this.die();
  }

  private die(): void {
    this.dead = true;
    this.setPaused(false);
    this.deps.deathOverlay.show(this.elapsed, this.killCount);
  }

  /** Plus rien ne bouge : sans ça, l'interpolation ferait osciller les entités sur place. */
  private freeze(): void {
    this.player.syncPrevious();
    for (const e of this.enemies.items) e.syncPrevious();
    for (const p of this.projectiles.items) {
      p.prevX = p.x;
      p.prevY = p.y;
    }
    this.damageNumbers.freeze();
    this.gems.freeze();
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    // La caméra est un réglage d'affichage, pas de l'état de jeu : la placer ici
    // sur la position interpolée évite que le joueur "tremble" par rapport au décor.
    this.camera.lookAt(this.player.renderX(alpha), this.player.renderY(alpha));

    this.camera.begin(ctx);
    this.renderGrid(ctx);
    // Les gemmes sont au sol : dessinées sous les ennemis.
    this.gems.render(ctx, alpha, this.camera);
    this.renderEnemies(ctx, alpha);
    this.player.render(ctx, alpha);
    this.renderProjectiles(ctx, alpha);
    this.damageNumbers.render(ctx, alpha, this.camera);
    if (this.deps.debug.showHitboxes) this.renderHitboxes(ctx, alpha);
    this.camera.end(ctx);

    this.deps.hud.setTime(this.elapsed);
    this.deps.hud.setProgress(this.progression.level, this.progression.progress);
    this.deps.debug.setStat('gemmes', this.gems.gems.activeCount);
    this.deps.debug.setStat('ennemis', this.enemies.activeCount);
    this.deps.debug.setStat('contacts', this.touchingCount);
    this.deps.debug.setStat('projectiles', this.projectiles.activeCount);
    this.deps.debug.setStat('kills', this.killCount);
  }

  /** Projectiles groupés par arme (une couleur = un chemin) : un halo, puis le cœur. */
  private renderProjectiles(ctx: CanvasRenderingContext2D, alpha: number): void {
    const items = this.projectiles.items;
    for (const def of WEAPON_LIST) {
      for (const pass of PROJECTILE_PASSES) {
        ctx.beginPath();
        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          if (!p?.active || p.source?.def !== def) continue;
          const x = p.renderX(alpha);
          const y = p.renderY(alpha);
          const r = p.radius * pass;
          if (!this.isOnScreen(x, y, r)) continue;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.globalAlpha = pass === 1 ? 1 : PROJECTILE_GLOW_ALPHA;
        ctx.fillStyle = def.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
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

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.deps.pauseOverlay.setVisible(paused);
  }

  /**
   * Dessin groupé par type : un seul chemin + un seul `fill()` par couleur,
   * au lieu d'un `fill()` par ennemi. Les ennemis hors écran sont ignorés.
   * Les ennemis qui viennent d'être touchés sont dessinés à part, en blanc.
   */
  private renderEnemies(ctx: CanvasRenderingContext2D, alpha: number): void {
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

  /** Ne dessine que les lignes visibles : la grille paraît infinie sans rien coûter. */
  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const cam = this.camera;
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
