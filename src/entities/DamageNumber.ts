import type { Poolable } from '../core/Pool';

/** Un nombre de dégâts qui monte et s'efface au-dessus d'un ennemi touché. Vit dans un Pool. */
export class DamageNumber implements Poolable {
  active = false;
  x = 0;
  y = 0;
  prevY = 0;
  /** s écoulées depuis l'apparition */
  age = 0;
  text = '';

  show(x: number, y: number, text: string): void {
    this.x = x;
    this.y = y;
    this.prevY = y;
    this.age = 0;
    this.text = text;
  }
}
