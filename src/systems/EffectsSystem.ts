import type { Camera } from '../core/Camera';
import { Pool, type Poolable } from '../core/Pool';
import { clipFrameIndex, type EffectSheet } from '../core/EffectSheet';
import { EXPLOSION_FX, SLASH_FX } from '../data/sprites';

// Réglages purement visuels (aucun effet sur le jeu).
const POOL_SIZE = 64;
/** s : durée de l'anneau d'explosion */
const RING_LIFETIME = 0.25;
/** L'anneau part de cette fraction du rayon et grandit jusqu'au rayon complet */
const RING_START = 0.4;
const RING_WIDTH = 3;
/** s : durée de l'arc d'un coup d'épée */
const SLASH_LIFETIME = 0.15;
/** Opacité de départ de l'arc (il s'efface ensuite) */
const SLASH_ALPHA = 0.45;

/** s : durée de la traînée d'un coup d'estoc */
const THRUST_LIFETIME = 0.22;
/** La traînée atteint le bout de la portée en cette part de sa durée, puis s'efface */
const THRUST_REACH = 0.35;
/** px : taille des pixels de la traînée (comme les braises de l'aura) et pas entre deux rangées */
const THRUST_PIXEL = 4;
const THRUST_STEP = 8;
const THRUST_CORE_COLOR = '#ffffff';
/** Les deux bords du cône (défini une fois : rien d'alloué par frame) */
const SIDES = [-1, 1] as const;

/** Un anneau d'explosion qui s'agrandit et s'efface. */
class Ring implements Poolable {
  active = false;
  x = 0;
  y = 0;
  radius = 0;
  age = 0;
  color = '';
}

/** Un coup d'épée : une part de disque (direction, ouverture, portée) qui s'efface. */
class Slash implements Poolable {
  active = false;
  x = 0;
  y = 0;
  angle = 0;
  arc = 0;
  range = 0;
  age = 0;
  color = '';
}

/** Un coup d'estoc : un cône étroit de pixels qui file jusqu'au bout de la portée. */
class Thrust implements Poolable {
  active = false;
  x = 0;
  y = 0;
  angle = 0;
  arc = 0;
  range = 0;
  age = 0;
  color = '';
}

/** Animations du pack utilisées ici (absentes : formes simples). */
export interface EffectSprites {
  readonly burst: EffectSheet;
  readonly slash: EffectSheet;
}

/** Effets visuels éphémères (explosions, coups d'épée). En pool : aucune allocation en jeu. */
export class EffectsSystem {
  private readonly rings = new Pool(POOL_SIZE, () => new Ring());
  private readonly slashes = new Pool(POOL_SIZE, () => new Slash());
  private readonly thrusts = new Pool(POOL_SIZE, () => new Thrust());
  private readonly ringLifetime: number;
  private readonly slashLifetime: number;

  /** Avec les sprites, les effets durent le temps de leur animation (purement visuel). */
  constructor(private readonly sprites: EffectSprites | null = null) {
    this.ringLifetime = sprites ? EXPLOSION_FX.duration : RING_LIFETIME;
    this.slashLifetime = sprites ? SLASH_FX.duration : SLASH_LIFETIME;
  }

  /** Réserve pleine : l'effet est sauté (purement visuel, rien n'est perdu). */
  explosion(x: number, y: number, radius: number, color: string): void {
    const ring = this.rings.acquire();
    if (!ring) return;
    ring.x = x;
    ring.y = y;
    ring.radius = radius;
    ring.age = 0;
    ring.color = color;
  }

  slash(x: number, y: number, angle: number, arc: number, range: number, color: string): void {
    const s = this.slashes.acquire();
    if (!s) return;
    s.x = x;
    s.y = y;
    s.angle = angle;
    s.arc = arc;
    s.range = range;
    s.age = 0;
    s.color = color;
  }

  thrust(x: number, y: number, angle: number, arc: number, range: number, color: string): void {
    const t = this.thrusts.acquire();
    if (!t) return;
    t.x = x;
    t.y = y;
    t.angle = angle;
    t.arc = arc;
    t.range = range;
    t.age = 0;
    t.color = color;
  }

  get activeCount(): number {
    return this.rings.activeCount + this.slashes.activeCount + this.thrusts.activeCount;
  }

