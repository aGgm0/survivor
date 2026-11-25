/** Rectangle (bords inclus à gauche/en haut, exclus à droite/en bas), en px d'art. */
export type Bounds = readonly [x0: number, y0: number, x1: number, y1: number];

export interface EffectFrame {
  /** Place de l'image dans la feuille */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly durationMs: number;
  /** Zone visible dans le cadre de l'effet ; null = image vide */
  readonly bounds: Bounds | null;
}

/** Animation d'un effet : toutes ses images partagent un cadre `width` × `height`. */
export interface EffectClip {
  readonly width: number;
  readonly height: number;
  /** Point d'ancrage dans le cadre (ex. le pied d'une flamme, le centre d'une explosion) */
  readonly pivotX: number;
  readonly pivotY: number;
  readonly loop: boolean;
  readonly frames: readonly EffectFrame[];
  readonly totalMs: number;
  /** Union des zones visibles de toutes les images : la vraie taille de l'effet */
  readonly bounds: Bounds;
}

/**
 * Lit le manifeste JSON d'un effet PVFX Foundry (format `pvfx.fx.export-manifest/1`). Le fichier
 * vient d'un pack externe : on vérifie chaque champ utile et on lève une erreur s'il manque.
 */
export function parseEffectManifest(json: unknown): EffectClip {
  const root = asRecord(json, 'manifeste');
  const [width, height] = numbers(root.source_size, 2, 'source_size');
  const [pivotX, pivotY] = numbers(root.pivot, 2, 'pivot');
  if (!Array.isArray(root.frames) || root.frames.length === 0) throw new Error('frames manquantes');
  const frames = root.frames.map((value: unknown, i): EffectFrame => {
    const f = asRecord(value, `frame ${i}`);
    const sheet = asRecord(f.sheet, `frame ${i}.sheet`);
    const duration = asRecord(f.duration, `frame ${i}.duration`);
    const [x, y, w, h] = numbers([sheet.x, sheet.y, sheet.width, sheet.height], 4, `frame ${i}`);
    const [ms, denominator] = numbers(
      [duration.numerator_ms, duration.denominator],
      2,
      `frame ${i}.duration`,
    );
    const bounds = f.visible_bounds === null ? null : toBounds(f.visible_bounds, `frame ${i}`);
    return { x, y, w, h, durationMs: ms / (denominator || 1), bounds };
  });
  const visible = frames.flatMap((f) => (f.bounds ? [f.bounds] : []));
  const bounds: Bounds =
    visible.length === 0
      ? [0, 0, width, height]
      : [
          Math.min(...visible.map((b) => b[0])),
          Math.min(...visible.map((b) => b[1])),
          Math.max(...visible.map((b) => b[2])),
          Math.max(...visible.map((b) => b[3])),
        ];
  return {
    width,
    height,
    pivotX,
    pivotY,
    loop: root.loop_mode === 'loop',
    frames,
    totalMs: frames.reduce((sum, f) => sum + f.durationMs, 0),
    bounds,
  };
}

/**
 * Image à afficher à `timeMs` depuis le début de l'effet, à vitesse `speed` (2 = deux fois plus
 * vite). En boucle : on recommence ; sinon on reste sur la dernière image.
 */
export function clipFrameIndex(clip: EffectClip, timeMs: number, speed = 1): number {
  let t = Math.max(0, timeMs * speed);
  if (clip.loop) t %= clip.totalMs;
  for (let i = 0; i < clip.frames.length; i++) {
    t -= clip.frames[i]?.durationMs ?? 0;
    if (t < 0) return i;
  }
  return clip.frames.length - 1;
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(`${what} invalide`);
  return value as Record<string, unknown>;
}

/**
 * Vérifie que `value` commence par `count` nombres (au plus 4). Renvoie toujours 4 cases : les
 * suivantes valent 0, ce qui permet de déstructurer sans valeurs « peut-être absentes ».
 */
