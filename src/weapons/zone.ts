// Zone au sol (Chausse-trapes) : des pointes posées sous le joueur, qui blessent ce qui marche
// dessus. Mutations : Mines (explosent au premier contact) et Champ de ronces (plus grandes,
// plus longues, ralentissent). Les zones vivent dans un tableau fixe de l'arme.

import { frameAt } from '../core/SpriteAtlas';
import { CALTROPS_SPRITE } from '../data/sprites';
import type { ZoneWeaponDef } from '../data/weapons';
import type { Weapon } from '../entities/Weapon';
import { MAX_ENEMY_RADIUS } from '../systems/CollisionSystem';
import { damageEnemy } from '../systems/damage';
import { GRID_STALENESS_MARGIN } from '../systems/ProjectileSystem';
import { applySlow } from '../systems/status';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, scaledCooldown, weaponTint } from './shared';
import type { WeaponBehavior, WeaponUpdateContext } from './WeaponBehavior';

/** Zones posées au plus pour une arme (au-delà, la plus ancienne est remplacée) */
const MAX_ZONES = 24;
/** px : distance au joueur des zones en plus d'une même pose (× leur rayon) */
const EXTRA_ZONE_DISTANCE = 1.6;
/** Écart entre deux tuiles de pointes (× leur taille) : un peu serrées, elles se chevauchent */
const TILE_SPACING = 0.8;
/** Les tuiles dont le centre est à moins de (rayon − ce facteur × taille) sont dessinées */
const TILE_INSET = 0.3;
/** Opacité du disque qui montre la zone */
const ZONE_FILL_ALPHA = 0.18;

// Rangement d'une zone dans `Weapon.zones`.
const ACTIVE = 0; // 1 : posée, 0 : libre
const X = 1;
const Y = 2;
const BORN = 3;
const EXPIRES = 4;
const STRIDE = 5;

/** Pose une zone en (x, y) ; si tout est pris, remplace celle qui finit le plus tôt. */
function place(weapon: Weapon, x: number, y: number, now: number): void {
  const z = weapon.zones;
  if (!z) return;
  let slot = 0;
  let soonest = Infinity;
  for (let i = 0; i < MAX_ZONES; i++) {
    const o = i * STRIDE;
    if (z[o + ACTIVE] === 0) {
      slot = i;
      break;
    }
    const end = z[o + EXPIRES] ?? 0;
    if (end < soonest) {
      soonest = end;
      slot = i;
    }
  }
  const o = slot * STRIDE;
  z[o + ACTIVE] = 1;
  z[o + X] = x;
  z[o + Y] = y;
  z[o + BORN] = now;
  z[o + EXPIRES] = now + weapon.duration;
}

/** Mine : explose sur place (tous les ennemis à portée), puis disparaît. */
function explode(weapon: Weapon, o: number, ctx: WeaponUpdateContext): void {
  const z = weapon.zones;
  const mine = weapon.mutation?.mine;
  if (!z || !mine) return;
  const x = z[o + X] ?? 0;
  const y = z[o + Y] ?? 0;
  const radius = mine.radius * weapon.explosionRadius; // explosionRadius = Taille du joueur
  z[o + ACTIVE] = 0;
  ctx.events.onExplosion?.(x, y, radius, weapon.color);
  const candidates = ctx.candidates;
  const count = ctx.collisions.queryNeighbors(x, y, radius + MAX_ENEMY_RADIUS, candidates);
  for (let k = 0; k < count; k++) {
    const e = candidates[k];
    if (!e?.active) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const touch = radius + e.type.radius;
    if (dx * dx + dy * dy > touch * touch) continue;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(weapon, e, weapon.damage * mine.damageMult, ctx.events, dx / d, dy / d);
  }
}

/** Une zone : blesse (ou fait exploser la mine sur) les ennemis qui la touchent. */
function updateZone(weapon: Weapon, def: ZoneWeaponDef, i: number, ctx: WeaponUpdateContext) {
  const z = weapon.zones;
  if (!z) return;
  const o = i * STRIDE;
  if (ctx.now >= (z[o + EXPIRES] ?? 0)) {
    z[o + ACTIVE] = 0;
    return;
  }
  const x = z[o + X] ?? 0;
  const y = z[o + Y] ?? 0;
  const radius = weapon.radius;
  const mine = weapon.mutation?.mine;
  const slow = weapon.mutation?.slow;
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
    const dx = e.x - x;
    const dy = e.y - y;
    const touch = radius + e.type.radius;
    if (dx * dx + dy * dy > touch * touch) continue;
    if (mine) {
      // Le mobilier ne déclenche pas une mine (l'explosion le casse quand même).
      if (e.type.prop) continue;
      explode(weapon, o, ctx);
      return;
    }
    // Horloge par ennemi, propre aux zones : plusieurs zones posées l'une sur l'autre ne
    // blessent pas plus vite qu'une seule.
    if (ctx.now < e.nextZoneHitAt) continue;
    e.nextZoneHitAt = ctx.now + def.tick;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(weapon, e, weapon.damage, ctx.events, dx / d, dy / d);
    if (e.active && slow) applySlow(e, slow.amount, slow.duration, ctx.now);
  }
}

