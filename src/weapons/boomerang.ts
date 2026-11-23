// Boomerang (Hache de lancer) : lancée vers l'ennemi le plus proche, elle vole jusqu'à sa
// portée puis revient au joueur, en frappant chaque ennemi une fois à l'aller et une fois au
// retour. Les haches en vol vivent dans des tableaux fixes de l'arme : rien n'est créé en jeu.

import { lerp } from '../core/math';
import { THROWING_AXE_SPRITE } from '../data/sprites';
import type { BoomerangWeaponDef } from '../data/weapons';
import type { Weapon } from '../entities/Weapon';
import { MAX_ENEMY_RADIUS } from '../systems/CollisionSystem';
import { damageEnemy } from '../systems/damage';
import { GRID_STALENESS_MARGIN } from '../systems/ProjectileSystem';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, scaledCooldown, weaponTint } from './shared';
import type { WeaponBehavior, WeaponUpdateContext } from './WeaponBehavior';

/** Haches en vol au plus pour une arme (au-delà, un lancer attend qu'une revienne) */
const MAX_FLIGHTS = 16;
/** Ennemis retenus par hache et par trajet (au-delà, ils peuvent être retouchés) */
const MAX_FLIGHT_HITS = 48;
/** px : la hache est rattrapée quand elle arrive à cette distance du joueur */
const CATCH_DISTANCE = 16;

// Rangement d'une hache dans `Weapon.flights` : un bloc de STRIDE valeurs.
const STATE = 0; // 0 : libre, 1 : aller, 2 : retour
const X = 1;
const Y = 2;
const PREV_X = 3;
const PREV_Y = 4;
const DIR_X = 5;
const DIR_Y = 6;
const TRAVELED = 7;
const HIT_COUNT = 8;
const STRIDE = 9;
/** Valeurs par hache dans `Weapon.flights` (lu par Weapon.syncPrevious) */
export const FLIGHT_STRIDE = STRIDE;

const FREE = 0;
const OUT = 1;
const BACK = 2;

/** Lance une hache depuis (x, y) dans la direction `angle` ; faux si toutes sont en vol. */
function launch(weapon: Weapon, x: number, y: number, angle: number): boolean {
  const f = weapon.flights;
  if (!f) return false;
  for (let i = 0; i < MAX_FLIGHTS; i++) {
    const o = i * STRIDE;
    if (f[o + STATE] !== FREE) continue;
    f[o + STATE] = OUT;
    f[o + X] = x;
    f[o + Y] = y;
    f[o + PREV_X] = x;
    f[o + PREV_Y] = y;
    f[o + DIR_X] = Math.cos(angle);
    f[o + DIR_Y] = Math.sin(angle);
    f[o + TRAVELED] = 0;
    f[o + HIT_COUNT] = 0;
    return true;
  }
  return false;
}

/** Vrai si l'ennemi `id` a déjà été touché par la hache `i` pendant ce trajet. */
function alreadyHit(weapon: Weapon, i: number, id: number): boolean {
  const hits = weapon.flightHits;
  const f = weapon.flights;
  if (!hits || !f) return false;
  const n = f[i * STRIDE + HIT_COUNT] ?? 0;
  const base = i * MAX_FLIGHT_HITS;
  for (let k = 0; k < n; k++) if (hits[base + k] === id) return true;
  return false;
}

/** Fait avancer la hache `i`, puis frappe les ennemis qu'elle touche. */
function fly(weapon: Weapon, i: number, ctx: WeaponUpdateContext): void {
  const f = weapon.flights;
  const hits = weapon.flightHits;
  if (!f || !hits) return;
  const o = i * STRIDE;
  const step = weapon.projectileSpeed * ctx.dt;
  f[o + PREV_X] = f[o + X] ?? 0;
  f[o + PREV_Y] = f[o + Y] ?? 0;
  if (f[o + STATE] === OUT) {
    f[o + X] = (f[o + X] ?? 0) + (f[o + DIR_X] ?? 0) * step;
    f[o + Y] = (f[o + Y] ?? 0) + (f[o + DIR_Y] ?? 0) * step;
    f[o + TRAVELED] = (f[o + TRAVELED] ?? 0) + step;
    if ((f[o + TRAVELED] ?? 0) >= weapon.range) {
      // Demi-tour : les ennemis de l'aller pourront être retouchés au retour.
      f[o + STATE] = BACK;
      f[o + HIT_COUNT] = 0;
    }
  } else {
    // Retour vers le joueur, qui a pu bouger entre-temps.
    const dx = ctx.x - (f[o + X] ?? 0);
    const dy = ctx.y - (f[o + Y] ?? 0);
    const d = Math.hypot(dx, dy);
    if (d <= step + CATCH_DISTANCE) {
      f[o + STATE] = FREE;
      return;
    }
    f[o + X] = (f[o + X] ?? 0) + (dx / d) * step;
    f[o + Y] = (f[o + Y] ?? 0) + (dy / d) * step;
  }
  const x = f[o + X] ?? 0;
  const y = f[o + Y] ?? 0;
  const radius = weapon.radius;
  const candidates = ctx.candidates;
  const count = ctx.collisions.queryNeighbors(
    x,
    y,
    radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN,
    candidates,
  );
  for (let k = 0; k < count; k++) {
    const e = candidates[k];
    if (!e?.active) continue;
    const touch = radius + e.type.radius;
    if ((e.x - x) ** 2 + (e.y - y) ** 2 > touch * touch) continue;
    if (alreadyHit(weapon, i, e.id)) continue;
    const n = f[o + HIT_COUNT] ?? 0;
    if (n < MAX_FLIGHT_HITS) {
      hits[i * MAX_FLIGHT_HITS + n] = e.id;
      f[o + HIT_COUNT] = n + 1;
    }
    // Recul vers l'extérieur, depuis le joueur (au retour, la hache ne ramène pas la horde).
    const ex = e.x - ctx.x;
    const ey = e.y - ctx.y;
    const d = Math.hypot(ex, ey) || 1;
    damageEnemy(weapon, e, weapon.damage, ctx.events, ex / d, ey / d);
  }
}