  update(dt: number): void {
    for (const ring of this.rings.items) {
      if (!ring.active) continue;
      ring.age += dt;
      if (ring.age >= this.ringLifetime) this.rings.release(ring);
    }
    for (const s of this.slashes.items) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= this.slashLifetime) this.slashes.release(s);
    }
    for (const t of this.thrusts.items) {
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= THRUST_LIFETIME) this.thrusts.release(t);
    }
  }

  /** À appeler entre `camera.begin` et `camera.end` (coordonnées monde). */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Estoc : dessiné en pixels par le code, avec ou sans le pack (pas d'effet d'estoc dedans).
    this.renderThrusts(ctx, camera);
    if (this.sprites) {
      this.renderSprites(ctx, camera, this.sprites);
      return;
    }
    ctx.lineWidth = RING_WIDTH;
    for (const ring of this.rings.items) {
      if (!ring.active) continue;
      if (ring.x + ring.radius < camera.left || ring.x - ring.radius > camera.right) continue;
      if (ring.y + ring.radius < camera.top || ring.y - ring.radius > camera.bottom) continue;
      const t = ring.age / RING_LIFETIME; // 0 → 1
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = ring.color;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius * (RING_START + (1 - RING_START) * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const s of this.slashes.items) {
      if (!s.active) continue;
      ctx.globalAlpha = SLASH_ALPHA * (1 - s.age / SLASH_LIFETIME);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, s.range, s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Traînée d'estoc : des rangées de pixels carrés le long de la ligne, de plus en plus larges
   * (le cône qui touche). Le front file jusqu'au bout de la portée, puis tout s'efface. Le cœur
   * est blanc, les bords à la couleur de l'arme. Positions arrondies : pixels nets.
   */
  private renderThrusts(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const half = THRUST_PIXEL / 2;
    for (const t of this.thrusts.items) {
      if (!t.active) continue;
      if (t.x + t.range < camera.left || t.x - t.range > camera.right) continue;
      if (t.y + t.range < camera.top || t.y - t.range > camera.bottom) continue;
      const progress = t.age / THRUST_LIFETIME;
      const front = t.range * Math.min(1, progress / THRUST_REACH);
      const fade = progress < THRUST_REACH ? 1 : 1 - (progress - THRUST_REACH) / (1 - THRUST_REACH);
      const fx = Math.cos(t.angle);
      const fy = Math.sin(t.angle);
      const halfTan = Math.tan(t.arc / 2);
      let row = 0;
      for (let d = THRUST_STEP; d <= front; d += THRUST_STEP, row++) {
        // Plus loin de la pointe (vers le joueur) : déjà en train de s'éteindre.
        ctx.globalAlpha = fade * (0.35 + 0.65 * (d / Math.max(front, 1)));
        const width = d * halfTan;
        const cx = t.x + fx * d;
        const cy = t.y + fy * d;
        // Cœur blanc sur toute la longueur, puis les bords en damier (un pixel sur deux, décalé
        // d'une rangée à l'autre) : une traînée pixel art, pas un faisceau plein.
        ctx.fillStyle = THRUST_CORE_COLOR;
        ctx.fillRect(Math.round(cx - half), Math.round(cy - half), THRUST_PIXEL, THRUST_PIXEL);
        ctx.fillStyle = t.color;
        const offset = row % 2 === 0 ? THRUST_PIXEL * 2 : THRUST_PIXEL * 3;
        for (let s = offset; s <= width; s += THRUST_PIXEL * 2) {
          for (const side of SIDES) {
            ctx.fillRect(
              Math.round(cx - fy * s * side - half),
              Math.round(cy + fx * s * side - half),
              THRUST_PIXEL,
              THRUST_PIXEL,
            );
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Explosions et coups d'épée animés. L'animation entière est jouée pendant la durée de vie de
   * l'effet, et sa taille suit celle du gameplay (rayon de l'explosion, portée de l'épée).
   */
  private renderSprites(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    sprites: EffectSprites,
  ): void {
    const burst = sprites.burst;
    const [bx0, , bx1] = burst.clip.bounds;
    for (const ring of this.rings.items) {
      if (!ring.active) continue;
      if (ring.x + ring.radius < camera.left || ring.x - ring.radius > camera.right) continue;
      if (ring.y + ring.radius < camera.top || ring.y - ring.radius > camera.bottom) continue;
      const index = progressFrame(burst, ring.age / this.ringLifetime);
      burst.draw(ctx, index, ring.x, ring.y, (ring.radius * 2) / (bx1 - bx0));
    }
    const slash = sprites.slash;
    for (const s of this.slashes.items) {
      if (!s.active) continue;
      const index = progressFrame(slash, s.age / this.slashLifetime);
      const scale = s.range / SLASH_FX.artRadius;
      // Tourbillon : un tour complet, donc plusieurs coups répartis tout autour.
      const full = s.arc >= Math.PI * 2 - 0.01;
      const copies = full ? SLASH_FX.fullCircleCopies : 1;
      // Le dessin est découpé à la zone qui frappe (part de disque : ouverture et portée) : on ne
      // voit jamais la lame là où elle ne touche pas. Le sprite balaie plus large que l'arc.
      ctx.save();
      ctx.beginPath();
      if (!full) {
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, s.range, s.angle - s.arc / 2, s.angle + s.arc / 2);
        ctx.closePath();
      } else {
        ctx.arc(s.x, s.y, s.range, 0, Math.PI * 2);
      }
      ctx.clip();
      for (let k = 0; k < copies; k++) {
        slash.draw(ctx, index, s.x, s.y, scale, s.angle + (k * Math.PI * 2) / copies);
      }
      ctx.restore();
    }
  }
}

/** Image d'un effet joué une fois, à `progress` (0 → 1) de sa durée. */
function progressFrame(sheet: EffectSheet, progress: number): number {
  return clipFrameIndex(sheet.clip, Math.min(progress, 0.999) * sheet.clip.totalMs);
}
