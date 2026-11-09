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
  hp = 0;
  type: EnemyType = ENEMY_TYPES.basic;

  /** Réinitialise TOUT l'état : un ennemi recyclé ne doit rien garder de sa vie précédente. */
  spawn(type: EnemyType, x: number, y: number): void {
    this.type = type;
    this.hp = type.hp;
    this.teleport(x, y);
  }

  /** Déplace sans interpolation (sinon on le verrait "glisser" depuis l'ancienne position). */
  teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.syncPrevious();
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
