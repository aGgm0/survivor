// Zone au sol (Chausse-trapes) : des pointes posées sous le joueur, qui blessent ce qui marche
// dessus. Mutations : Mines (explosent au premier contact) et Champ de ronces (plus grandes,
// plus longues, ralentissent). Les zones vivent dans un tableau fixe de l'arme.

import { clipFrameIndex, type EffectSheet } from '../core/EffectSheet';
import type { SpriteTint } from '../core/SpriteAtlas';
import { BRAMBLE_FX, CALTROPS_SPRITE, ZONE_FX } from '../data/sprites';
import type { ZoneWeaponDef } from '../data/weapons';
import type { Weapon } from '../entities/Weapon';
import { MAX_ENEMY_RADIUS } from '../systems/CollisionSystem';
import { damageEnemy } from '../systems/damage';
import { GRID_STALENESS_MARGIN } from '../systems/ProjectileSystem';
import { applySlow } from '../systems/status';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, scaledCooldown, weaponTint } from './shared';
import type { WeaponBehavior, WeaponRenderContext, WeaponUpdateContext } from './WeaponBehavior';

/** px : largeur des étincelles d'acier sur un ennemi touché */
const CLANG_SIZE = 26;
/** Zones posées au plus pour une arme (au-delà, la plus ancienne est remplacée) */
const MAX_ZONES = 24;
/** px : distance au joueur des zones en plus d'une même pose (× leur rayon) */
const EXTRA_ZONE_DISTANCE = 1.6;
/** Écart entre deux tuiles de pointes (× leur taille) : un peu serrées, elles se chevauchent */
const TILE_SPACING = 0.8;
/** Les tuiles dont le centre est à moins de (rayon − ce facteur × taille) sont dessinées */
const TILE_INSET = 0.3;

// Rangement d'une zone dans `Weapon.zones`.
const ACTIVE = 0; // 1 : posée, 0 : libre
const X = 1;
const Y = 2;
const BORN = 3;
const EXPIRES = 4;
const SPIKED = 5; // 1 : grand pic final déjà frappé
const STRIDE = 6;

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
  z[o + SPIKED] = 0;
}

/** Grand pic final (sans mutation) : un coup fort, une fois, à chaque ennemi dans la zone. */
function finalSpike(
  weapon: Weapon,
  spike: NonNullable<ZoneWeaponDef['finalSpike']>,
  o: number,
  ctx: WeaponUpdateContext,
): void {
  const z = weapon.zones;
  if (!z) return;
  z[o + SPIKED] = 1;
  const x = z[o + X] ?? 0;
  const y = z[o + Y] ?? 0;
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
    const dx = e.x - x;
    const dy = e.y - y;
    const touch = radius + e.type.radius;
    if (dx * dx + dy * dy > touch * touch) continue;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(weapon, e, weapon.damage * spike.damageMult, ctx.events, dx / d, dy / d);
  }
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
  // Explosion de baril du pack (feu puis fumée), large comme la zone qui frappe.
  ctx.events.onEffect?.('barrel', x, y, radius * 2);
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
  const expires = z[o + EXPIRES] ?? 0;
  if (ctx.now >= expires) {
    z[o + ACTIVE] = 0;
    return;
  }
  const spike = weapon.mutation ? undefined : def.finalSpike;
  if (spike && z[o + SPIKED] === 0 && ctx.now >= expires - spike.before) {
    finalSpike(weapon, spike, o, ctx);
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
    if (slow) {
      if (e.active) applySlow(e, slow.amount, slow.duration, ctx.now);
    } else {
      // Pointes de fer : étincelles d'acier aux pieds de l'ennemi.
      ctx.events.onEffect?.('clang', e.x, e.y + e.type.radius / 2, CLANG_SIZE);
    }
  }
}

/** px de pointillé de l'anneau qui montre le bord d'une zone (défini une fois : rien d'alloué) */
const DASH: number[] = [4, 4];
const RING_COLOR = '#1a1a1a';
const RING_ALPHA = 0.45;
/** Mine : lumière rouge (clignote), mèche (étincelles), anneau de danger qui pulse */
const MINE_LOOK = {
  light: '#ff3b30',
  lightSize: 4,
  blinkHz: 3,
  sparks: ['#ffd36b', '#ff9f43'],
  ringColor: '#ff9f43',
  ringAlpha: [0.25, 0.6],
  ringPulseHz: 1.5,
} as const;

