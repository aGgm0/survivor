// Anneau de braises carrées (auras, onde de la Fournaise, invocation du boss). Dessin seul.

import type { AuraLook } from '../../data/feel';

/** rad/s du scintillement des braises */
const EMBER_FLICKER_SPEED = 6;

/** Opacité du trait sombre sous les braises */
const EMBER_RING_ALPHA = 0.6;

/**
 * Braises le long du cercle : leur nombre suit la circonférence (l'anneau garde le même aspect
 * quand le rayon grandit). Chacune scintille à son rythme et prend la couleur claire, moyenne
 * ou sombre selon sa luminosité. Un passage par couleur : 3 changements de fillStyle seulement.
 * `time` : temps de partie (s), qui fait tourner et scintiller l'anneau.
 */
export function drawEmberRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  look: AuraLook,
  time: number,
  opacity = 1,
): void {
  const count = Math.max(24, Math.round((Math.PI * 2 * radius) / look.emberSpacing));
  const spin = time * look.spin;
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
      const flicker = 0.5 + 0.5 * Math.sin(time * EMBER_FLICKER_SPEED + k * 2.3);
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
