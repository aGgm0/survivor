/** Rectangle d'un sprite dans l'image de l'atlas (px). */
export interface SpriteFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Une animation = ses images dans l'ordre (une seule pour un sprite fixe). */
export type SpriteAnimation = readonly SpriteFrame[];

/** Une image de l'atlas et sa version miroir (pour les sprites tournés vers la gauche). */
interface Sheet {
  readonly normal: CanvasImageSource;
  readonly mirrored: CanvasImageSource;
}

const FRAME_SUFFIX = /^(.+)_f(\d+)$/;

/**
 * Lit la liste des sprites d'un atlas : une ligne par sprite, `nom x y largeur hauteur`.
 * Les lignes vides ou mal formées sont ignorées (le fichier vient d'un pack externe).
 */
export function parseTileList(text: string): Map<string, SpriteFrame> {
  const frames = new Map<string, SpriteFrame>();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [name, ...rest] = parts;
    const [x, y, w, h] = rest.slice(0, 4).map(Number);
    if (!name || !isPixel(x) || !isPixel(y) || !isPixel(w) || !isPixel(h) || w === 0 || h === 0) {
      continue;
    }
    frames.set(name, { x, y, w, h });
  }
  return frames;
}

function isPixel(n: number | undefined): n is number {
  return n !== undefined && Number.isInteger(n) && n >= 0;
}

/**
 * Regroupe les images numérotées (`imp_run_anim_f0`, `_f1`...) en animations nommées
 * `imp_run_anim`, triées par numéro. Un sprite sans numéro devient une animation d'une image.
 */
export function groupAnimations(
  frames: ReadonlyMap<string, SpriteFrame>,
): Map<string, SpriteFrame[]> {
  const numbered = new Map<string, { index: number; frame: SpriteFrame }[]>();
  const anims = new Map<string, SpriteFrame[]>();
  for (const [name, frame] of frames) {
    const match = FRAME_SUFFIX.exec(name);
    if (!match?.[1] || match[2] === undefined) {
      anims.set(name, [frame]);
      continue;
    }
    const list = numbered.get(match[1]) ?? [];
    list.push({ index: Number(match[2]), frame });
    numbered.set(match[1], list);
  }
  for (const [base, list] of numbered) {
    list.sort((a, b) => a.index - b.index);
    anims.set(
      base,
      list.map((f) => f.frame),
    );
  }
  return anims;
}

/** Image de l'animation à afficher au temps `time` (s), chaque image durant `frameTime` s. */
export function frameAt(
  anim: SpriteAnimation,
  time: number,
  frameTime: number,
): SpriteFrame | undefined {
  if (anim.length === 0) return undefined;
  const index = Math.floor(time / frameTime) % anim.length;
  return anim[index < 0 ? index + anim.length : index];
}

/**
 * Animations de deux atlas réunis, le second posé sous le premier (ses rectangles descendent de
 * `dy`). En cas de nom en double, celui du second gagne.
 */
export function stackAnimations(
  first: ReadonlyMap<string, SpriteAnimation>,
  second: ReadonlyMap<string, SpriteAnimation>,
  dy: number,
): Map<string, SpriteAnimation> {
  const anims = new Map(first);
  for (const [name, anim] of second)
    anims.set(
      name,
      anim.map((f) => ({ ...f, y: f.y + dy })),
    );
  return anims;
}

/** Abscisse d'un sprite dans l'atlas retourné horizontalement (le miroir inverse les x). */
export function mirroredX(frame: SpriteFrame, atlasWidth: number): number {
  return atlasWidth - frame.x - frame.w;
}

/**
 * Atlas de sprites : une seule grande image qui contient tous les sprites, et la liste de leurs
 * rectangles. Dessiner un sprite = copier son rectangle (`drawImage`), ce qui reste rapide même
 * pour des centaines d'ennemis.
 *
 * Les versions miroir et teintées (flash blanc, élites) sont préparées une seule fois, à la
 * demande, puis gardées : teinter ou retourner chaque sprite à chaque frame coûterait cher.
 */
export class SpriteAtlas {
  /** Copies teintées, retrouvées par l'objet `SpriteTint` lui-même (constantes : rien n'est alloué). */
  private readonly tints = new Map<SpriteTint, Sheet>();
  private readonly base: Sheet;

  private constructor(
    private readonly image: HTMLImageElement | HTMLCanvasElement,
    private readonly anims: ReadonlyMap<string, SpriteAnimation>,
  ) {
    this.base = { normal: image, mirrored: mirror(image) };
  }

  /** Charge l'image et la liste des sprites. Rejette si l'un des deux manque. */
  static async load(imageUrl: string, listUrl: string): Promise<SpriteAtlas> {
    const image = new Image();
    image.src = imageUrl;
    const [, response] = await Promise.all([image.decode(), fetch(listUrl)]);
    if (!response.ok) throw new Error(`Liste de sprites introuvable : ${listUrl}`);
    const frames = parseTileList(await response.text());
    return new SpriteAtlas(image, groupAnimations(frames));
  }

