import { lerp } from '../core/math';
import type { Poolable } from '../core/Pool';

/** Une gemme d'XP au sol. Vit dans un Pool : jamais créée en cours de partie. */
export class Gem implements Poolable {
  active = false;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  /** XP rapportée au ramassage */
  value = 0;
  /** Une fois attrapée par l'aimant, elle fonce vers le joueur jusqu'au ramassage. */
  attracted = false;
  /** px/s, vitesse actuelle quand elle est attirée */
  speed = 0;
  /** Gemme verte boostée (dessinée à part, quelle que soit sa valeur) */
  bonus = false;

  drop(x: number, y: number, value: number, bonus = false): void {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.value = value;
    this.bonus = bonus;
    this.attracted = false;
    this.speed = 0;
  }

  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }

  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha);
  }
}
