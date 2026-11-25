// Aura (Aura ardente) : brûle les ennemis qui touchent le cercle autour du joueur. Mutations :
// Aura de givre (ralentit) et Fournaise (onde de feu qui s'étend, voir `pulse`).

import { clipFrameIndex, type EffectSheet } from '../core/EffectSheet';
import { AURA_LOOKS, AURA_PULSE, AURA_PULSE_RING } from '../data/feel';
import { FROST_SNOW_FX, FURNACE_NOVA_FX } from '../data/sprites';
import type { AuraWeaponDef, MutationDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';
import { drawEmberRing } from '../scenes/game/embers';
import { MAX_ENEMY_RADIUS } from '../systems/CollisionSystem';
import { damageEnemy } from '../systems/damage';
import { GRID_STALENESS_MARGIN } from '../systems/ProjectileSystem';
import { applyPoison, applySlow } from '../systems/status';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, FLOAT_EPSILON, scaledCooldown } from './shared';
import type { WeaponBehavior, WeaponUpdateContext } from './WeaponBehavior';

/** Opacité du disque de l'aura (le contour est plus marqué) */
const AURA_FILL_ALPHA = 0.12;

/**
 * Flame Nova (Fournaise) à `age` s du départ de l'onde : l'anneau grandit avec le front de
 * l'onde, atteint sa portée `reach` à `travel` s, puis s'éteint (voir FURNACE_NOVA_FX).
 */
function drawNova(
  ctx: CanvasRenderingContext2D,
  nova: EffectSheet,
  x: number,
  y: number,
  reach: number,
  age: number,
  travel: number,
): void {
  const fx = FURNACE_NOVA_FX;
  const last = nova.clip.frames.length - 1;
  let index: number;
  if (age < 0) return;
  if (age < travel) {
    index = fx.start + Math.floor((age / travel) * (fx.peak - fx.start + 1));
  } else {
    const after = (age - travel) / fx.fade;
    if (after >= 1) return;
    index = fx.peak + 1 + Math.floor(after * (last - fx.peak));
  }
  const peak = nova.clip.frames[fx.peak]?.bounds;
  if (!peak) return;
  // L'image la plus grande fait la largeur du cercle touché ; la hauteur se rapproche d'un cercle
  // selon `roundness` (le pack dessine une ellipse en perspective).
  const sx = (reach * 2) / (peak[2] - peak[0]);
  const circle = (reach * 2) / (peak[3] - peak[1]);
  const sy = sx + (circle - sx) * fx.roundness;
  nova.drawAroundCenter(ctx, Math.min(index, last), x, y, sx, sy);
}
const AURA_STROKE_ALPHA = 0.5;

/** Neige qui tombe dans le cercle de l'aura : l'effet en boucle, étiré au diamètre, découpé. */
function drawSnow(
  ctx: CanvasRenderingContext2D,
  snow: EffectSheet,
  x: number,
  y: number,
  radius: number,
  time: number,
): void {
  const { width, height, pivotX, pivotY } = snow.clip;
  const scale = (radius * 2) / Math.min(width, height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = FROST_SNOW_FX.alpha;
  const index = clipFrameIndex(snow.clip, time * 1000);
  // Pivot de l'effet = son centre : posé sur le joueur.
  snow.draw(ctx, index, x + (pivotX - width / 2) * scale, y + (pivotY - height / 2) * scale, scale);
  ctx.restore();
}

/** Effets d'état des auras mutées (Aura de givre : ralentit ; poison : pour plus tard). */
function applyAuraMutation(weapon: Weapon, e: Enemy, now: number): void {
  const m = weapon.mutation;
  if (!m) return;
  if (m.slow) applySlow(e, m.slow.amount, m.slow.duration, now);
  // Le poison suit les dégâts actuels de l'arme : niveaux, mutation et Puissance comptent.
  if (m.poison) {
    applyPoison(e, weapon.damage * m.poison.dpsRatio, m.poison.duration, weapon, now);
  }
}

/**
 * Fournaise : une onde part toutes les `cooldown` s et s'étend du joueur jusqu'à sa portée
 * en `travel` s. Chaque ennemi est touché une fois par onde, quand le front l'atteint (son
 * bord compte), plus fort s'il est gros.
 */
function updateFireWave(
  weapon: Weapon,
  pulse: NonNullable<MutationDef['pulse']>,
  ctx: WeaponUpdateContext,
): void {
  const { x, y, now } = ctx;
  const reach = weapon.radius * pulse.reachMult;
  if (now >= weapon.nextPulseAt) {
    weapon.nextPulseAt = now + weapon.cooldown;
    weapon.lastPulseAt = now;
    weapon.pulseIndex++;
    ctx.events.onAuraPulse?.(x, y, reach, weapon.color);
  }
  const age = now - weapon.lastPulseAt;
  if (age > pulse.travel + FLOAT_EPSILON) return;
  const front = reach * Math.min(1, age / pulse.travel);
  const candidates = ctx.candidates;
  const count = ctx.collisions.queryNeighbors(
    x,
    y,
    front + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN,
    candidates,
  );
  for (let i = 0; i < count; i++) {
    const e = candidates[i];
    if (!e?.active || e.waveHit === weapon.pulseIndex) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist - e.type.radius > front) continue;
    e.waveHit = weapon.pulseIndex;
    const damage = weapon.damage * (e.type.big ? pulse.bigMult : pulse.smallMult);
    const d = dist || 1;
    damageEnemy(weapon, e, damage, ctx.events, dx / d, dy / d);
    if (e.active) applyAuraMutation(weapon, e, now);
  }
}

