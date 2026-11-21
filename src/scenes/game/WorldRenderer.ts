// Dessin du monde de la partie (sol, ennemis, armes, effets). Sorti de GameScene : la scène
// garde les règles, ce fichier ne fait que lire l'état et dessiner (voir CLAUDE.md § 4).

import type { Camera } from '../../core/Camera';
import type { EffectSheet } from '../../core/EffectSheet';
import { clamp, lerp, Rng } from '../../core/math';
import type { Pool } from '../../core/Pool';
import {
  frameAt,
  type SpriteAnimation,
  type SpriteAtlas,
  type SpriteTint,
} from '../../core/SpriteAtlas';
import { ENEMY_TYPE_LIST } from '../../data/enemies';
import {
  AURA_LOOKS,
  AURA_PULSE,
  AURA_PULSE_RING,
  CHARGE_TELEGRAPH,
  HP_BARS,
  SUMMON_TELEGRAPH,
  type AuraLook,
} from '../../data/feel';
import {
  BOLT_SPRITE,
  ENEMY_ANIM_OFFSET,
  ENEMY_IDLE_SPEED,
  enemySprite,
  HIT_FLASH_TINT,
  ORB_SPRITE,
  type EffectName,
} from '../../data/sprites';
import { BOSS_ABILITIES, BOSS_TYPE } from '../../data/waves';
import type { Enemy } from '../../entities/Enemy';
import type { Player } from '../../entities/Player';
import type { Projectile } from '../../entities/Projectile';
import type { Weapon } from '../../entities/Weapon';
import { drawHpBar, hpBarHeight, type HpBarSkin } from './hpBar';
import { chargeDistance } from '../../systems/BossAbilitySystem';
import type { DamageNumberSystem } from '../../systems/DamageNumberSystem';
import type { EffectsSystem } from '../../systems/EffectsSystem';
import type { GemSystem } from '../../systems/GemSystem';
import type { ParticleSystem } from '../../systems/ParticleSystem';
import type { PickupSystem } from '../../systems/PickupSystem';
import { WeaponSystem } from '../../systems/WeaponSystem';
import { buildFloor } from '../floor';

/** px entre deux lignes de la grille de fond */
const GRID_SIZE = 64;
const GRID_COLOR = '#2c2c3d';
const HITBOX_COLOR = '#00e5ff';

/** Halo autour des projectiles : taille (× rayon) et opacité */
const PROJECTILE_GLOW_SCALE = 2;
const PROJECTILE_GLOW_ALPHA = 0.3;

/** Deux passes de dessin (halo puis cœur), définies une fois pour ne rien allouer par frame. */
const PROJECTILE_PASSES = [PROJECTILE_GLOW_SCALE, 1] as const;

/** Opacité du flash sur les sprites */
const ENEMY_FLASH_ALPHA = 0.65;
const ENEMY_FLASH_COLOR = '#ffffff';

/** Constante quelconque pour dériver la seed du tirage des dalles du sol de celle du jeu. */
const FLOOR_SEED_SALT = 0x85ebca6b;

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
} as const;

/**
 * Ce que le rendu lit dans la partie : rien d'autre ne lui est accessible. Les pools ont encore
 * leurs méthodes (acquire, release) : la règle « render() ne modifie rien » reste à respecter.
 */
export interface WorldView {
  readonly player: Player;
  readonly camera: Camera;
  readonly enemies: Pool<Enemy>;
  readonly weapons: readonly Weapon[];
  readonly projectiles: Pool<Projectile>;
  readonly gems: GemSystem;
  readonly pickups: PickupSystem;
  readonly particles: ParticleSystem;
  readonly effects: EffectsSystem;
  readonly damageNumbers: DamageNumberSystem;
  /** Temps de partie (s) : animations, clignotements */
  readonly runTime: number;
}

