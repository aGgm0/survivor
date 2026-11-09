import { Camera } from '../core/Camera';
import type { DebugOverlay } from '../core/DebugOverlay';
import type { Input } from '../core/Input';
import { Rng } from '../core/math';
import { Pool } from '../core/Pool';
import type { Scene } from '../core/Scene';
import { CONTROLS } from '../data/controls';
import { ENEMY_TYPE_LIST } from '../data/enemies';
import { ENEMY_POOL_SIZE, SPAWN } from '../data/spawn';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { moveEnemiesTowards } from '../systems/MovementSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import type { Hud } from '../ui/Hud';
import type { PauseOverlay } from '../ui/PauseOverlay';

/** px entre deux lignes de la grille de fond */
const GRID_SIZE = 64;
const GRID_COLOR = '#2c2c3d';

export interface GameSceneDeps {
  input: Input;
  pauseOverlay: PauseOverlay;
  hud: Hud;
  debug: DebugOverlay;
}

/** La partie en cours. Map infinie : pas de bords, le joueur va où il veut. */
export class GameScene implements Scene {
  private readonly player = new Player();
  private readonly camera = new Camera();
  private readonly enemies = new Pool(ENEMY_POOL_SIZE, () => new Enemy());
  private readonly rng: Rng;
  private readonly spawner: SpawnSystem;
  private paused = false;
  /** secondes de survie (n'avance pas pendant la pause) */
  private elapsed = 0;

  constructor(
    private readonly deps: GameSceneDeps,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.spawner = new SpawnSystem(this.enemies, this.rng);
  }

  enter(): void {
    this.setPaused(false);
    // Afficher la seed permet de rejouer exactement la même partie pour reproduire un bug.
    this.deps.debug.setStat('seed', this.rng.seed);
  }

  exit(): void {
    this.setPaused(false);
  }

  update(dt: number): void {
    const { input } = this.deps;
    if (input.wasPressed(CONTROLS.pause)) this.setPaused(!this.paused);

    if (this.paused) {
      // Plus rien ne bouge : sans ça, l'interpolation ferait osciller les entités
      // entre leur ancienne et leur nouvelle position pendant toute la pause.
      this.player.syncPrevious();
      for (const e of this.enemies.items) e.syncPrevious();
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
    moveEnemiesTowards(this.enemies, this.player.x, this.player.y, dt);
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    // La caméra est un réglage d'affichage, pas de l'état de jeu : la placer ici
    // sur la position interpolée évite que le joueur "tremble" par rapport au décor.
    this.camera.lookAt(this.player.renderX(alpha), this.player.renderY(alpha));

    this.camera.begin(ctx);
    this.renderGrid(ctx);
    this.renderEnemies(ctx, alpha);
    this.player.render(ctx, alpha);
    this.camera.end(ctx);

    this.deps.hud.setTime(this.elapsed);
    this.deps.debug.setStat('ennemis', this.enemies.activeCount);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.deps.pauseOverlay.setVisible(paused);
  }

  /**
   * Dessin groupé par type : un seul chemin + un seul `fill()` par couleur,
   * au lieu d'un `fill()` par ennemi. Les ennemis hors écran sont ignorés.
   */
  private renderEnemies(ctx: CanvasRenderingContext2D, alpha: number): void {
    const cam = this.camera;
    const items = this.enemies.items;
    for (const type of ENEMY_TYPE_LIST) {
      const r = type.radius;
      ctx.beginPath();
      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        if (!e?.active || e.type !== type) continue;
        const x = e.renderX(alpha);
        const y = e.renderY(alpha);
        if (x + r < cam.left || x - r > cam.right || y + r < cam.top || y - r > cam.bottom)
          continue;
        // moveTo évite qu'un trait relie chaque cercle au précédent.
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = type.color;
      ctx.fill();
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