/** Anneau en pointillés (le bord d'une zone ou le rayon d'une explosion). */
function dashedRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.setLineDash(DASH);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * Champ de ronces (voir BRAMBLE_FX) : rangées de buissons tous de la même taille, assez nombreux
 * pour couvrir le cercle à la hauteur de chaque rangée. Faux si l'effet n'est pas chargé.
 */
function renderBrambles(
  ctx: CanvasRenderingContext2D,
  rc: WeaponRenderContext,
  x: number,
  y: number,
  r: number,
  age: number,
  left: number,
  zoneIndex: number,
): boolean {
  const fx = BRAMBLE_FX;
  const sheet = rc.effects?.[fx.effect];
  if (!sheet) return false;
  const bush = r * fx.bushWidth;
  const sx = bush / boundsWidth(sheet);
  const step = bush * fx.spacing;
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * fx.alpha;
  for (let k = 0; k < fx.rows.length; k++) {
    const rowY = fx.rows[k] ?? 0;
    const delay = k * fx.stagger;
    if (age < delay) continue;
    const index = zoneFrame(sheet, fx.hold, age - delay, left);
    // Largeur du cercle à cette hauteur, moins un demi-buisson de chaque côté : centres des
    // buissons répartis dessus, au pas `step` au plus.
    const half = Math.sqrt(Math.max(0, 1 - rowY * rowY)) * r - bush / 2;
    const count = half <= 0 ? 1 : Math.ceil((half * 2) / step) + 1;
    const gap = count > 1 ? (half * 2) / (count - 1) : 0;
    for (let c = 0; c < count; c++) {
      const bx = count > 1 ? -half + c * gap : 0;
      const flip = (k + c + zoneIndex) % 2 === 1 ? -1 : 1;
      sheet.drawAtPivot(ctx, index, x + bx, y + rowY * r, sx * flip, sx * fx.squash);
    }
  }
  ctx.globalAlpha = alpha;
  return true;
}

/** Largeur visible (px d'art) d'un effet, toutes images confondues. */
function boundsWidth(sheet: EffectSheet): number {
  const [x0, , x1] = sheet.clip.bounds;
  return x1 - x0 || 1;
}

/** Dessine l'image `index` d'un effet avec le centre de sa zone visible posé en (x, y). */
function drawCentered(
  ctx: CanvasRenderingContext2D,
  sheet: EffectSheet,
  index: number,
  x: number,
  y: number,
  scale: number,
): void {
  const { pivotX, pivotY, bounds } = sheet.clip;
  const cx = (bounds[0] + bounds[2]) / 2;
  const cy = (bounds[1] + bounds[3]) / 2;
  sheet.draw(ctx, index, x + (pivotX - cx) * scale, y + (pivotY - cy) * scale, scale);
}

/**
 * Image d'un effet qui vit avec sa zone : son début à la pose, puis l'image `hold` tant que la
 * zone dure, puis sa fin pendant les derniers instants (`left` s avant la disparition).
 */
function zoneFrame(sheet: EffectSheet, hold: number, age: number, left: number): number {
  const frames = sheet.clip.frames;
  let introMs = 0;
  for (let k = 0; k < hold; k++) introMs += frames[k]?.durationMs ?? 0;
  const ageMs = age * 1000;
  if (ageMs < introMs) return clipFrameIndex(sheet.clip, ageMs);
  let outroMs = 0;
  for (let k = hold + 1; k < frames.length; k++) outroMs += frames[k]?.durationMs ?? 0;
  const leftMs = left * 1000;
  if (leftMs >= outroMs) return hold;
  // Fin : on avance dans les images après `hold`, au rythme de leur durée.
  let t = outroMs - leftMs;
  for (let k = hold + 1; k < frames.length; k++) {
    t -= frames[k]?.durationMs ?? 0;
    if (t < 0) return k;
  }
  return frames.length - 1;
}

