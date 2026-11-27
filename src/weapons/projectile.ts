// Projectile (Trait arcanique) : tire vers l'ennemi le plus proche quand le délai est écoulé.

import {
  frameAt,
  type SpriteAnimation,
  type SpriteAtlas,
  type SpriteFrame,
} from '../core/SpriteAtlas';
import { clipFrameIndex, type EffectSheet } from '../core/EffectSheet';
import { ARROW_FLIGHT_FX, ARROW_SPRITE, BOLT_SPRITE, ENEMY_ANIM_OFFSET } from '../data/sprites';
import type { ProjectileWeaponDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, scaledCooldown, weaponTint } from './shared';
import type { WeaponBehavior, WeaponRenderContext, WeaponUpdateContext } from './WeaponBehavior';

/** Halo autour des projectiles : taille (× rayon) et opacité */
const PROJECTILE_GLOW_SCALE = 2;
const PROJECTILE_GLOW_ALPHA = 0.3;

/** Deux passes de dessin (halo puis cœur), définies une fois pour ne rien allouer par frame. */
const PROJECTILE_PASSES = [PROJECTILE_GLOW_SCALE, 1] as const;

/**
 * Tire `count` projectiles en éventail centré sur la cible
 * (ex. 3 projectiles à 12° d'écart : -12°, 0°, +12°).
 * Renvoie faux si la réserve de projectiles est vide (on retentera à l'update suivante).
 */
function fire(
  weapon: Weapon,
  def: ProjectileWeaponDef,
  ctx: WeaponUpdateContext,
  target: Enemy,
): boolean {
  const { x, y } = ctx;
  const baseAngle = Math.atan2(target.y - y, target.x - x);
  const spread = (def.spreadDeg * Math.PI) / 180;
  const count = weapon.count;
  let fired = 0;
  for (let i = 0; i < count; i++) {
    const projectile = ctx.projectiles.acquire();
    if (!projectile) break;
    const angle = baseAngle + (i - (count - 1) / 2) * spread;
    projectile.launch(weapon, def.projectileLifetime, x, y, Math.cos(angle), Math.sin(angle));
    fired++;
  }
  return fired > 0;
}

/** Flèches en vol : effet du pack en boucle, tourné dans le sens du tir, décalé par flèche. */
function renderFlights(
  weapon: Weapon,
  rc: WeaponRenderContext,
  ctx: CanvasRenderingContext2D,
  flight: EffectSheet,
): void {
  const items = rc.projectiles.items;
  const scale = ARROW_FLIGHT_FX.scale * (weapon.mutation?.lookScale ?? 1);
  const reach = flight.clip.width * scale;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (!p?.active || p.source !== weapon) continue;
    const x = p.renderX(rc.alpha);
    const y = p.renderY(rc.alpha);
    if (!rc.isOnScreen(x, y, reach)) continue;
    const index = clipFrameIndex(flight.clip, (rc.time + i * 0.07) * 1000);
    flight.draw(ctx, index, x, y, scale, Math.atan2(p.vy, p.vx));
  }
}

/** Flèches : sprite du pack à sa couleur, centré sur le projectile, pointe dans le sens du tir. */
function renderArrows(
  ctx: CanvasRenderingContext2D,
  weapon: Weapon,
  rc: WeaponRenderContext,
  sprites: SpriteAtlas,
  frame: SpriteFrame,
): void {
  const items = rc.projectiles.items;
  const { rotation } = ARROW_SPRITE;
  const scale = ARROW_SPRITE.scale * (weapon.mutation?.lookScale ?? 1);
  const pivot = frame.w / 2;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (!p?.active || p.source !== weapon) continue;
    const x = p.renderX(rc.alpha);
    const y = p.renderY(rc.alpha);
    if (!rc.isOnScreen(x, y, (frame.h * scale) / 2)) continue;
    sprites.drawRotated(ctx, frame, x, y, scale, Math.atan2(p.vy, p.vx) + rotation, pivot);
  }
}

