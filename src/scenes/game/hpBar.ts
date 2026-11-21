// Dessin d'une barre de PV du monde (boss, élites, joueur) : cadre et remplissage du pack Dark
// Ages, ou rectangles simples si le pack manque. Ne lit et ne modifie aucun état de jeu.

import { HP_BARS } from '../../data/feel';

/** Images du pack : cadre `bar-body` (86 × 9) et remplissage `bar-red` (82 × 4). */
export interface HpBarSkin {
  readonly frame: HTMLImageElement;
  readonly fill: HTMLImageElement;
}

/** Bords du cadre `bar-body` (px du pack) : comme le `border-image` 3 4 de la barre du HUD */
const SIDE = 4;
const TOP = 3;

/** Hauteur à l'écran d'une barre (px), pour la placer au-dessus ou sous une entité. */
export function hpBarHeight(skin: HpBarSkin | null, scale: number): number {
  return skin ? skin.frame.naturalHeight * scale : HP_BARS.fallback.height;
}

/**
 * `ratio` : PV / PV max ; `trailRatio` : traînée / PV max (≥ ratio). Le cadre est découpé en
 * 3 morceaux : bouts à taille fixe, milieu étiré, pour garder des pixels nets quelle que soit la largeur.
 */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  skin: HpBarSkin | null,
  centerX: number,
  topY: number,
  width: number,
  scale: number,
  ratio: number,
  trailRatio: number,
): void {
  const x = Math.round(centerX - width / 2);
  const y = Math.round(topY);
  const hp = clampRatio(ratio);
  const trail = clampRatio(trailRatio);
  if (!skin) {
    const f = HP_BARS.fallback;
    ctx.fillStyle = f.outline;
    ctx.fillRect(x - 1, y - 1, width + 2, f.height + 2);
    ctx.fillStyle = f.background;
    ctx.fillRect(x, y, width, f.height);
    ctx.fillStyle = HP_BARS.trail.color;
    ctx.fillRect(x, y, Math.round(width * trail), f.height);
    ctx.fillStyle = f.fill;
    ctx.fillRect(x, y, Math.round(width * hp), f.height);
    return;
  }
  const { frame, fill } = skin;
  const fw = frame.naturalWidth;
  const fh = frame.naturalHeight;
  const side = SIDE * scale;
  const height = fh * scale;
  ctx.drawImage(frame, 0, 0, SIDE, fh, x, y, side, height);
  ctx.drawImage(frame, SIDE, 0, fw - 2 * SIDE, fh, x + side, y, width - 2 * side, height);
  ctx.drawImage(frame, fw - SIDE, 0, SIDE, fh, x + width - side, y, side, height);
  // Intérieur : traînée claire, puis le rouge du pack (coupé, pas écrasé, quand les PV baissent).
  const innerX = x + side;
  const innerY = y + TOP * scale;
  const innerW = width - 2 * side;
  const innerH = (fh - 2 * TOP) * scale;
  ctx.fillStyle = HP_BARS.trail.color;
  ctx.fillRect(innerX, innerY, Math.round(innerW * trail), innerH);
  const shown = Math.round(innerW * hp);
  if (shown > 0) {
    ctx.drawImage(
      fill,
      0,
      0,
      Math.max(1, fill.naturalWidth * hp),
      fill.naturalHeight,
      innerX,
      innerY,
      shown,
      innerH,
    );
  }
}

function clampRatio(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
