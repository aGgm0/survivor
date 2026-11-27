// Chaîne (Éclair en chaîne) : frappe l'ennemi le plus proche, puis saute de proche en proche.
// Mutations : Orage (la foudre tombe aussi au hasard et laisse des zones électriques) et Arc
// continu (plus de sauts, très longs, la perte de dégâts dépend de la longueur du saut).

import { clipFrameIndex } from '../core/EffectSheet';
import { CHAIN_LOOK } from '../data/feel';
import { CHAIN_FX, STORM_FIELD_FX } from '../data/sprites';
import type { ChainWeaponDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';
import { MAX_ENEMY_RADIUS } from '../systems/CollisionSystem';
import { damageEnemy } from '../systems/damage';
import { GRID_STALENESS_MARGIN } from '../systems/ProjectileSystem';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, scaledCooldown } from './shared';
import type { WeaponBehavior, WeaponRenderContext, WeaponUpdateContext } from './WeaponBehavior';

/** px : largeur de la foudre de l'Orage */
const STRIKE_SIZE = 70;
/** Segments d'éclair gardés pour le dessin (les plus vieux sont remplacés) */
const MAX_BOLTS = 64;
/** Valeurs par segment dans `Weapon.bolts` : x1, y1, x2, y2, temps, sorte (0 : 1er coup, 1 : saut) */
const BOLT_STRIDE = 6;
const FIRST = 0;
const JUMP = 1;
/** Zones électriques de l'Orage en même temps (au-delà, celle qui finit le plus tôt est remplacée) */
const MAX_FIELDS = 24;
/** Valeurs par zone dans `Weapon.fields` : x, y, début, fin (0 : place libre) */
const FIELD_STRIDE = 4;

/**
 * Ennemis déjà touchés par la décharge en cours (toutes ses chaînes) : une chaîne ne revient
 * jamais sur un ennemi, et deux chaînes de la même décharge ne frappent pas le même. Tableau
 * fixe partagé : une seule décharge est calculée à la fois.
 */
const MAX_HITS = 128;
const hit: (Enemy | null)[] = new Array<Enemy | null>(MAX_HITS).fill(null);
let hitCount = 0;

function alreadyHit(e: Enemy): boolean {
  for (let i = 0; i < hitCount; i++) if (hit[i] === e) return true;
  return false;
}

/** Ennemi actif, pas du mobilier, pas encore touché par cette décharge. */
function eligible(e: Enemy | undefined): e is Enemy {
  return e !== undefined && e.active && !e.type.prop && !alreadyHit(e);
}

