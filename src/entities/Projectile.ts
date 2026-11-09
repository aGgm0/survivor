import { lerp } from '../core/math';
import type { Poolable } from '../core/Pool';
import type { Weapon } from './Weapon';

/** Un projectile. Vit dans un Pool : jamais créé en cours de partie. */
export class Projectile implements Poolable {
  active = false;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  /** s restantes avant de disparaître */
  life = 0;
  damage = 0;
  radius = 0;
  color = '';
  /** Arme qui l'a tiré : pour lui attribuer ses dégâts et ses kills. */
  source: Weapon | null = null;

  /** Réinitialise TOUT l'état (un projectile recyclé ne garde rien de sa vie précédente). */
  launch(source: Weapon, x: number, y: number, dirX: number, dirY: number): void {
    const def = source.def;
    this.source = source;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = dirX * def.projectileSpeed;
    this.vy = dirY * def.projectileSpeed;
    this.life = def.projectileLifetime;
    this.damage = def.damage;
    this.radius = def.projectileRadius;
    this.color = def.color;
  }

  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }

  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha);
  }
}