export const BOOMERANG_BEHAVIOR: WeaponBehavior<BoomerangWeaponDef> = {
  init(weapon, def) {
    weapon.cooldown = def.cooldown;
    weapon.count = def.count;
    weapon.radius = def.radius;
    weapon.range = def.range;
    weapon.projectileSpeed = def.speed;
    weapon.flights = new Float64Array(MAX_FLIGHTS * STRIDE);
    weapon.flightHits = new Int32Array(MAX_FLIGHTS * MAX_FLIGHT_HITS);
  },

  levelBase(def, t) {
    t.count = def.count;
    t.radius = def.radius;
  },

  applyStats(weapon, def, t, mods) {
    const m = weapon.mutation;
    // Une mutation peut imposer un nombre (Haches jumelles) ; le Duplicateur s'ajoute après.
    weapon.count = (m?.count ?? t.count) + (mods.extraCount ?? 0);
    weapon.radius = t.radius * (m?.radiusMult ?? 1) * (mods.sizeMult ?? 1);
    weapon.projectileSpeed = def.speed * (m?.speedMult ?? 1) * (mods.projectileSpeedMult ?? 1);
    weapon.range = def.range;
    weapon.cooldown = scaledCooldown(def.cooldown, t.cooldownPct, m, mods);
  },

  update(weapon, def, ctx) {
    const f = weapon.flights;
    if (!f) return;
    for (let i = 0; i < MAX_FLIGHTS; i++) {
      if (f[i * STRIDE + STATE] !== FREE) fly(weapon, i, ctx);
    }
    weapon.cooldownTimer -= ctx.dt;
    if (weapon.cooldownTimer > 0) return;
    const target = ctx.findNearest(ctx.x, ctx.y, weapon.range);
    if (!target) {
      weapon.cooldownTimer = 0; // personne à portée : l'arme reste prête
      return;
    }
    // Éventail centré sur la cible (ex. 3 haches à 25° : −25°, 0°, +25°).
    const base = Math.atan2(target.y - ctx.y, target.x - ctx.x);
    const spread = (def.spreadDeg * Math.PI) / 180;
    let thrown = 0;
    for (let k = 0; k < weapon.count; k++) {
      if (launch(weapon, ctx.x, ctx.y, base + (k - (weapon.count - 1) / 2) * spread)) thrown++;
    }
    if (thrown === 0) return; // toutes en vol : on retente à l'update suivante
    weapon.cooldownTimer = weapon.cooldown;
    ctx.events.onFire?.(weapon);
  },

  /** Haches qui tournent sur elles-mêmes, à leur position interpolée. */
  renderAbove(ctx, weapon, _def, rc) {
    const f = weapon.flights;
    if (!f) return;
    const frame = rc.sprites?.animation(THROWING_AXE_SPRITE.frame)[0];
    // La hauteur du sprite couvre le diamètre de la zone qui frappe.
    const scale = frame ? (weapon.radius * 2) / frame.h : 1;
    const tint = weapon.mutation ? weaponTint(weapon.color) : undefined;
    for (let i = 0; i < MAX_FLIGHTS; i++) {
      const o = i * STRIDE;
      if (f[o + STATE] === FREE) continue;
      const x = lerp(f[o + PREV_X] ?? 0, f[o + X] ?? 0, rc.alpha);
      const y = lerp(f[o + PREV_Y] ?? 0, f[o + Y] ?? 0, rc.alpha);
      if (!rc.isOnScreen(x, y, weapon.radius * 2)) continue;
      if (frame && rc.sprites) {
        const angle = rc.time * THROWING_AXE_SPRITE.spin + i;
        rc.sprites.drawRotated(ctx, frame, x, y, scale, angle, frame.w / 2, tint);
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, weapon.radius, 0, Math.PI * 2);
      ctx.fillStyle = weapon.color;
      ctx.fill();
    }
  },

  cardStats(weapon) {
    return [
      ['haches', formatNumber(weapon.count)],
      ['taille', `${formatNumber(weapon.radius * 2)} px`],
      cooldownStat(weapon.cooldown),
    ];
  },
};
