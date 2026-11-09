import type { Pool } from '../core/Pool';
import { weaponRange, type OrbitWeaponDef, type ProjectileWeaponDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Weapon } from '../entities/Weapon';
import { MAX_ENEMY_RADIUS, type CollisionSystem } from './CollisionSystem';
import { damageEnemy, type HitEvents } from './damage';
import { GRID_STALENESS_MARGIN } from './ProjectileSystem';

/**
 * Fait agir chaque arme du joueur selon son type :
 * - projectile : tire vers l'ennemi le plus proche quand le cooldown est prêt ;
 * - aura : brûle chaque ennemi dès qu'il entre dans le cercle, puis à intervalle régulier ;
 * - orbite : fait tourner les orbes et blesse les ennemis qu'ils touchent.
 */
export class WeaponSystem {
  /** Résultats de requête réutilisés : pas d'allocation. */
  private readonly candidates: Enemy[];

  constructor(
    capacity: number,
    private readonly collisions: CollisionSystem,
    private readonly projectiles: Pool<Projectile>,
    private readonly events: HitEvents,
  ) {
    this.candidates = new Array<Enemy>(capacity);
  }

  /**
   * `collisions.rebuild()` doit avoir été appelé dans cette update (grille à jour).
   * `now` = temps de partie (s), pour les délais de re-touche des orbes.
   */
  update(dt: number, weapons: readonly Weapon[], fromX: number, fromY: number, now: number): void {
    for (const weapon of weapons) {
      const def = weapon.def;
      switch (def.kind) {
        case 'projectile':
          this.updateProjectile(weapon, def, dt, fromX, fromY);
          break;
        case 'aura':
          this.updateAura(weapon, fromX, fromY, now);
          break;
        case 'orbit':
          this.updateOrbit(weapon, def, dt, fromX, fromY, now);
          break;
      }
    }
  }

  /**
   * Ennemi actif le plus proche dans `range`, ou null.
   * La grille ne renvoie que les ennemis des cases autour : pas besoin de parcourir tout le pool.
   */
  findNearest(x: number, y: number, range: number): Enemy | null {
    const count = this.collisions.queryNeighbors(x, y, range, this.candidates);
    let best: Enemy | null = null;
    // On compare les distances AU CARRÉ : même classement, sans racine carrée.
    let bestDistSq = range * range;
    for (let i = 0; i < count; i++) {
      const e = this.candidates[i];
      if (!e?.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = e;
      }
    }
    return best;
  }

  /** Position (x ou y) de l'orbe n° `index` autour de (cx, cy) pour un angle donné. */
  static orbX(cx: number, angle: number, index: number, count: number, distance: number): number {
    return cx + Math.cos(angle + (index * Math.PI * 2) / count) * distance;
  }

  static orbY(cy: number, angle: number, index: number, count: number, distance: number): number {
    return cy + Math.sin(angle + (index * Math.PI * 2) / count) * distance;
  }

  private updateProjectile(
    weapon: Weapon,
    def: ProjectileWeaponDef,
    dt: number,
    x: number,
    y: number,
  ): void {
    weapon.cooldownTimer -= dt;
    if (weapon.cooldownTimer > 0) return;
    const target = this.findNearest(x, y, weaponRange(def));
    if (!target) {
      // Personne à portée : l'arme reste prête (sans accumuler de tirs en retard).
      weapon.cooldownTimer = 0;
      return;
    }
    if (this.fire(weapon, def, x, y, target)) weapon.cooldownTimer = weapon.cooldown;
  }

  /**
   * Tire `count` projectiles en éventail centré sur la cible
   * (ex. 3 projectiles à 12° d'écart : -12°, 0°, +12°).
   * Renvoie faux si la réserve de projectiles est vide (on retentera à l'update suivante).
   */
  private fire(
    weapon: Weapon,
    def: ProjectileWeaponDef,
    x: number,
    y: number,
    target: Enemy,
  ): boolean {
    const baseAngle = Math.atan2(target.y - y, target.x - x);
    const spread = (def.spreadDeg * Math.PI) / 180;
    const count = weapon.count;
    let fired = 0;
    for (let i = 0; i < count; i++) {
      const projectile = this.projectiles.acquire();
      if (!projectile) break;
      const angle = baseAngle + (i - (count - 1) / 2) * spread;
      projectile.launch(weapon, def, x, y, Math.cos(angle), Math.sin(angle));
      fired++;
    }
    return fired > 0;
  }

  /**
   * Chaque ennemi a sa propre horloge : il brûle dès qu'il touche le cercle, puis toutes les
   * `cooldown` secondes tant qu'il y reste. (Une horloge commune laissait un ennemi entré juste
   * après un tick traverser presque 0,5 s sans rien prendre.)
   */
  private updateAura(weapon: Weapon, x: number, y: number, now: number): void {
    const radius = weapon.radius;
    const reach = radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const count = this.collisions.queryNeighbors(x, y, reach, this.candidates);
    for (let i = 0; i < count; i++) {
      const e = this.candidates[i];
      if (!e?.active || now < e.nextAuraHitAt) continue;
      const touch = radius + e.type.radius; // le cercle de l'aura touche le bord de l'ennemi
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy > touch * touch) continue;
      e.nextAuraHitAt = now + weapon.cooldown;
      // Recul vers l'extérieur, depuis le joueur.
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      damageEnemy(weapon, e, weapon.damage, this.events, dx / dist, dy / dist);
    }
  }

  /**
   * Les orbes tournent ; chacun blesse les ennemis qu'il touche. Un même ennemi ne peut être
   * retouché qu'après `rehitCooldown` (sinon il prendrait des dégâts à chaque update).
   */
  private updateOrbit(
    weapon: Weapon,
    def: OrbitWeaponDef,
    dt: number,
    x: number,
    y: number,
    now: number,
  ): void {
    weapon.prevAngle = weapon.angle;
    weapon.angle += def.angularSpeed * dt;

    const orbs = weapon.count;
    const reach = def.orbRadius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    for (let o = 0; o < orbs; o++) {
      const ox = WeaponSystem.orbX(x, weapon.angle, o, orbs, def.orbitDistance);
      const oy = WeaponSystem.orbY(y, weapon.angle, o, orbs, def.orbitDistance);
      const count = this.collisions.queryNeighbors(ox, oy, reach, this.candidates);
      for (let i = 0; i < count; i++) {
        const e = this.candidates[i];
        if (!e?.active || now < e.nextOrbitHitAt) continue;
        const touch = def.orbRadius + e.type.radius;
        const dx = e.x - ox;
        const dy = e.y - oy;
        if (dx * dx + dy * dy > touch * touch) continue;
        e.nextOrbitHitAt = now + def.rehitCooldown;
        // Recul toujours vers l'extérieur, depuis le joueur. (Depuis le centre de l'orbe, un
        // ennemi frappé côté intérieur du cercle était renvoyé... sur le joueur.)
        const ex = e.x - x;
        const ey = e.y - y;
        const dist = Math.sqrt(ex * ex + ey * ey) || 1;
        damageEnemy(weapon, e, weapon.damage, this.events, ex / dist, ey / dist);
      }
    }
  }
}
