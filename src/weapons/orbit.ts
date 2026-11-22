// Orbite (Orbes runiques) : des orbes tournent autour du joueur et blessent ce qu'ils touchent.

import { lerp } from '../core/math';
import { frameAt } from '../core/SpriteAtlas';
import { ORB_SPRITE } from '../data/sprites';
import { SIZE_ORBIT_SHARE } from '../data/upgrades';
import { MAX_ORBS, type OrbitWeaponDef } from '../data/weapons';
import { MAX_ENEMY_RADIUS } from '../systems/CollisionSystem';
import { damageEnemy } from '../systems/damage';
import { GRID_STALENESS_MARGIN } from '../systems/ProjectileSystem';
import { formatNumber } from '../ui/formatNumber';
import { weaponTint } from './shared';
import type { WeaponBehavior } from './WeaponBehavior';

/** Position (x ou y) de l'orbe n° `index` autour de (cx, cy) pour un angle donné. */
export function orbX(cx: number, angle: number, index: number, count: number, distance: number) {
  return cx + Math.cos(angle + (index * Math.PI * 2) / count) * distance;
}

export function orbY(cy: number, angle: number, index: number, count: number, distance: number) {
  return cy + Math.sin(angle + (index * Math.PI * 2) / count) * distance;
}

export const ORBIT_BEHAVIOR: WeaponBehavior<OrbitWeaponDef> = {
  init(weapon, def) {
    // L'orbite n'a pas de délai : chaque orbe a son délai de re-touche par ennemi.
    weapon.cooldown = 0;
    weapon.count = def.count;
    weapon.orbRadius = def.orbRadius;
    weapon.angularSpeed = def.angularSpeed;
    weapon.orbitDistance = def.orbitDistance;
  },

  levelBase(def, t) {
    t.count = def.count;
    t.orbitDistance = def.orbitDistance;
  },

  applyStats(weapon, def, t, mods) {
    const m = weapon.mutation;
    const size = mods.sizeMult ?? 1;
    // Une mutation peut imposer un nombre (3 orbes géants, 9 orbes de tempête) ; le Duplicateur
    // s'ajoute APRÈS, donc aussi aux mutations.
    weapon.count = (m?.count ?? t.count) + (mods.extraCount ?? 0);
    weapon.orbRadius = def.orbRadius * (m?.orbRadiusMult ?? 1) * size;
    weapon.angularSpeed =
      def.angularSpeed * (m?.angularSpeedMult ?? 1) * (mods.projectileSpeedMult ?? 1);
    // L'orbite ne s'éloigne qu'avec une petite part du bonus de Taille (les orbes, eux, grossissent).
    weapon.orbitDistance =
      t.orbitDistance * (m?.orbitDistanceMult ?? 1) * (1 + (size - 1) * SIZE_ORBIT_SHARE);
    // La Hâte n'accélère pas les orbes.
    weapon.cooldown = 0;
  },

  /**
   * Les orbes tournent ; chacun blesse les ennemis qu'il touche. Un même orbe ne peut retoucher
   * le même ennemi qu'après `rehitCooldown` (sinon il prendrait des dégâts à chaque update).
   * Le délai est propre à chaque orbe : plusieurs orbes sur un même ennemi frappent tous.
   */
  update(weapon, def, ctx) {
    const { x, y, now } = ctx;
    weapon.prevAngle = weapon.angle;
    weapon.angle += weapon.angularSpeed * ctx.dt;

    const orbs = Math.min(weapon.count, MAX_ORBS);
    const reach = weapon.orbRadius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const candidates = ctx.candidates;
    for (let o = 0; o < orbs; o++) {
      const ox = orbX(x, weapon.angle, o, orbs, weapon.orbitDistance);
      const oy = orbY(y, weapon.angle, o, orbs, weapon.orbitDistance);
      const count = ctx.collisions.queryNeighbors(ox, oy, reach, candidates);
      for (let i = 0; i < count; i++) {
        const e = candidates[i];
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
        damageEnemy(weapon, e, weapon.damage, ctx.events, ex / dist, ey / dist);
      }
    }
  },

  /** Orbes autour du joueur, à leur angle interpolé (rotation fluide à 144/240 Hz). */
  renderAbove(ctx, w, _def, rc) {
    const px = rc.playerX;
    const py = rc.playerY;
    const angle = lerp(w.prevAngle, w.angle, rc.alpha);
    const fx = rc.fx;
    const frame = fx && frameAt(fx.animation(ORB_SPRITE.anim), rc.time, ORB_SPRITE.frameTime);
    if (fx && frame) {
      // Sprite à la taille exacte de la hitbox (niveaux, mutation, passif Taille compris).
      const scale = (w.orbRadius * 2) / ORB_SPRITE.diameter;
      const tint = weaponTint(w.color);
      for (let o = 0; o < w.count; o++) {
        const x = orbX(px, angle, o, w.count, w.orbitDistance);
        const y = orbY(py, angle, o, w.count, w.orbitDistance);
        fx.draw(ctx, frame, x, y + (frame.h * scale) / 2, scale, false, tint);
      }
      return;
    }
    ctx.beginPath();
    for (let o = 0; o < w.count; o++) {
      const x = orbX(px, angle, o, w.count, w.orbitDistance);
      const y = orbY(py, angle, o, w.count, w.orbitDistance);
      ctx.moveTo(x + w.orbRadius, y);
      ctx.arc(x, y, w.orbRadius, 0, Math.PI * 2);
    }
    ctx.fillStyle = w.color;
    ctx.fill();
  },

  cardStats(weapon) {
    return [
      ['orbes', formatNumber(weapon.count)],
      ['orbite', `${formatNumber(weapon.orbitDistance)} px`],
    ];
  },
};
