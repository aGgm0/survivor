import { lerp } from '../core/math';
import type { Poolable } from '../core/Pool';
import type { ProjectileWeaponDef } from '../data/weapons';
import type { Enemy } from './Enemy';
import type { Weapon } from './Weapon';

/**
 * Nombre max d'ennemis qu'un projectile peut traverser (taille du tableau `hitEnemies`,
 * créé une fois avec le projectile : aucune allocation au tir).
 */
export const MAX_PIERCE = 8;

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
  /** Ennemis qu'il peut encore toucher avant de disparaître (1 = normal, plus = perforant) */
  pierceLeft = 1;
  /** Ennemis déjà touchés : un projectile perforant ne frappe jamais deux fois le même */
  readonly hitEnemies: (Enemy | null)[] = new Array<Enemy | null>(MAX_PIERCE).fill(null);
  hitCount = 0;

  /** Réinitialise TOUT l'état (un projectile recyclé ne garde rien de sa vie précédente). */
  launch(
    source: Weapon,
    def: ProjectileWeaponDef,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
  ): void {
    this.source = source;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    // Vitesse et taille actuelles de l'arme (passifs Vélocité et Taille compris).
    this.vx = dirX * source.projectileSpeed;
    this.vy = dirY * source.projectileSpeed;
    this.life = def.projectileLifetime;
    // Dégâts actuels de l'arme (niveau + mutation + passifs), pas ceux de base.
    this.damage = source.damage;
    this.radius = source.projectileRadius;
    this.color = source.color;
    this.pierceLeft = Math.min(MAX_PIERCE, source.mutation?.pierce ?? 1);
    this.hitCount = 0;
    this.hitEnemies.fill(null);
  }

  hasHit(enemy: Enemy): boolean {
    for (let i = 0; i < this.hitCount; i++) if (this.hitEnemies[i] === enemy) return true;
    return false;
  }

  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }

  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha);
  }
}