/** Le plus proche de (x, y) à moins de `range`, parmi ceux pas encore touchés ; null sinon. */
function nearestFree(ctx: WeaponUpdateContext, x: number, y: number, range: number): Enemy | null {
  const candidates = ctx.candidates;
  const count = ctx.collisions.queryNeighbors(x, y, range, candidates);
  let best: Enemy | null = null;
  let bestDistSq = range * range;
  for (let i = 0; i < count; i++) {
    const e = candidates[i];
    if (!eligible(e)) continue;
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

/** Un ennemi au hasard à moins de `range` de (x, y), pas encore touché ; null s'il n'y en a pas. */
function randomFree(ctx: WeaponUpdateContext, x: number, y: number, range: number): Enemy | null {
  const candidates = ctx.candidates;
  const count = ctx.collisions.queryNeighbors(x, y, range, candidates);
  const rangeSq = range * range;
  const inRange = (e: Enemy) => (e.x - x) ** 2 + (e.y - y) ** 2 <= rangeSq;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const e = candidates[i];
    if (eligible(e) && inRange(e)) n++;
  }
  if (n === 0) return null;
  let pick = ctx.rng.int(0, n - 1);
  for (let i = 0; i < count; i++) {
    const e = candidates[i];
    if (!eligible(e) || !inRange(e)) continue;
    if (pick === 0) return e;
    pick--;
  }
  return null;
}

/** Garde un segment pour le dessin (tableau en boucle, aucun objet créé). */
function recordBolt(
  weapon: Weapon,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  now: number,
  kind: number,
) {
  const bolts = weapon.bolts;
  if (!bolts) return;
  const o = weapon.boltNext * BOLT_STRIDE;
  bolts[o] = x1;
  bolts[o + 1] = y1;
  bolts[o + 2] = x2;
  bolts[o + 3] = y2;
  bolts[o + 4] = now;
  bolts[o + 5] = kind;
  weapon.boltNext = (weapon.boltNext + 1) % MAX_BOLTS;
}

/** Une chaîne : depuis (fromX, fromY) sur `start`, puis `weapon.jumps` sauts au plus. */
function runChain(
  weapon: Weapon,
  ctx: WeaponUpdateContext,
  start: Enemy,
  fromX: number,
  fromY: number,
): void {
  let target: Enemy | null = start;
  let px = fromX;
  let py = fromY;
  let damage = weapon.damage;
  for (let j = 0; j <= weapon.jumps && target && hitCount < MAX_HITS; j++) {
    hit[hitCount++] = target;
    const tx = target.x;
    const ty = target.y;
    // Pas de segment de longueur nulle (départ de l'Orage : la foudre du pack le remplace).
    if (tx !== px || ty !== py) recordBolt(weapon, px, py, tx, ty, ctx.now, j === 0 ? FIRST : JUMP);
    // Recul dans le sens du saut.
    const d = Math.hypot(tx - px, ty - py) || 1;
    damageEnemy(weapon, target, damage, ctx.events, (tx - px) / d, (ty - py) / d);
    px = tx;
    py = ty;
    target = nearestFree(ctx, px, py, weapon.jumpRange);
    // Perte de dégâts du saut : fixe, plus une part qui grandit avec sa longueur (Arc continu).
    if (target) {
      const jump = Math.hypot(target.x - px, target.y - py);
      damage *= Math.max(0, 1 - weapon.falloff - weapon.falloffPerPx * jump);
    }
  }
}

/** Pose une zone électrique en (x, y) ; si tout est pris, remplace celle qui finit le plus tôt. */
function placeField(weapon: Weapon, x: number, y: number, now: number, duration: number): void {
  const f = weapon.fields;
  if (!f) return;
  let slot = 0;
  let soonest = Infinity;
  for (let i = 0; i < MAX_FIELDS; i++) {
    const end = f[i * FIELD_STRIDE + 3] ?? 0;
    if (end <= now) {
      slot = i;
      break;
    }
    if (end < soonest) {
      soonest = end;
      slot = i;
    }
  }
  const o = slot * FIELD_STRIDE;
  f[o] = x;
  f[o + 1] = y;
  f[o + 2] = now;
  f[o + 3] = now + duration;
}

/**
 * Zones électriques de l'Orage : frappent ce qui est dedans toutes les `field.tick` s. Horloge
 * par ennemi à part (`nextFieldHitAt`) : des zones l'une sur l'autre ne frappent pas plus vite.
 */
function updateFields(weapon: Weapon, ctx: WeaponUpdateContext): void {
  const f = weapon.fields;
  const field = weapon.mutation?.randomStrikes?.field;
  if (!f || !field) return;
  const radius = field.radius * weapon.explosionRadius; // explosionRadius = Taille du joueur
  const candidates = ctx.candidates;
  for (let i = 0; i < MAX_FIELDS; i++) {
    const o = i * FIELD_STRIDE;
    if (ctx.now >= (f[o + 3] ?? 0)) continue;
    const x = f[o] ?? 0;
    const y = f[o + 1] ?? 0;
    const count = ctx.collisions.queryNeighbors(
      x,
      y,
      radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN,
      candidates,
    );
    for (let k = 0; k < count; k++) {
      const e = candidates[k];
      if (!e?.active || ctx.now < e.nextFieldHitAt) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const touch = radius + e.type.radius;
      if (dx * dx + dy * dy > touch * touch) continue;
      e.nextFieldHitAt = ctx.now + field.tick;
      const d = Math.hypot(dx, dy) || 1;
      damageEnemy(weapon, e, weapon.damage * field.damageMult, ctx.events, dx / d, dy / d);
    }
  }
}

/** Une zone électrique : `storm-field` du pack en boucle ; secours : disque à la couleur de l'arme. */
function renderField(
  ctx: CanvasRenderingContext2D,
  rc: WeaponRenderContext,
  x: number,
  y: number,
  radius: number,
  age: number,
  left: number,
  color: string,
): void {
  const fx = STORM_FIELD_FX;
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * fx.alpha * Math.min(1, left / fx.fadeOut);
  const sheet = rc.effects?.[fx.effect];
  if (sheet) {
    const [x0, , x1] = sheet.clip.bounds;
    const scale = (radius * 2 * fx.cover) / (x1 - x0 || 1);
    sheet.drawAroundCenter(ctx, clipFrameIndex(sheet.clip, age * 1000), x, y, scale, scale);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.25;
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
}

export const CHAIN_BEHAVIOR: WeaponBehavior<ChainWeaponDef> = {
  init(weapon, def) {
    weapon.cooldown = def.cooldown;
    weapon.count = def.count;
    weapon.range = def.range;
    weapon.jumps = def.jumps;
    weapon.jumpRange = def.jumpRange;
    weapon.falloff = def.falloff;
    weapon.falloffPerPx = 0;
    weapon.explosionRadius = 1;
    weapon.bolts = new Float64Array(MAX_BOLTS * BOLT_STRIDE).fill(-Infinity);
    weapon.fields = new Float64Array(MAX_FIELDS * FIELD_STRIDE);
  },

  levelBase(def, t) {
    t.count = def.count;
    t.jumps = def.jumps;
  },

  applyStats(weapon, def, t, mods) {
    const m = weapon.mutation;
    // Duplicateur : une chaîne de plus par niveau, qui part d'une autre cible.
    weapon.count = (m?.count ?? t.count) + (mods.extraCount ?? 0);
    weapon.range = def.range;
    weapon.jumps = t.jumps + (m?.jumpsAdd ?? 0);
    // La Taille allonge les sauts (et agrandit les zones de l'Orage).
    weapon.jumpRange = (m?.jumpRange ?? def.jumpRange) * (mods.sizeMult ?? 1);
    weapon.falloff = m?.falloff ?? def.falloff;
    weapon.falloffPerPx = m?.falloffPerPx ?? 0;
    weapon.explosionRadius = mods.sizeMult ?? 1;
    weapon.cooldown = scaledCooldown(def.cooldown, t.cooldownPct, m, mods);
  },

  update(weapon, _def, ctx) {
    updateFields(weapon, ctx);
    weapon.cooldownTimer -= ctx.dt;
    if (weapon.cooldownTimer > 0) return;
    const { x, y } = ctx;
    const first = ctx.findNearest(x, y, weapon.range);
    if (!first) {
      // Personne à portée : l'arme reste prête (sans accumuler de décharges en retard).
      weapon.cooldownTimer = 0;
      return;
    }
    hitCount = 0;
    runChain(weapon, ctx, first, x, y);
    // Les autres chaînes partent chacune de l'ennemi le plus proche pas encore touché.
    for (let c = 1; c < weapon.count; c++) {
      const start = nearestFree(ctx, x, y, weapon.range);
      if (!start) break;
      runChain(weapon, ctx, start, x, y);
    }
    // Orage : la foudre tombe aussi sur des ennemis tirés au hasard autour du joueur (pleins
    // dégâts, sans chaîne), et laisse une zone électrique là où elle frappe.
    const storm = weapon.mutation?.randomStrikes;
    for (let s = 0; storm && s < storm.count; s++) {
      const target = randomFree(ctx, x, y, storm.range);
      if (!target) break;
      if (hitCount < MAX_HITS) hit[hitCount++] = target;
      ctx.events.onEffect?.('strike', target.x, target.y, STRIKE_SIZE);
      placeField(weapon, target.x, target.y, ctx.now, storm.field.duration);
      damageEnemy(weapon, target, weapon.damage, ctx.events, 0, 0);
    }
    weapon.cooldownTimer = weapon.cooldown;
    ctx.events.onFire?.(weapon);
  },

  /** Orage : zones électriques au sol (sous les ennemis), qui s'éteignent en fondu. */
  renderGround(ctx, weapon, _def, rc) {
    const f = weapon.fields;
    const field = weapon.mutation?.randomStrikes?.field;
    if (!f || !field) return;
    const radius = field.radius * weapon.explosionRadius;
    for (let i = 0; i < MAX_FIELDS; i++) {
      const o = i * FIELD_STRIDE;
      const left = (f[o + 3] ?? 0) - rc.time;
      if (left <= 0) continue;
      const x = f[o] ?? 0;
      const y = f[o + 1] ?? 0;
      if (!rc.isOnScreen(x, y, radius)) continue;
      renderField(ctx, rc, x, y, radius, rc.time - (f[o + 2] ?? 0), left, weapon.color);
    }
  },

  /**
   * Chaque segment récent : un trait brisé à la couleur de l'arme, cœur blanc, qui s'efface.
   * Les coudes sont tirés d'une formule fixe (pas d'aléatoire au rendu) : le trait ne tremble pas.
   */
  renderAbove(ctx, weapon, _def, rc) {
    const bolts = weapon.bolts;
    if (!bolts) return;
    const look = CHAIN_LOOK;
    // Effets du pack : fouet électrique au 1er coup (du joueur à la cible), éclair en chaîne à
    // chaque ricochet, étirés entre les deux bouts. Sans le pack : trait brisé dessiné ici.
    const first = rc.effects?.[CHAIN_FX.first];
    const jump = rc.effects?.[CHAIN_FX.jump];
    for (let i = 0; i < MAX_BOLTS; i++) {
      const o = i * BOLT_STRIDE;
      const age = rc.time - (bolts[o + 4] ?? -Infinity);
      const x1 = bolts[o] ?? 0;
      const y1 = bolts[o + 1] ?? 0;
      const x2 = bolts[o + 2] ?? 0;
      const y2 = bolts[o + 3] ?? 0;
      const sheet = bolts[o + 5] === FIRST ? first : jump;
      if (sheet) {
        if (!(age >= 0 && age < CHAIN_FX.life)) continue;
        const index = clipFrameIndex(sheet.clip, (age / CHAIN_FX.life) * sheet.clip.totalMs);
        sheet.drawStretched(ctx, index, x1, y1, x2, y2, CHAIN_FX.thickness);
        continue;
      }
      if (!(age >= 0 && age < look.life)) continue;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      // Perpendiculaire à la ligne, pour décaler les coudes.
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      const seed = (bolts[o + 4] ?? 0) * 97 + i * 13;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let k = 1; k < look.segments; k++) {
        const f = k / look.segments;
        const noise = Math.sin(seed + k * 12.9898) * 43758.5453;
        const off = (noise - Math.floor(noise) - 0.5) * 2 * look.jag;
        ctx.lineTo(x1 + (x2 - x1) * f + nx * off, y1 + (y2 - y1) * f + ny * off);
      }
      ctx.lineTo(x2, y2);
      ctx.globalAlpha = 1 - age / look.life;
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = look.outerWidth;
      ctx.stroke();
      ctx.strokeStyle = look.innerColor;
      ctx.lineWidth = look.innerWidth;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  cardStats(weapon) {
    return [
      ['sauts', formatNumber(weapon.jumps)],
      ['chaînes', formatNumber(weapon.count)],
      cooldownStat(weapon.cooldown),
    ];
  },
};
