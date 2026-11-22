// Mêlée (Épée) : coup en arc dans la direction de marche. Mutations : Tourbillon (360°) et
// Estoc (long, étroit, vers l'ennemi le plus proche). Le dessin du coup passe par les effets.

import type { MeleeWeaponDef } from '../data/weapons';
import type { Weapon } from '../entities/Weapon';
import { MAX_ENEMY_RADIUS } from '../systems/CollisionSystem';
import { damageEnemy } from '../systems/damage';
import { GRID_STALENESS_MARGIN } from '../systems/ProjectileSystem';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, FLOAT_EPSILON, scaledCooldown } from './shared';
import type { WeaponBehavior, WeaponUpdateContext } from './WeaponBehavior';

/**
 * Un coup : chaque ennemi dans l'arc (portée + son rayon, ouverture autour du regard) est
 * touché une fois. On compare des cosinus (produit scalaire) : pas d'atan2 par ennemi.
 */
function strike(weapon: Weapon, ctx: WeaponUpdateContext): void {
  const { x, y } = ctx;
  let facingX = ctx.facingX;
  let facingY = ctx.facingY;
  const range = weapon.range;
  // Estoc : vise l'ennemi le plus proche au lieu de la direction de marche.
  if (weapon.mutation?.thrust) {
    const target = ctx.findNearest(x, y, range + MAX_ENEMY_RADIUS);
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
  if (thrust) ctx.events.onThrust?.(x, y, angle, weapon.arc, range, weapon.color);
  else ctx.events.onSlash?.(x, y, angle, weapon.arc, range, weapon.color);
  const halfTan = Math.tan(weapon.arc / 2);

  const reach = range + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
  const candidates = ctx.candidates;
  const count = ctx.collisions.queryNeighbors(x, y, reach, candidates);
  for (let i = 0; i < count; i++) {
    const e = candidates[i];
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
    damageEnemy(weapon, e, weapon.damage, ctx.events, dirX, dirY);
  }
}

export const MELEE_BEHAVIOR: WeaponBehavior<MeleeWeaponDef> = {
  init(weapon, def) {
    weapon.cooldown = def.cooldown;
    weapon.count = def.count;
    weapon.range = def.range;
    weapon.arc = (def.arcDeg * Math.PI) / 180;
  },

  levelBase(def, t) {
    t.count = def.count;
    t.arcDeg = def.arcDeg;
    t.range = def.range;
  },

  applyStats(weapon, def, t, mods) {
    const m = weapon.mutation;
    // Le Duplicateur ne compte pas pour l'Épée (nerf : le combo la rendait trop forte).
    weapon.count = m?.count ?? t.count;
    // La Taille allonge la portée du coup, pas son ouverture. Tourbillon : 360° imposés ;
    // Estoc : 30° imposés et portée doublée.
    weapon.range = t.range * (m?.rangeMult ?? 1) * (mods.sizeMult ?? 1);
    weapon.arc = (Math.min(360, m?.arcDeg ?? t.arcDeg) * Math.PI) / 180;
    weapon.cooldown = scaledCooldown(def.cooldown, t.cooldownPct, m, mods);
  },

  /**
   * Une attaque = un combo de `weapon.count` coups (1 : le Duplicateur ne compte plus), espacés
   * de `comboDelay`. Le délai entre deux attaques (Hâte comprise) part du début du combo.
   */
  update(weapon, def, ctx) {
    const now = ctx.now;
    weapon.cooldownTimer -= ctx.dt;
    if (weapon.cooldownTimer <= 0 && weapon.strikesLeft === 0) {
      // Estoc : sans ennemi à portée, l'arme reste prête (pas de coup dans le vide).
      if (weapon.mutation?.thrust && !ctx.findNearest(ctx.x, ctx.y, weapon.range)) return;
      weapon.cooldownTimer = weapon.cooldown;
      weapon.strikesLeft = weapon.count;
      weapon.nextStrikeAt = now;
    }
    if (weapon.strikesLeft > 0 && now >= weapon.nextStrikeAt - FLOAT_EPSILON) {
      weapon.strikesLeft--;
      weapon.nextStrikeAt = now + def.comboDelay;
      strike(weapon, ctx);
    }
  },

  cardStats(weapon) {
    return [
      ['ouverture', `${formatNumber((weapon.arc * 180) / Math.PI)}°`],
      ['portée', `${formatNumber(weapon.range)} px`],
      cooldownStat(weapon.cooldown),
    ];
  },
};
