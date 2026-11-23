import type { Camera } from '../core/Camera';
import { Pool, type Poolable } from '../core/Pool';
import { clipFrameIndex, type EffectSheet } from '../core/EffectSheet';
import {
  EXPLOSION_FX,
  ONE_SHOT_FX,
  SLASH_FX,
  type EffectName,
  type OneShotName,
} from '../data/sprites';
import type { SpriteAtlas, SpriteFrame } from '../core/SpriteAtlas';

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

/**
 * Coup d'estoc (retour de jeu : la première traînée « ne ressemblait pas à un coup d'arme »).
 * L'épée du pack se fend vers la cible puis revient ; un trait d'énergie fin file de sa pointe
 * jusqu'au bout de la portée (la zone qui touche). Réglages purement visuels.
 */
const THRUST = {
  /** s : durée totale du coup */
  lifetime: 0.26,
  /** Part de la durée pour la fente (le reste : retour et effacement) */
  lunge: 0.35,
  /** px : centre de l'épée au repos, puis distance gagnée par la fente */
  restDistance: 20,
  lungeDistance: 46,
  /** Sprite du pack (vertical, pointe en haut) et son agrandissement */
  sprite: 'weapon_knight_sword',
  scale: 2,
  /** Trait d'énergie : pixels de 4 px, un tous les 6 px, cœur blanc et un rang de chaque côté */
  pixel: 4,
  step: 6,
  coreColor: '#ffffff',
} as const;
/** Les deux bords du trait (défini une fois : rien d'alloué par frame) */
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

/** Un effet du pack joué une fois (coup, explosion, foudre), à la taille demandée. */
class OneShot implements Poolable {
  active = false;
  name: OneShotName = 'clang';
  x = 0;
  y = 0;
  /** px : largeur visible voulue */
  size = 0;
  age = 0;
  /** s : durée de l'animation à sa vitesse de lecture */
  lifetime = 0;
  /** radians : sens de l'effet (les effets du pack regardent vers la droite) */
  angle = 0;
}

/** Animations du pack utilisées ici (absentes : formes simples). */
export type EffectSprites = Readonly<Record<EffectName, EffectSheet>>;

/** Effets visuels éphémères (explosions, coups d'épée). En pool : aucune allocation en jeu. */
export class EffectsSystem {
  private readonly rings = new Pool(POOL_SIZE, () => new Ring());
  private readonly slashes = new Pool(POOL_SIZE, () => new Slash());
  private readonly thrusts = new Pool(POOL_SIZE, () => new Thrust());
  private readonly oneShots = new Pool(POOL_SIZE, () => new OneShot());
  private readonly ringLifetime: number;
  private readonly slashLifetime: number;

  /** Épée de l'estoc (atlas des persos et ennemis) ; absente : trait d'énergie seul. */
  private readonly thrustSword: SpriteFrame | null;

  /** Avec les sprites, les effets durent le temps de leur animation (purement visuel). */
  constructor(
    private readonly sprites: EffectSprites | null = null,
    private readonly atlas: SpriteAtlas | null = null,
  ) {
    this.thrustSword = atlas?.animation(THRUST.sprite)[0] ?? null;
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

  /**
   * Joue l'effet `name` du pack en (x, y), sa largeur visible = `size` px. Sans le pack, ou la
   * réserve pleine : rien (purement visuel).
   */
  play(name: OneShotName, x: number, y: number, size: number, angle = 0): void {
    const sheet = this.sprites?.[name];
    if (!sheet) return;
    const o = this.oneShots.acquire();
    if (!o) return;
    o.name = name;
    o.x = x;
    o.y = y;
    o.size = size;
    o.age = 0;
    o.lifetime = sheet.clip.totalMs / 1000 / ONE_SHOT_FX[name].speed;
    o.angle = angle;
  }

  get activeCount(): number {
    return (
      this.rings.activeCount +
      this.slashes.activeCount +
      this.thrusts.activeCount +
      this.oneShots.activeCount
    );
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
      if (t.age >= THRUST.lifetime) this.thrusts.release(t);
    }
    for (const o of this.oneShots.items) {
      if (!o.active) continue;
      o.age += dt;
      if (o.age >= o.lifetime) this.oneShots.release(o);
    }
  }

  /** À appeler entre `camera.begin` et `camera.end` (coordonnées monde). */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Estoc : épée de l'atlas + trait d'énergie dessiné par le code (pas d'effet d'estoc dans PVFX).
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
   * Coup d'estoc : le trait d'énergie (cœur blanc, bords à la couleur de l'arme, pixels nets) file
   * jusqu'au bout de la portée pendant la fente, puis s'efface ; l'épée se fend et revient.
   */
  private renderThrusts(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const half = THRUST.pixel / 2;
    for (const t of this.thrusts.items) {
      if (!t.active) continue;
      if (t.x + t.range < camera.left || t.x - t.range > camera.right) continue;
      if (t.y + t.range < camera.top || t.y - t.range > camera.bottom) continue;
      const progress = t.age / THRUST.lifetime;
      const lunging = progress < THRUST.lunge;
      // Fente rapide qui ralentit au bout (ease-out), puis retour.
      const k = lunging
        ? 1 - (1 - progress / THRUST.lunge) ** 2
        : 1 - (progress - THRUST.lunge) / (1 - THRUST.lunge);
      const fade = lunging ? 1 : k;
      const fx = Math.cos(t.angle);
      const fy = Math.sin(t.angle);
      const center = THRUST.restDistance + THRUST.lungeDistance * k;
      const swordTip = center + ((this.thrustSword?.h ?? 0) * THRUST.scale) / 2;

      // Trait d'énergie : de la pointe de l'épée jusqu'au front (qui atteint la portée à la fin
      // de la fente).
      const front = t.range * Math.min(1, progress / THRUST.lunge);
      ctx.globalAlpha = 0.85 * fade;
      for (let d = swordTip; d <= front; d += THRUST.step) {
        const cx = t.x + fx * d;
        const cy = t.y + fy * d;
        ctx.fillStyle = THRUST.coreColor;
        ctx.fillRect(Math.round(cx - half), Math.round(cy - half), THRUST.pixel, THRUST.pixel);
        ctx.fillStyle = t.color;
        for (const side of SIDES) {
          ctx.fillRect(
            Math.round(cx - fy * THRUST.pixel * side - half),
            Math.round(cy + fx * THRUST.pixel * side - half),
            THRUST.pixel,
            THRUST.pixel,
          );
        }
      }
      ctx.globalAlpha = fade;
      // L'épée, pointe vers la cible (sprite vertical : +90°), teinte de l'arme par-dessus.
      if (this.atlas && this.thrustSword) {
        this.atlas.drawRotated(
          ctx,
          this.thrustSword,
          t.x + fx * center,
          t.y + fy * center,
          THRUST.scale,
          t.angle + Math.PI / 2,
          this.thrustSword.w / 2,
        );
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
    // Effets joués une fois : pivot du pack (pied de la flamme, sol sous la foudre) posé sur le
    // point visé ; largeur visible = la taille demandée.
    for (const o of this.oneShots.items) {
      if (!o.active) continue;
      if (o.x + o.size < camera.left || o.x - o.size > camera.right) continue;
      if (o.y + o.size * 2 < camera.top || o.y - o.size * 2 > camera.bottom) continue;
      const sheet = sprites[o.name];
      const [x0, , x1] = sheet.clip.bounds;
      const scale = o.size / (x1 - x0);
      sheet.draw(ctx, progressFrame(sheet, o.age / o.lifetime), o.x, o.y, scale, o.angle);
    }
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
