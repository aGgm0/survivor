import { lerp } from '../core/math';
import type { Poolable } from '../core/Pool';
import { ENEMY_TYPES, type EnemyType } from '../data/enemies';

/** Un ennemi. Les instances vivent dans un Pool : on ne les crée jamais en cours de partie. */
export class Enemy implements Poolable {
  active = false;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  /** Vitesse actuelle en px/s. Elle évolue progressivement (voir MovementSystem). */
  vx = 0;
  vy = 0;
  hp = 0;
  type: EnemyType = ENEMY_TYPES.basic;

  /**
   * @param id identifiant stable = place dans le pool. Sert de départage déterministe
   * (ex. ennemis superposés). Pas un compteur global : sinon une partie relancée avec la même
   * seed aurait d'autres ids, donc un autre déroulement.
   */
  constructor(readonly id: number = 0) {}

  /** Réinitialise TOUT l'état : un ennemi recyclé ne doit rien garder de sa vie précédente. */
  spawn(type: EnemyType, x: number, y: number): void {
    this.type = type;
    this.hp = type.hp;
    this.teleport(x, y);
  }

  /**
   * Déplace sans interpolation (sinon on le verrait "glisser" depuis l'ancienne position).
   * La vitesse repart de zéro : l'ancienne direction n'a plus de sens au nouvel endroit.
   */
  teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.syncPrevious();
  }

  /** Masse = rayon² (proportionnelle à la surface) : plus il est gros, plus il pousse. */
  get mass(): number {
    return this.type.radius * this.type.radius;
  }

  syncPrevious(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }

  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha);
  }
}
