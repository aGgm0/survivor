// Chaîne (Éclair en chaîne) : frappe l'ennemi le plus proche, puis saute de proche en proche.
// Mutations : Orage (des chaînes partent aussi d'ennemis au hasard) et Arc continu (plus de
// sauts, sans perte de dégâts).

import { clipFrameIndex } from '../core/EffectSheet';
import { CHAIN_LOOK } from '../data/feel';
import { CHAIN_FX } from '../data/sprites';
import type { ChainWeaponDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';
import { damageEnemy } from '../systems/damage';
import { formatNumber } from '../ui/formatNumber';
import { cooldownStat, scaledCooldown } from './shared';
import type { WeaponBehavior, WeaponUpdateContext } from './WeaponBehavior';

/** px : largeur de la foudre de l'Orage */
const STRIKE_SIZE = 70;
/** Segments d'éclair gardés pour le dessin (les plus vieux sont remplacés) */
const MAX_BOLTS = 64;
/** Valeurs par segment dans `Weapon.bolts` : x1, y1, x2, y2, temps, sorte (0 : 1er coup, 1 : saut) */
const BOLT_STRIDE = 6;
const FIRST = 0;
const JUMP = 1;

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
    damage *= 1 - weapon.falloff;
    target = nearestFree(ctx, px, py, weapon.jumpRange);
  }
}

export const CHAIN_BEHAVIOR: WeaponBehavior<ChainWeaponDef> = {
  init(weapon, def) {
    weapon.cooldown = def.cooldown;
    weapon.count = def.count;
    weapon.range = def.range;
    weapon.jumps = def.jumps;
    weapon.jumpRange = def.jumpRange;
    weapon.falloff = def.falloff;
    weapon.bolts = new Float64Array(MAX_BOLTS * BOLT_STRIDE).fill(-Infinity);
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
    // La Taille allonge les sauts.
    weapon.jumpRange = def.jumpRange * (mods.sizeMult ?? 1);
    weapon.falloff = m?.falloff ?? def.falloff;
    weapon.cooldown = scaledCooldown(def.cooldown, t.cooldownPct, m, mods);
  },

  update(weapon, _def, ctx) {
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
    // Orage : des chaînes partent aussi d'ennemis tirés au hasard autour du joueur.
    const storm = weapon.mutation?.randomStrikes;
    for (let s = 0; storm && s < storm.count; s++) {
      const start = randomFree(ctx, x, y, storm.range);
      if (!start) break;
      // La foudre tombe du ciel sur la cible (effet du pack), puis la chaîne repart de là.
      ctx.events.onEffect?.('strike', start.x, start.y, STRIKE_SIZE);
      runChain(weapon, ctx, start, start.x, start.y);
    }
    weapon.cooldownTimer = weapon.cooldown;
    ctx.events.onFire?.(weapon);
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
