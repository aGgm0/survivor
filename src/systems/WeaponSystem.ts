import type { Pool } from '../core/Pool';
import {
  MAX_ORBS,
  type MeleeWeaponDef,
  type OrbitWeaponDef,
  type ProjectileWeaponDef,
} from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Weapon } from '../entities/Weapon';
import { MAX_ENEMY_RADIUS, type CollisionSystem } from './CollisionSystem';
import { damageEnemy, type HitEvents } from './damage';
import { applyPoison, applySlow } from './status';
import { GRID_STALENESS_MARGIN } from './ProjectileSystem';

/** Tolérance des comparaisons de temps et d'angle en virgule flottante */
const FLOAT_EPSILON = 1e-9;

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
   * (`facingX`, `facingY`) : direction regardée par le joueur (longueur 1), pour l'Épée.
   */
  update(
    dt: number,
    weapons: readonly Weapon[],
    fromX: number,
    fromY: number,
    now: number,
    facingX = 1,
    facingY = 0,
  ): void {
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
        case 'melee':
          this.updateMelee(weapon, def, dt, fromX, fromY, facingX, facingY, now);
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
      // La visée automatique ignore le mobilier (on ne gâche pas un tir sur un tonneau).
      if (!e?.active || e.type.prop) continue;
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
    const target = this.findNearest(x, y, weapon.range);
    if (!target) {
      // Personne à portée : l'arme reste prête (sans accumuler de tirs en retard).
      weapon.cooldownTimer = 0;
      return;
    }
    if (this.fire(weapon, def, x, y, target)) {
      weapon.cooldownTimer = weapon.cooldown;
      this.events.onFire?.(weapon);
    }
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
      projectile.launch(weapon, def.projectileLifetime, x, y, Math.cos(angle), Math.sin(angle));
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
    const pulse = weapon.mutation?.pulse ?? false;
    // Souffle (Fournaise) : une horloge commune ; entre deux souffles, l'aura ne fait rien.
    if (pulse) {
      if (now < weapon.nextPulseAt) return;
      weapon.nextPulseAt = now + weapon.cooldown;
      weapon.lastPulseAt = now;
      this.events.onAuraPulse?.(x, y, weapon.radius, weapon.color);
    }
    const radius = weapon.radius;
    const reach = radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const count = this.collisions.queryNeighbors(x, y, reach, this.candidates);
    for (let i = 0; i < count; i++) {
      const e = this.candidates[i];
      if (!e?.active || (!pulse && now < e.nextAuraHitAt)) continue;
      const touch = radius + e.type.radius; // le cercle de l'aura touche le bord de l'ennemi
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy > touch * touch) continue;
      if (!pulse) e.nextAuraHitAt = now + weapon.cooldown;
      // Recul vers l'extérieur, depuis le joueur.
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      damageEnemy(weapon, e, weapon.damage, this.events, dx / dist, dy / dist);
      if (e.active) this.applyAuraMutation(weapon, e, now);
    }
  }

  /** Effets d'état des auras mutées (Aura de givre : ralentit ; poison : pour plus tard). */
  private applyAuraMutation(weapon: Weapon, e: Enemy, now: number): void {
    const m = weapon.mutation;
    if (!m) return;
    if (m.slow) applySlow(e, m.slow.amount, m.slow.duration, now);
    // Le poison suit les dégâts actuels de l'arme : niveaux, mutation et Puissance comptent.
    if (m.poison) {
      applyPoison(e, weapon.damage * m.poison.dpsRatio, m.poison.duration, weapon, now);
    }
  }

  /**
   * Les orbes tournent ; chacun blesse les ennemis qu'il touche. Un même orbe ne peut retoucher
   * le même ennemi qu'après `rehitCooldown` (sinon il prendrait des dégâts à chaque update).
   * Le délai est propre à chaque orbe : plusieurs orbes sur un même ennemi frappent tous.
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
    weapon.angle += weapon.angularSpeed * dt;

    const orbs = Math.min(weapon.count, MAX_ORBS);
    const reach = weapon.orbRadius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    for (let o = 0; o < orbs; o++) {
      const ox = WeaponSystem.orbX(x, weapon.angle, o, orbs, weapon.orbitDistance);
      const oy = WeaponSystem.orbY(y, weapon.angle, o, orbs, weapon.orbitDistance);
      const count = this.collisions.queryNeighbors(ox, oy, reach, this.candidates);
      for (let i = 0; i < count; i++) {
        const e = this.candidates[i];
        if (!e?.active || now < (e.orbitHitAt[o] ?? 0)) continue;
        const touch = weapon.orbRadius + e.type.radius;
        const dx = e.x - ox;
        const dy = e.y - oy;
        if (dx * dx + dy * dy > touch * touch) continue;
        e.orbitHitAt[o] = now + def.rehitCooldown;
        // Recul toujours vers l'extérieur, depuis le joueur. (Depuis le centre de l'orbe, un
        // ennemi frappé côté intérieur du cercle était renvoyé... sur le joueur.)
        const ex = e.x - x;
        const ey = e.y - y;
        const dist = Math.sqrt(ex * ex + ey * ey) || 1;
        damageEnemy(weapon, e, weapon.damage, this.events, ex / dist, ey / dist);
      }
    }
  }

  /**
   * Épée : une attaque = un combo de `weapon.count` coups (1 : le Duplicateur ne compte plus), espacés de
   * `comboDelay`. Le délai entre deux attaques (Hâte comprise) part du début du combo.
   */
  private updateMelee(
    weapon: Weapon,
    def: MeleeWeaponDef,
    dt: number,
    x: number,
    y: number,
    facingX: number,
    facingY: number,
    now: number,
  ): void {
    weapon.cooldownTimer -= dt;
    if (weapon.cooldownTimer <= 0 && weapon.strikesLeft === 0) {
      // Estoc : sans ennemi à portée, l'arme reste prête (pas de coup dans le vide).
      if (weapon.mutation?.thrust && !this.findNearest(x, y, weapon.range)) return;
      weapon.cooldownTimer = weapon.cooldown;
      weapon.strikesLeft = weapon.count;
      weapon.nextStrikeAt = now;
    }
    if (weapon.strikesLeft > 0 && now >= weapon.nextStrikeAt - FLOAT_EPSILON) {
      weapon.strikesLeft--;
      weapon.nextStrikeAt = now + def.comboDelay;
      this.strike(weapon, x, y, facingX, facingY);
    }
  }

  /**
   * Un coup : chaque ennemi dans l'arc (portée + son rayon, ouverture autour du regard) est
   * touché une fois. On compare des cosinus (produit scalaire) : pas d'atan2 par ennemi.
   */
  private strike(weapon: Weapon, x: number, y: number, facingX: number, facingY: number): void {
    const range = weapon.range;
    // Estoc : vise l'ennemi le plus proche au lieu de la direction de marche.
    if (weapon.mutation?.thrust) {
      const target = this.findNearest(x, y, range + MAX_ENEMY_RADIUS);
      if (target) {
        const d = Math.hypot(target.x - x, target.y - y) || 1;
        facingX = (target.x - x) / d;
        facingY = (target.y - y) / d;
      }
    }
    const fullCircle = weapon.arc >= Math.PI * 2 - FLOAT_EPSILON;
    const minCos = Math.cos(weapon.arc / 2);
    const thrust = weapon.mutation?.thrust ?? false;
    const angle = Math.atan2(facingY, facingX);
    if (thrust) this.events.onThrust?.(x, y, angle, weapon.arc, range, weapon.color);
    else this.events.onSlash?.(x, y, angle, weapon.arc, range, weapon.color);
    const halfTan = Math.tan(weapon.arc / 2);

    const reach = range + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const count = this.collisions.queryNeighbors(x, y, reach, this.candidates);
    for (let i = 0; i < count; i++) {
      const e = this.candidates[i];
      if (!e?.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range + e.type.radius) continue;
      if (thrust) {
        // Estoc : le cône s'élargit avec la distance ; l'ennemi compte s'il le chevauche.
        const along = dx * facingX + dy * facingY;
        const side = Math.abs(dx * -facingY + dy * facingX);
        if (along < -e.type.radius || side > Math.max(along, 0) * halfTan + e.type.radius) continue;
      } else if (!fullCircle && dist > 0 && (dx * facingX + dy * facingY) / dist < minCos) {
        // Un ennemi collé au joueur (dist ≈ 0) est toujours touché.
        continue;
      }
      const dirX = dist > 0 ? dx / dist : facingX;
      const dirY = dist > 0 ? dy / dist : facingY;
      damageEnemy(weapon, e, weapon.damage, this.events, dirX, dirY);
    }
  }
}
