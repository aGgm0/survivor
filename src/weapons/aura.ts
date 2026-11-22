// Aura (Aura ardente) : brûle les ennemis qui touchent le cercle autour du joueur. Mutations :
// Aura de givre (ralentit) et Fournaise (onde de feu qui s'étend, voir `pulse`).

import { AURA_LOOKS, AURA_PULSE, AURA_PULSE_RING } from '../data/feel';
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
const AURA_STROKE_ALPHA = 0.5;

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
      if (look) drawEmberRing(ctx, px, py, w.radius, look, rc.time);
      else {
        ctx.globalAlpha = AURA_STROKE_ALPHA;
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // Le front de l'onde : un anneau de braises vives qui part du joueur jusqu'à la portée
    // de l'onde (là où elle touche vraiment), puis s'éteint.
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