function numbers(value: unknown, count: number, what: string): [number, number, number, number] {
  if (!Array.isArray(value) || value.length < count) throw new Error(`${what} invalide`);
  const list: unknown[] = value.slice(0, count);
  const out: [number, number, number, number] = [0, 0, 0, 0];
  list.forEach((n, i) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${what} invalide`);
    out[i] = n;
  });
  return out;
}

function toBounds(value: unknown, what: string): Bounds {
  return numbers(value, 4, what);
}

/** Où poser l'effet : son pivot, ou le centre de la zone visible de l'image en cours. */
export type EffectAnchor = 'pivot' | 'visibleCenter';

/** Un effet animé : sa feuille d'images et son manifeste. */
export class EffectSheet {
  private constructor(
    private readonly image: HTMLImageElement,
    readonly clip: EffectClip,
  ) {}

  /** `dir` contient `sprite-sheet.png` et `manifest.json` (export « grid » de PVFX). */
  static async load(dir: string): Promise<EffectSheet> {
    const image = new Image();
    image.src = `${dir}sprite-sheet.png`;
    const [, response] = await Promise.all([image.decode(), fetch(`${dir}manifest.json`)]);
    if (!response.ok) throw new Error(`Manifeste introuvable : ${dir}`);
    return new EffectSheet(image, parseEffectManifest(await response.json()));
  }

  /**
   * Dessine l'image `index` étirée d'un point à l'autre : le pivot de l'effet sur (x1, y1), le
   * bord droit de sa zone visible (toutes images confondues) sur (x2, y2). `thickness` :
   * agrandissement en travers. Pour les éclairs du pack, dessinés de gauche à droite.
   */
  drawStretched(
    ctx: CanvasRenderingContext2D,
    index: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
  ): void {
    const f = this.clip.frames[index];
    if (!f?.bounds) return;
    const reach = this.clip.bounds[2] - this.clip.pivotX || 1;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const sx = length / reach;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    ctx.drawImage(
      this.image,
      f.x,
      f.y,
      f.w,
      f.h,
      -this.clip.pivotX * sx,
      -this.clip.pivotY * thickness,
      f.w * sx,
      f.h * thickness,
    );
    ctx.restore();
  }

  /**
   * Dessine l'image `index` avec le centre de la zone visible de tout l'effet (toutes images
   * confondues) posé en (`x`, `y`), agrandie de `sx` en largeur et `sy` en hauteur. Pour un effet
   * qui grandit autour d'un point (anneau) : ce centre ne bouge pas d'une image à l'autre.
   */
  drawAroundCenter(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    sx: number,
    sy: number,
  ): void {
    const f = this.clip.frames[index];
    if (!f?.bounds) return;
    const [x0, y0, x1, y1] = this.clip.bounds;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    ctx.drawImage(this.image, f.x, f.y, f.w, f.h, x - cx * sx, y - cy * sy, f.w * sx, f.h * sy);
  }

  /**
   * Dessine l'image `index` agrandie `scale` fois et tournée de `angle` (radians), son ancre posée
   * en (`x`, `y`). Les effets du pack sont tournés vers la droite.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    scale: number,
    angle = 0,
    anchor: EffectAnchor = 'pivot',
  ): void {
    const f = this.clip.frames[index];
    if (!f?.bounds) return; // image vide
    let ax = this.clip.pivotX;
    let ay = this.clip.pivotY;
    if (anchor === 'visibleCenter') {
      ax = (f.bounds[0] + f.bounds[2]) / 2;
      ay = (f.bounds[1] + f.bounds[3]) / 2;
    }
    if (angle === 0) {
      ctx.drawImage(
        this.image,
        f.x,
        f.y,
        f.w,
        f.h,
        x - ax * scale,
        y - ay * scale,
        f.w * scale,
        f.h * scale,
      );
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(
      this.image,
      f.x,
      f.y,
      f.w,
      f.h,
      -ax * scale,
      -ay * scale,
      f.w * scale,
      f.h * scale,
    );
    ctx.restore();
  }
}
