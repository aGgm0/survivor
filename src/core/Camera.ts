import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './Renderer';

/** Réglages du tremblement (les valeurs du jeu sont dans data/feel.ts). */
export interface ShakeSettings {
  /** Trauma perdu par seconde */
  readonly decay: number;
  /** px de décalage au trauma maximal */
  readonly maxOffset: number;
  /** Vitesse du tremblement (rad/s) */
  readonly frequency: number;
}

/** Trauma après un choc de `amount`, sans dépasser `cap` (ni 1) à cause de ce choc. */
export function addTrauma(trauma: number, amount: number, cap = 1): number {
  const limit = Math.min(1, cap);
  if (trauma >= limit) return trauma; // déjà au-dessus : ce choc n'enlève rien
  return Math.min(limit, trauma + amount);
}

/**
 * Caméra 2D. Les entités ont des coordonnées "monde" ; la caméra décale le dessin
 * pour que le point qu'elle regarde (x, y) apparaisse au centre de l'écran.
 */
export class Camera {
  /** Point du monde au centre de l'écran. */
  x = 0;
  y = 0;

  /** Bords du monde visibles à l'écran (pour ne dessiner que ce qui se voit). */
  get left(): number {
    return this.x - LOGICAL_WIDTH / 2;
  }
  get top(): number {
    return this.y - LOGICAL_HEIGHT / 2;
  }
  get right(): number {
    return this.x + LOGICAL_WIDTH / 2;
  }
  get bottom(): number {
    return this.y + LOGICAL_HEIGHT / 2;
  }

  lookAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  // ------------------------------------------------------------------ tremblement (screen shake)
  // « Trauma » entre 0 et 1 : chaque choc en ajoute, il redescend tout seul. Le tremblement vaut
  // trauma² : les petits chocs se sentent à peine, les gros secouent. Purement visuel : le
  // décalage n'est appliqué qu'au dessin (`begin`), jamais à la position de la caméra.

  /** 0 = calme, 1 = tremblement maximal */
  trauma = 0;
  /** Décalage de dessin en px, recalculé à chaque `updateShake` */
  shakeX = 0;
  shakeY = 0;

  /**
   * Ajoute un choc. `cap` : ce choc ne fait pas monter le trauma au-delà (un coup répété, comme
   * la horde au contact, ne doit pas secouer l'écran en continu).
   */
  addTrauma(amount: number, cap = 1): void {
    this.trauma = addTrauma(this.trauma, amount, cap);
  }

  /** Fait redescendre le trauma et calcule le décalage du dessin à l'instant `time` (s). */
  updateShake(dt: number, time: number, shake: ShakeSettings): void {
    this.trauma = Math.max(0, this.trauma - shake.decay * dt);
    const amount = this.trauma * this.trauma * shake.maxOffset;
    // Deux sinus de fréquences sans rapport simple : un tremblement irrégulier mais fluide.
    const t = time * shake.frequency;
    this.shakeX = amount * Math.sin(t * 1.3) * Math.cos(t * 0.7);
    this.shakeY = amount * Math.sin(t * 1.7 + 1) * Math.cos(t * 0.9);
  }

  /** Coupe net le tremblement (pause, level up, fin de partie, option désactivée). */
  resetShake(): void {
    this.trauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  /** À partir d'ici, on dessine en coordonnées monde. Toujours fermer avec `end()`. */
  begin(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(-this.left + this.shakeX, -this.top + this.shakeY);
  }

  /** Retour aux coordonnées écran (pour dessiner du texte fixe par-dessus, par exemple). */
  end(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