export const AURA_BEHAVIOR: WeaponBehavior<AuraWeaponDef> = {
  init(weapon, def) {
    weapon.cooldown = def.cooldown;
    weapon.radius = def.radius;
  },

  levelBase(def, t) {
    t.radius = def.radius;
  },

  applyStats(weapon, def, t, mods) {
    const m = weapon.mutation;
    // L'aura n'a rien à dupliquer : pas de `count`.
    weapon.radius = t.radius * (m?.radiusMult ?? 1) * (mods.sizeMult ?? 1);
    // La Hâte accélère les brûlures.
    weapon.cooldown = scaledCooldown(def.cooldown, t.cooldownPct, m, mods);
  },

  /**
   * Chaque ennemi a sa propre horloge : il brûle dès qu'il touche le cercle, puis toutes les
   * `cooldown` secondes tant qu'il y reste. (Une horloge commune laissait un ennemi entré juste
   * après un tick traverser presque 0,5 s sans rien prendre.)
   */
  update(weapon, _def, ctx) {
    const pulse = weapon.mutation?.pulse;
    if (pulse) {
      updateFireWave(weapon, pulse, ctx);
      return;
    }
    const { x, y, now } = ctx;
    const radius = weapon.radius;
    const reach = radius + MAX_ENEMY_RADIUS + GRID_STALENESS_MARGIN;
    const candidates = ctx.candidates;
    const count = ctx.collisions.queryNeighbors(x, y, reach, candidates);
    for (let i = 0; i < count; i++) {
      const e = candidates[i];
      if (!e?.active || now < e.nextAuraHitAt) continue;
      const touch = radius + e.type.radius; // le cercle de l'aura touche le bord de l'ennemi
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy > touch * touch) continue;
      e.nextAuraHitAt = now + weapon.cooldown;
      // Recul vers l'extérieur, depuis le joueur.
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      damageEnemy(weapon, e, weapon.damage, ctx.events, dx / dist, dy / dist);
      if (e.active) applyAuraMutation(weapon, e, now);
    }
  },

  /**
   * Disque très léger (pour voir la zone) et anneau de braises carrées posé sur le bord,
   * qui tourne et scintille (voir AURA_LOOKS). Rien n'est modifié ici : tout dépend du temps.
   */
  renderGround(ctx, w, _def, rc) {
    const px = rc.playerX;
    const py = rc.playerY;
    const look = AURA_LOOKS[w.mutation?.id ?? w.def.id];
    // Onde de feu (Fournaise) : rien de permanent autour du joueur, seulement l'onde
    // (retour de jeu : l'anneau constant ne servait à rien, c'est l'onde qui touche).
    const pulse = w.mutation?.pulse;
    const sincePulse = rc.time - w.lastPulseAt;
    if (!pulse) {
      ctx.beginPath();
      ctx.arc(px, py, w.radius, 0, Math.PI * 2);
      ctx.fillStyle = w.color; // couleur de la mutation si l'aura a muté
      ctx.globalAlpha = look ? look.fillAlpha : AURA_FILL_ALPHA;
      ctx.fill();
      ctx.globalAlpha = 1;
      // Aura de givre : la neige du pack tombe dans le cercle (boucle, découpée au rayon).
      const snow = w.mutation?.slow ? rc.effects?.[FROST_SNOW_FX.effect] : undefined;
      if (snow) drawSnow(ctx, snow, px, py, w.radius, rc.time);
      if (look) drawEmberRing(ctx, px, py, w.radius, look, rc.time);
      else {
        ctx.globalAlpha = AURA_STROKE_ALPHA;
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // Le front de l'onde : la Flame Nova du pack si elle est chargée, sinon un anneau de
    // braises vives ; dans les deux cas il part du joueur jusqu'à la portée de l'onde (là où
    // elle touche vraiment), puis s'éteint.
    const nova = pulse ? rc.effects?.[FURNACE_NOVA_FX.effect] : undefined;
    if (pulse && nova) {
      drawNova(ctx, nova, px, py, w.radius * pulse.reachMult, sincePulse, pulse.travel);
      return;
    }
    if (pulse && sincePulse >= 0 && sincePulse < pulse.travel + AURA_PULSE.fade) {
      const reach = w.radius * pulse.reachMult;
      const r = Math.max(8, reach * Math.min(1, sincePulse / pulse.travel));
      const opacity =
        sincePulse <= pulse.travel ? 1 : 1 - (sincePulse - pulse.travel) / AURA_PULSE.fade;
      drawEmberRing(ctx, px, py, r, AURA_PULSE_RING, rc.time, opacity);
    }
  },

  cardStats(weapon) {
    return [['rayon', `${formatNumber(weapon.radius)} px`], cooldownStat(weapon.cooldown)];
  },
};
