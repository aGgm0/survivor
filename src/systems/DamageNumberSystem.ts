import type { Camera } from '../core/Camera';
import { lerp, type Rng } from '../core/math';
import { Pool } from '../core/Pool';
import { DamageNumber } from '../entities/DamageNumber';
import { formatNumber } from '../ui/formatNumber';

// Réglages purement visuels (aucun effet sur le jeu).
const POOL_SIZE = 300;
/** s avant de disparaître */
const LIFETIME = 0.6;
/** px/s vers le haut */
const RISE_SPEED = 50;
/** px : décalage horizontal aléatoire, pour que des nombres simultanés ne se superposent pas */
const JITTER_X = 10;
/** Police pixel de l'interface (chargée par style.css) ; monospace tant qu'elle n'est pas prête */
const FONT = '16px DungeonMode, monospace';
const COLOR = '#ffffff';
const OUTLINE = '#000000';

/**
 * Cache des textes "1", "2"... : convertir un nombre en texte crée une nouvelle chaîne à chaque
 * fois. Les dégâts sont des petits entiers qui reviennent sans cesse : on garde chaque texte.
 */
const textCache: string[] = [];
function damageText(value: number): string {
  const n = Math.round(value);
  return (textCache[n] ??= formatNumber(n));
}

/** Nombres de dégâts flottants : apparition, montée, fondu, rendu. */
export class DamageNumberSystem {
  readonly numbers = new Pool(POOL_SIZE, () => new DamageNumber());

  /**
   * @param rng générateur DÉDIÉ à l'affichage : utiliser celui du jeu décalerait sa séquence,
   * et une même seed ne donnerait plus la même partie selon les effets visuels.
   */
  constructor(private readonly rng: Rng) {}

  spawn(x: number, y: number, value: number, color: string = COLOR): void {
    // Réserve pleine : on saute ce nombre. C'est du visuel, rien n'est perdu.
    const n = this.numbers.acquire();
    if (!n) return;
    n.show(x + this.rng.range(-JITTER_X, JITTER_X), y, damageText(value), color);
  }

  update(dt: number): void {
    const items = this.numbers.items;
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      if (!n?.active) continue;
      n.prevY = n.y;
      n.y -= RISE_SPEED * dt;
      n.age += dt;
      if (n.age >= LIFETIME) this.numbers.release(n);
    }
  }

  /** Fige les nombres (pause, mort) : sans ça l'interpolation les ferait trembler. */
  freeze(): void {
    for (const n of this.numbers.items) n.prevY = n.y;
  }

  /** À appeler entre `camera.begin` et `camera.end` (coordonnées monde). */
  render(ctx: CanvasRenderingContext2D, alpha: number, camera: Camera): void {
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = COLOR;
    const items = this.numbers.items;
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      if (!n?.active) continue;
      const y = lerp(n.prevY, n.y, alpha);
      if (n.x < camera.left || n.x > camera.right || y < camera.top || y > camera.bottom) continue;
      // Fondu sur la seconde moitié de la vie.
      ctx.globalAlpha = Math.min(1, 2 * (1 - n.age / LIFETIME));
      // Contour noir d'abord : le nombre reste lisible sur n'importe quelle couleur d'ennemi.
      ctx.strokeText(n.text, n.x, y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, y);
    }
    ctx.globalAlpha = 1;
  }
}