/** Projectiles d'une arme en sprites, tournés dans le sens du tir, tête = taille de la hitbox. */
function renderBolts(
  ctx: CanvasRenderingContext2D,
  weapon: Weapon,
  rc: WeaponRenderContext,
  fx: SpriteAtlas,
  bolt: SpriteAnimation,
): void {
  ctx.globalAlpha = 1;
  const tint = weaponTint(weapon.color);
  const items = rc.projectiles.items;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (!p?.active || p.source !== weapon) continue;
    const x = p.renderX(rc.alpha);
    const y = p.renderY(rc.alpha);
    const scale = (p.radius * 2) / BOLT_SPRITE.headDiameter;
    if (!rc.isOnScreen(x, y, BOLT_SPRITE.headCenterX * scale)) continue;
    const frame = frameAt(bolt, rc.time + i * ENEMY_ANIM_OFFSET, BOLT_SPRITE.frameTime);
    if (!frame) continue;
    const angle = Math.atan2(p.vy, p.vx);
    fx.drawRotated(ctx, frame, x, y, scale, angle, BOLT_SPRITE.headCenterX, tint);
  }
}

export const PROJECTILE_BEHAVIOR: WeaponBehavior<ProjectileWeaponDef> = {
  init(weapon, def) {
    weapon.cooldown = def.cooldown;
    weapon.count = def.count;
    weapon.projectileSpeed = def.projectileSpeed;
    weapon.projectileRadius = def.projectileRadius;
    // Portée : distance parcourue par le projectile.
    weapon.range = def.projectileSpeed * def.projectileLifetime;
    weapon.pierce = def.pierce ?? 1;
  },

  levelBase(def, t) {
    t.count = def.count;
  },

  applyStats(weapon, def, t, mods) {
    const m = weapon.mutation;
    const size = mods.sizeMult ?? 1;
    const velocity = mods.projectileSpeedMult ?? 1;
    // Une mutation peut imposer un nombre ; le Duplicateur s'ajoute APRÈS.
    weapon.count = (m?.count ?? t.count) + (mods.extraCount ?? 0);
    weapon.projectileSpeed = def.projectileSpeed * velocity;
    weapon.projectileRadius = def.projectileRadius * size;
    // Durée de vie fixe : plus rapide = porte plus loin (et vise plus loin).
    weapon.range = weapon.projectileSpeed * def.projectileLifetime;
    weapon.explosionRadius = (m?.explosion?.radius ?? 0) * size;
    weapon.pierce = m?.pierce ?? def.pierce ?? 1;
    weapon.cooldown = scaledCooldown(def.cooldown, t.cooldownPct, m, mods);
  },

  update(weapon, def, ctx) {
    weapon.cooldownTimer -= ctx.dt;
    if (weapon.cooldownTimer > 0) return;
    const target = ctx.findNearest(ctx.x, ctx.y, weapon.range);
    if (!target) {
      // Personne à portée : l'arme reste prête (sans accumuler de tirs en retard).
      weapon.cooldownTimer = 0;
      return;
    }
    if (fire(weapon, def, ctx, target)) {
      weapon.cooldownTimer = weapon.cooldown;
      ctx.events.onFire?.(weapon);
    }
  },

  /** Un halo rond, puis le cœur (sprite orienté, ou disque sans atlas). Un chemin par passe. */
  renderAbove(ctx, weapon, def, rc) {
    // Flèches (Arc) : l'effet de vol du pack (en boucle, pointe sur le projectile) ; sans lui,
    // le sprite de flèche de l'atlas ; jamais de halo.
    const flight = def.look === 'arrow' ? rc.effects?.[ARROW_FLIGHT_FX.effect] : undefined;
    if (flight) {
      renderFlights(weapon, rc, ctx, flight);
      return;
    }
    const arrow = def.look === 'arrow' ? rc.sprites?.animation(ARROW_SPRITE.frame)[0] : undefined;
    if (arrow && rc.sprites) {
      renderArrows(ctx, weapon, rc, rc.sprites, arrow);
      return;
    }
    const items = rc.projectiles.items;
    const fx = rc.fx;
    const bolt = fx?.animation(BOLT_SPRITE.anim);
    for (const pass of PROJECTILE_PASSES) {
      if (fx && bolt && bolt.length > 0 && pass === 1) {
        renderBolts(ctx, weapon, rc, fx, bolt);
        continue;
      }
      ctx.beginPath();
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        if (!p?.active || p.source !== weapon) continue;
        const x = p.renderX(rc.alpha);
        const y = p.renderY(rc.alpha);
        const r = p.radius * pass;
        if (!rc.isOnScreen(x, y, r)) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.globalAlpha = pass === 1 ? 1 : PROJECTILE_GLOW_ALPHA;
      ctx.fillStyle = weapon.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  cardStats(weapon) {
    return [['projectiles', formatNumber(weapon.count)], cooldownStat(weapon.cooldown)];
  },
};