/** Mine : anneau de danger qui pulse, bombe du pack, lumière rouge qui clignote, mèche. */
function renderMine(
  ctx: CanvasRenderingContext2D,
  rc: WeaponRenderContext,
  x: number,
  y: number,
  dangerRadius: number,
  i: number,
  color: string,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(rc.time * Math.PI * 2 * MINE_LOOK.ringPulseHz);
  const [low, high] = MINE_LOOK.ringAlpha;
  dashedRing(ctx, x, y, dangerRadius, MINE_LOOK.ringColor, low + (high - low) * pulse);
  const bomb = rc.sprites?.animation(CALTROPS_SPRITE.bomb)[0];
  const scale = CALTROPS_SPRITE.scale;
  if (bomb && rc.sprites) {
    rc.sprites.draw(ctx, bomb, x, y + (bomb.h * scale) / 2, scale, false);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  const top = y - ((bomb?.h ?? 10) * scale) / 2;
  // Lumière rouge : allumée la moitié du temps, décalée d'une mine à l'autre.
  if (Math.sin((rc.time + i * 0.37) * Math.PI * 2 * MINE_LOOK.blinkHz) > 0) {
    const s = MINE_LOOK.lightSize;
    ctx.fillStyle = MINE_LOOK.light;
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  }
  // Mèche : 3 étincelles de 2 px qui sautent au-dessus de la bombe (formule fixe, pas d'aléa).
  for (let k = 0; k < 3; k++) {
    const phase = rc.time * 9 + k * 2.1 + i;
    const sx = x + 6 + Math.sin(phase * 1.7) * 3;
    const sy = top - 2 - Math.abs(Math.sin(phase)) * 5;
    ctx.fillStyle = MINE_LOOK.sparks[k % 2] ?? MINE_LOOK.light;
    ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
  }
}

/** Secours sans les effets du pack : tuiles de pointes de l'atlas en grille dans la zone. */
function renderTiles(
  ctx: CanvasRenderingContext2D,
  rc: WeaponRenderContext,
  x: number,
  y: number,
  r: number,
  age: number,
  left: number,
  tint: SpriteTint | undefined,
): void {
  const sprites = rc.sprites;
  const spikes = sprites?.animation(CALTROPS_SPRITE.spikes);
  if (!sprites || !spikes || spikes.length === 0) return;
  // Les pointes sortent à la pose, restent sorties, rentrent à la fin.
  const t = Math.min(age, left) / CALTROPS_SPRITE.riseTime;
  const frame = spikes[Math.min(spikes.length - 1, Math.max(0, Math.floor(t * spikes.length)))];
  if (!frame) return;
  const scale = CALTROPS_SPRITE.scale;
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
   * Au sol, sous les ennemis. Chausse-trapes : pointes d'os du pack qui jaillissent, restent
   * dressées, puis le grand pic final (qui frappe, voir `finalSpike`) ; Champ de ronces :
   * rangées de buissons qui remplissent la zone ; Mines : la bombe, sa lumière rouge, sa mèche et l'anneau de danger.
   * Rien n'est modifié ici.
   */
  renderGround(ctx, weapon, _def, rc) {
    const z = weapon.zones;
    if (!z) return;
    const mutation = weapon.mutation;
    const look = ZONE_FX.spikes;
    const sheet = mutation?.mine || mutation?.slow ? undefined : rc.effects?.[look.effect];
    for (let i = 0; i < MAX_ZONES; i++) {
      const o = i * STRIDE;
      if (z[o + ACTIVE] !== 1) continue;
      const x = z[o + X] ?? 0;
      const y = z[o + Y] ?? 0;
      const r = weapon.radius;
      const mineRadius = mutation?.mine ? mutation.mine.radius * weapon.explosionRadius : 0;
      if (!rc.isOnScreen(x, y, Math.max(r, mineRadius))) continue;
      const age = rc.time - (z[o + BORN] ?? 0);
      const left = (z[o + EXPIRES] ?? 0) - rc.time;
      if (mutation?.mine) {
        renderMine(ctx, rc, x, y, mineRadius, i, weapon.color);
        continue;
      }
      if (mutation?.slow) {
        if (renderBrambles(ctx, rc, x, y, r, age, left, i)) continue;
      } else dashedRing(ctx, x, y, r, RING_COLOR, RING_ALPHA);
      if (sheet) {
        const index = zoneFrame(sheet, look.holdFrame, age, left);
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * look.alpha;
        drawCentered(ctx, sheet, index, x, y, (r * 2 * look.cover) / boundsWidth(sheet));
        ctx.globalAlpha = alpha;
        continue;
      }
      renderTiles(ctx, rc, x, y, r, age, left, mutation ? weaponTint(weapon.color) : undefined);
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