  /**
   * Un seul atlas fait de deux : l'image de `extra` est collée sous celle de `base`. Sert aux
   * monstres faits maison (tools/sprites/) : le rendu reste le même, une seule image à dessiner.
   */
  static stack(base: SpriteAtlas, extra: SpriteAtlas): SpriteAtlas {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(base.image.width, extra.image.width);
    canvas.height = base.image.height + extra.image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non supporté');
    ctx.drawImage(base.image, 0, 0);
    ctx.drawImage(extra.image, 0, base.image.height);
    return new SpriteAtlas(canvas, stackAnimations(base.anims, extra.anims, base.image.height));
  }

  /** Animation par son nom (sans `_fN`). Vide si elle n'existe pas : rien ne sera dessiné. */
  animation(name: string): SpriteAnimation {
    return this.anims.get(name) ?? [];
  }

  /**
   * Dessine `frame` agrandi `scale` fois, centré horizontalement sur `centerX`, le bas posé sur
   * `bottomY`. `mirrored` = tourné vers la gauche (les sprites du pack regardent à droite).
   * `tint` : teinte à appliquer (flash d'un coup reçu, élites). Toujours une constante, jamais un
   * objet créé à l'appel : c'est elle qui sert de clé à la copie teintée.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    frame: SpriteFrame,
    centerX: number,
    bottomY: number,
    scale: number,
    mirrored: boolean,
    tint?: SpriteTint,
  ): void {
    const sheet = tint ? this.tinted(tint) : this.base;
    const w = frame.w * scale;
    const h = frame.h * scale;
    // Positions entières : sinon le navigateur étale les pixels sur deux colonnes (flou).
    const dx = Math.round(centerX - w / 2);
    const dy = Math.round(bottomY - h);
    const sx = mirrored ? mirroredX(frame, this.image.width) : frame.x;
    ctx.drawImage(
      mirrored ? sheet.mirrored : sheet.normal,
      sx,
      frame.y,
      frame.w,
      frame.h,
      dx,
      dy,
      w,
      h,
    );
  }

  /**
   * Dessine `frame` agrandi `scale` fois et tourné de `angle` (radians) autour du point
   * (`pivotX`, milieu de la hauteur) du sprite, posé en (`x`, `y`). Pour les projectiles : le
   * sprite regarde vers la droite, la rotation l'oriente dans le sens du tir.
   */
  drawRotated(
    ctx: CanvasRenderingContext2D,
    frame: SpriteFrame,
    x: number,
    y: number,
    scale: number,
    angle: number,
    pivotX: number,
    tint?: SpriteTint,
  ): void {
    const sheet = tint ? this.tinted(tint) : this.base;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(
      sheet.normal,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -pivotX * scale,
      (-frame.h * scale) / 2,
      frame.w * scale,
      frame.h * scale,
    );
    ctx.restore();
  }

  /**
   * Assemble une grille de sprites fixes (`grid[ligne][colonne]` = nom) sur une image, agrandie
   * `scale` fois, puis assombrie de `darken` (0 à 1). Sert à préparer une fois un motif de sol.
   */
  buildTiles(
    grid: readonly (readonly string[])[],
    scale: number,
    darken: number,
  ): HTMLCanvasElement {
    const first = this.animation(grid[0]?.[0] ?? '')[0];
    const tile = (first?.w ?? 16) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = (grid[0]?.length ?? 0) * tile;
    canvas.height = grid.length * tile;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non supporté');
    ctx.imageSmoothingEnabled = false;
    grid.forEach((row, r) =>
      row.forEach((name, c) => {
        const frame = this.animation(name)[0];
        if (frame) this.draw(ctx, frame, c * tile + tile / 2, (r + 1) * tile, scale, false);
      }),
    );
    ctx.fillStyle = `rgba(0, 0, 0, ${darken})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  private tinted(spriteTint: SpriteTint): Sheet {
    let sheet = this.tints.get(spriteTint);
    if (!sheet) {
      const normal = tint(this.image, spriteTint);
      sheet = { normal, mirrored: mirror(normal) };
      this.tints.set(spriteTint, sheet);
    }
    return sheet;
  }
}

/**
 * Teinte d'un sprite. `silhouette` : tout le sprite prend la couleur (flash). `multiply` : la
 * couleur se mélange au sprite, dont on garde les détails (comme un filtre coloré).
 */
export interface SpriteTint {
  readonly color: string;
  readonly mode: 'silhouette' | 'multiply';
}

function makeCanvas(source: HTMLImageElement | HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non supporté');
  return { canvas, ctx };
}

/** Copie de l'image retournée horizontalement. */
function mirror(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(source);
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

/** Copie teintée de l'image (la transparence est gardée). */
function tint(
  source: HTMLImageElement | HTMLCanvasElement,
  spriteTint: SpriteTint,
): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(source);
  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = spriteTint.color;
  if (spriteTint.mode === 'silhouette') {
    // source-atop : on ne peint que là où l'image a déjà des pixels.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // multiply peint aussi le fond transparent : on redécoupe ensuite la forme de l'image.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(source, 0, 0);
  }
  return canvas;
}