export const ZONE_BEHAVIOR: WeaponBehavior<ZoneWeaponDef> = {
  init(weapon, def) {
    weapon.cooldown = def.cooldown;
    weapon.count = def.count;
    weapon.radius = def.radius;
    weapon.duration = def.duration;
    weapon.explosionRadius = 1;
    weapon.zones = new Float64Array(MAX_ZONES * STRIDE);
  },

  levelBase(def, t) {
    t.count = def.count;
    t.radius = def.radius;
    t.duration = def.duration;
  },

  applyStats(weapon, def, t, mods) {
    const m = weapon.mutation;
    const size = mods.sizeMult ?? 1;
    // Le Duplicateur ne compte pas (comme pour l'Aura : rien à dupliquer).
    weapon.count = m?.count ?? t.count;
    weapon.radius = t.radius * (m?.radiusMult ?? 1) * size;
    weapon.duration = t.duration * (m?.durationMult ?? 1);
    // Taille du joueur, gardée pour le rayon des Mines.
    weapon.explosionRadius = size;
    // La Hâte fait poser plus souvent.
    weapon.cooldown = scaledCooldown(def.cooldown, t.cooldownPct, m, mods);
  },

  update(weapon, def, ctx) {
    const z = weapon.zones;
    if (!z) return;
    // Pose d'abord : une nouvelle zone blesse dès sa première update.
    weapon.cooldownTimer -= ctx.dt;
    if (weapon.cooldownTimer <= 0) {
      weapon.cooldownTimer = weapon.cooldown;
      // La 1re zone sous le joueur, les autres autour de lui (angle tiré au hasard).
      place(weapon, ctx.x, ctx.y, ctx.now);
      for (let k = 1; k < weapon.count; k++) {
        const a = ctx.rng.range(0, Math.PI * 2);
        const d = weapon.radius * EXTRA_ZONE_DISTANCE;
        place(weapon, ctx.x + Math.cos(a) * d, ctx.y + Math.sin(a) * d, ctx.now);
      }
      ctx.events.onFire?.(weapon);
    }
    for (let i = 0; i < MAX_ZONES; i++) {
      if (z[i * STRIDE + ACTIVE] === 1) updateZone(weapon, def, i, ctx);
    }
  },

  /**
   * Au sol, sous les ennemis : un disque discret pour voir la zone, et des tuiles de pointes
   * du pack en grille dedans, qui sortent à la pose et rentrent à la fin. Mine : une bombe.
   */
  renderGround(ctx, weapon, _def, rc) {
    const z = weapon.zones;
    if (!z) return;
    const sprites = rc.sprites;
    const spikes = sprites?.animation(CALTROPS_SPRITE.spikes);
    const bomb = sprites?.animation(CALTROPS_SPRITE.bomb);
    const tint = weapon.mutation ? weaponTint(weapon.color) : undefined;
    const scale = CALTROPS_SPRITE.scale;
    for (let i = 0; i < MAX_ZONES; i++) {
      const o = i * STRIDE;
      if (z[o + ACTIVE] !== 1) continue;
      const x = z[o + X] ?? 0;
      const y = z[o + Y] ?? 0;
      const r = weapon.radius;
      if (!rc.isOnScreen(x, y, r)) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = weapon.color;
      ctx.globalAlpha = ZONE_FILL_ALPHA;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (weapon.mutation?.mine) {
        const frame = bomb && frameAt(bomb, rc.time + i, CALTROPS_SPRITE.bombFrameTime);
        if (frame && sprites) sprites.draw(ctx, frame, x, y + (frame.h * scale) / 2, scale, false);
        continue;
      }
      if (!spikes || spikes.length === 0 || !sprites) continue;
      // Image des pointes : elles sortent à la pose, restent sorties, rentrent à la fin.
      const age = rc.time - (z[o + BORN] ?? 0);
      const left = (z[o + EXPIRES] ?? 0) - rc.time;
      const t = Math.min(age, left) / CALTROPS_SPRITE.riseTime;
      const frame = spikes[Math.min(spikes.length - 1, Math.max(0, Math.floor(t * spikes.length)))];
      if (!frame) continue;
      // Grille de tuiles un peu serrées (elles se chevauchent) dont le centre tient dans le
      // cercle : une croix de 5 pour le rayon de départ, un carré de 9 dès 50 px.
      const tile = frame.w * scale;
      const step = tile * TILE_SPACING;
      const limit = r - tile * TILE_INSET;
      const n = Math.floor(limit / step);
      for (let gx = -n; gx <= n; gx++) {
        for (let gy = -n; gy <= n; gy++) {
          if ((gx * step) ** 2 + (gy * step) ** 2 > limit * limit) continue;
          sprites.draw(ctx, frame, x + gx * step, y + gy * step + tile / 2, scale, false, tint);
        }
      }
    }
  },

  cardStats(weapon) {
    return [
      ['rayon', `${formatNumber(weapon.radius)} px`],
      ['durée', `${formatNumber(weapon.duration, 1)} s`],
      ['zones', formatNumber(weapon.count)],
      cooldownStat(weapon.cooldown),
    ];
  },
};