/** Ressources graphiques (absentes dans les tests ou avant chargement : formes simples). */
export interface WorldRendererDeps {
  readonly sprites: SpriteAtlas | null;
  readonly fx: SpriteAtlas | null;
  readonly effects: Readonly<Record<EffectName, EffectSheet>> | null;
  /** Cadre et remplissage des barres de PV (pack Dark Ages) ; null : rectangles */
  readonly hpBars: HpBarSkin | null;
  /** Lu à chaque frame : l'overlay F3 peut l'allumer en cours de partie */
  readonly showHitboxes: () => boolean;
}

export class WorldRenderer {
  /** Image du sol (dalles tirées au hasard), préparée une fois ; null = pas de sprites, grille */
  private readonly floorTiles: HTMLCanvasElement | null;
  /** Motif répété tiré de `floorTiles`, créé au premier rendu (il faut le contexte du canvas) */
  private floorPattern: CanvasPattern | null = null;

  constructor(
    private readonly world: WorldView,
    private readonly deps: WorldRendererDeps,
    seed: number,
  ) {
    this.floorTiles = deps.sprites
      ? buildFloor(deps.sprites, new Rng(seed ^ FLOOR_SEED_SALT))
      : null;
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    // La caméra est un réglage d'affichage, pas de l'état de jeu : la placer ici
    // sur la position interpolée évite que le joueur "tremble" par rapport au décor.
    this.world.camera.lookAt(this.world.player.renderX(alpha), this.world.player.renderY(alpha));

    this.world.camera.begin(ctx);
    this.renderGrid(ctx);
    // Les gemmes sont au sol : dessinées sous les ennemis.
    this.world.gems.render(ctx, alpha, this.world.camera, this.deps.fx);
    this.world.pickups.render(ctx, alpha, this.world.camera, this.deps.sprites, this.world.runTime);
    this.renderAuras(ctx, alpha); // au sol, sous les ennemis
    this.renderBossTelegraphs(ctx, alpha); // au sol aussi : la zone à éviter
    this.renderEnemies(ctx, alpha);
    this.world.particles.render(ctx, alpha, this.world.camera); // éclats par-dessus les corps, sous le joueur
    this.renderEliteRings(ctx, alpha);
    this.renderEliteBars(ctx, alpha);
    this.world.player.render(ctx, alpha, this.deps.sprites);
    this.renderPlayerBar(ctx, alpha);
    this.renderOrbs(ctx, alpha);
    this.renderProjectiles(ctx, alpha);
    this.world.effects.render(ctx, this.world.camera);
    this.world.damageNumbers.render(ctx, alpha, this.world.camera);
    if (this.deps.showHitboxes()) this.renderHitboxes(ctx, alpha);
    this.world.camera.end(ctx);
  }

  /** Barre de PV au-dessus des mini-boss : on suit leur combat au milieu de la horde. */
  private renderEliteBars(ctx: CanvasRenderingContext2D, alpha: number): void {
    const skin = this.deps.hpBars;
    const items = this.world.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      // Pas le boss : sa barre est en haut de l'écran (HUD), une seule barre suffit.
      if (!e?.active || !e.type.elite) continue;
      const look = HP_BARS.elite;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      // Au-dessus de la tête (le sprite dépasse la hitbox vers le haut).
      const barY = this.enemyTop(e, y) - look.offset - hpBarHeight(skin, look.scale);
      if (!this.isOnScreen(x, y, Math.max(y - barY, look.width / 2))) continue;
      drawHpBar(ctx, skin, x, barY, look.width, look.scale, e.hp / e.maxHp, e.hpTrail / e.maxHp);
    }
  }

  /** Petite barre sous le joueur, seulement s'il a perdu des PV (le HUD donne le chiffre exact). */
  private renderPlayerBar(ctx: CanvasRenderingContext2D, alpha: number): void {
    const p = this.world.player;
    if (p.hpTrail >= p.maxHp && p.hp >= p.maxHp) return;
    const look = HP_BARS.player;
    const y = p.renderY(alpha) + p.radius + look.offset;
    drawHpBar(
      ctx,
      this.deps.hpBars,
      p.renderX(alpha),
      y,
      look.width,
      look.scale,
      p.hp / p.maxHp,
      p.hpTrail / p.maxHp,
    );
  }

  /** Anneau doré qui pulse autour des mini-boss : on les repère au milieu de la horde. */
  private renderEliteRings(ctx: CanvasRenderingContext2D, alpha: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.world.runTime * ELITE_LOOK.pulseSpeed);
    ctx.strokeStyle = ELITE_LOOK.ringColor;
    ctx.lineWidth = ELITE_LOOK.ringWidth;
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.beginPath();
    for (const e of this.world.enemies.items) {
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
   * Annonces des capacités de boss : chevrons pixel sur la trajectoire de la charge, anneau de
   * braises violettes pour l'invocation. Lisibles même en pleine horde : c'est ce qui permet
   * d'esquiver.
   */
  private renderBossTelegraphs(ctx: CanvasRenderingContext2D, alpha: number): void {
    const summon = BOSS_ABILITIES.summon;
    const now = this.world.runTime;
    for (const e of this.world.enemies.items) {
      if (!e.active || e.type !== BOSS_TYPE) continue;
      const x = e.renderX(alpha);
      const y = e.renderY(alpha);
      if (e.chargeState === 'windup') {
        const windup = e.chargeWindup || BOSS_ABILITIES.charge.windup;
        const progress = clamp(1 - (e.chargeUntil - now) / windup, 0, 1);
        this.renderChargeTelegraph(ctx, e, x, y, progress);
      }
      if (e.summonAt > 0) {
        const progress = clamp(1 - (e.summonAt - now) / summon.cast, 0, 1);
        const t = SUMMON_TELEGRAPH;
        const r = summon.radius * lerp(t.startScale, 1, progress) + e.type.radius;
        this.renderEmbers(ctx, x, y, r, t.look, lerp(t.startAlpha, 1, progress));
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Charge annoncée : bande légère, bords en pointillés, chevrons qui s'allument du boss vers le
   * bout (`progress` de 0 à 1) et clignotent de plus en plus vite, fissure au point d'arrivée.
   * Pixels calés sur une grille de 2 px, jamais tournés : même rendu que les sprites ×2.
   */
  private renderChargeTelegraph(
    ctx: CanvasRenderingContext2D,
    e: Enemy,
    x: number,
    y: number,
    progress: number,
  ): void {
    const t = CHARGE_TELEGRAPH;
    const length = chargeDistance(e);
    const dx = e.chargeDirX;
    const dy = e.chargeDirY;
    // Perpendiculaire à la trajectoire (vers la gauche de la charge)
    const nx = -dy;
    const ny = dx;
    const half = e.type.radius;
    const p = t.pixel;

    // Bande très légère : la zone touchée
    ctx.globalAlpha = t.fillAlpha;
    ctx.fillStyle = t.colors[1];
    ctx.beginPath();
    ctx.moveTo(x + nx * half, y + ny * half);
    ctx.lineTo(x + nx * half + dx * length, y + ny * half + dy * length);
    ctx.lineTo(x - nx * half + dx * length, y - ny * half + dy * length);
    ctx.lineTo(x - nx * half, y - ny * half);
    ctx.fill();

    // Bords en pointillés
    ctx.globalAlpha = t.edgeAlpha;
    const edges = Math.floor(length / t.edgeSpacing);
    for (let k = 0; k <= edges; k++) {
      const along = k * t.edgeSpacing;
      const cx = x + dx * along;
      const cy = y + dy * along;
      pixelAt(ctx, cx + nx * half, cy + ny * half, p);
      pixelAt(ctx, cx - nx * half, cy - ny * half, p);
    }

    // Chevrons : allumés jusqu'à `progress`, ils clignotent ; les autres restent sombres.
    const blinkHz = lerp(t.blinkStart, t.blinkEnd, progress);
    const blinkOn = Math.sin(this.world.runTime * blinkHz * Math.PI * 2) > -0.3;
    const arm = Math.max(2, Math.round((half * t.chevronArm) / p));
    const count = Math.max(1, Math.floor((length - half) / t.chevronSpacing));
    for (let pass = 0; pass < 2; pass++) {
      const lit = pass === 1;
      if (lit && !blinkOn) continue;
      ctx.globalAlpha = lit ? 1 : 0.6;
      ctx.fillStyle = lit ? t.colors[0] : t.colors[2];
      for (let k = 1; k <= count; k++) {
        if (k / count <= progress !== lit) continue;
        const along = half + k * t.chevronSpacing;
        // Pointe du chevron, puis les deux branches qui reculent en s'écartant
        for (let j = 0; j <= arm; j++) {
          const back = along - j * p;
          const side = j * p * 1.2;
          pixelAt(ctx, x + dx * back + nx * side, y + dy * back + ny * side, p);
          if (j > 0) pixelAt(ctx, x + dx * back - nx * side, y + dy * back - ny * side, p);
        }
      }
    }

    // Fissure au point d'arrivée, de plus en plus visible
    const endX = x + dx * length;
    const endY = y + dy * length;
    ctx.globalAlpha = 0.4 + 0.6 * progress;
    ctx.fillStyle = t.colors[2];
    for (let k = 0; k + 1 < t.crack.length; k += 2) {
      pixelAt(ctx, endX + (t.crack[k] ?? 0) * p, endY + (t.crack[k + 1] ?? 0) * p, p);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Auras : disque très léger (pour voir la zone) et anneau de braises carrées posé sur le bord,
   * qui tourne et scintille (voir AURA_LOOKS). Rien n'est modifié ici : tout dépend du temps.
   */
  private renderAuras(ctx: CanvasRenderingContext2D, alpha: number): void {
    const px = this.world.player.renderX(alpha);
    const py = this.world.player.renderY(alpha);
    for (const w of this.world.weapons) {
      if (w.def.kind !== 'aura') continue;
      const look = AURA_LOOKS[w.mutation?.id ?? w.def.id];
      // Onde de feu (Fournaise) : rien de permanent autour du joueur, seulement l'onde
      // (retour de jeu : l'anneau constant ne servait à rien, c'est l'onde qui touche).
      const pulse = w.mutation?.pulse;
      const sincePulse = this.world.runTime - w.lastPulseAt;
      if (!pulse) {
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
      // Le front de l'onde : un anneau de braises vives qui part du joueur jusqu'à la portée
      // de l'onde (là où elle touche vraiment), puis s'éteint.
      if (pulse && sincePulse >= 0 && sincePulse < pulse.travel + AURA_PULSE.fade) {
        const reach = w.radius * pulse.reachMult;
        const r = Math.max(8, reach * Math.min(1, sincePulse / pulse.travel));
        const opacity =
          sincePulse <= pulse.travel ? 1 : 1 - (sincePulse - pulse.travel) / AURA_PULSE.fade;
        this.renderEmbers(ctx, px, py, r, AURA_PULSE_RING, opacity);
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
    opacity = 1,
  ): void {
    const count = Math.max(24, Math.round((Math.PI * 2 * radius) / look.emberSpacing));
    const t = this.world.runTime;
    const spin = t * look.spin;
    const size = look.emberSize;
    // Trait sombre continu sous les braises : l'anneau reste lisible entre deux scintillements.
    ctx.beginPath();
    ctx.arc(cx, cy, radius - size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = look.colors[2];
    ctx.lineWidth = 1;
    ctx.globalAlpha = EMBER_RING_ALPHA * opacity;
    ctx.stroke();
    ctx.globalAlpha = opacity;
    for (let shade = 0; shade < 3; shade++) {
      ctx.fillStyle = look.colors[shade] ?? look.colors[1];
      for (let k = 0; k < count; k++) {
        // Scintillement de 0 à 1, décalé d'une braise à l'autre.
        const flicker = 0.5 + 0.5 * Math.sin(t * EMBER_FLICKER_SPEED + k * 2.3);
        const kShade = flicker > 0.66 ? 0 : flicker > 0.33 ? 1 : 2;
        if (kShade !== shade) continue;
        const a = spin + (k / count) * Math.PI * 2;
        // Une braise sur deux rentrée de `emberInset` (0 : un seul rang, anneau fin).
        const r = radius - (k % 2) * look.emberInset;
        // Positions calées sur une grille de 2 px : des pixels nets, comme les sprites ×2.
        const x = Math.round((cx + Math.cos(a) * r - size / 2) / 2) * 2;
        const y = Math.round((cy + Math.sin(a) * r - size / 2) / 2) * 2;
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Orbes autour du joueur, à leur angle interpolé (rotation fluide à 144/240 Hz). */
  private renderOrbs(ctx: CanvasRenderingContext2D, alpha: number): void {
    const px = this.world.player.renderX(alpha);
    const py = this.world.player.renderY(alpha);
    for (const w of this.world.weapons) {
      if (w.def.kind !== 'orbit') continue;
      const angle = lerp(w.prevAngle, w.angle, alpha);
      const fx = this.deps.fx;
      const frame =
        fx && frameAt(fx.animation(ORB_SPRITE.anim), this.world.runTime, ORB_SPRITE.frameTime);
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
    const items = this.world.projectiles.items;
    for (const weapon of this.world.weapons) {
      // Projectiles du Trait : halo rond, puis sprite orienté.
      if (weapon.def.kind !== 'projectile') continue;
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
    const items = this.world.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p?.active || p.source !== weapon) continue;
      const x = p.renderX(alpha);
      const y = p.renderY(alpha);
      const scale = (p.radius * 2) / BOLT_SPRITE.headDiameter;
      if (!this.isOnScreen(x, y, BOLT_SPRITE.headCenterX * scale)) continue;
      const frame = frameAt(
        bolt,
        this.world.runTime + i * ENEMY_ANIM_OFFSET,
        BOLT_SPRITE.frameTime,
      );
      if (!frame) continue;
      const angle = Math.atan2(p.vy, p.vx);
      fx.drawRotated(ctx, frame, x, y, scale, angle, BOLT_SPRITE.headCenterX, tint);
    }
  }

  private isOnScreen(x: number, y: number, r: number): boolean {
    const cam = this.world.camera;
    return x + r >= cam.left && x - r <= cam.right && y + r >= cam.top && y - r <= cam.bottom;
  }

  /** Debug (F3) : contour des hitboxes, pour vérifier visuellement les collisions. */
  private renderHitboxes(ctx: CanvasRenderingContext2D, alpha: number): void {
    const items = this.world.enemies.items;
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
    const px = this.world.player.renderX(alpha);
    const py = this.world.player.renderY(alpha);
    ctx.moveTo(px + this.world.player.radius, py);
    ctx.arc(px, py, this.world.player.radius, 0, Math.PI * 2);
    ctx.strokeStyle = HITBOX_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
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
    const items = this.world.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active || (type && e.type !== type)) continue;
      if (this.deps.sprites && enemySprite(e.type.id)) continue; // déjà dessiné en sprite
      if (e.flashUntil > this.world.runTime !== flashing) continue;
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
    const px = this.world.player.renderX(alpha);
    const items = this.world.enemies.items;
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
      const frame = frameAt(anim, this.world.runTime + e.id * ENEMY_ANIM_OFFSET, look.frameTime);
      if (!frame) continue;
      // Le sprite dépasse la hitbox vers le haut : marge de sa hauteur pour ne pas le couper au bord.
      if (!this.isOnScreen(x, y, r + frame.h * look.scale)) continue;
      // Tournés vers le joueur (et non selon leur vitesse, qui change de signe dans la mêlée).
      const mirrored = x > px;
      sprites.draw(ctx, frame, x, y + r, look.scale, mirrored, look.tint);
      if (e.flashUntil > this.world.runTime) {
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
    const cam = this.world.camera;
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

/** Un pixel d'annonce centré sur (x, y), calé sur la grille de 2 px. */
function pixelAt(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillRect(Math.round((x - size / 2) / 2) * 2, Math.round((y - size / 2) / 2) * 2, size, size);
}
