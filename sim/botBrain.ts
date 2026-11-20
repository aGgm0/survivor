// Cerveau du bot : où aller (fuir la horde, ramasser l'XP et la nourriture, esquiver la charge
// des boss) et quelle carte prendre au level up. Volontairement simple : il sert à COMPARER deux
// versions du jeu sur les mêmes seeds, pas à jouer comme un humain.

import type { Rng } from '../src/core/math';
import type { GameScene } from '../src/scenes/GameScene';

/** Réglages du bot (sa « prudence »), à ajuster pour qu'il ressemble à un joueur moyen. */
export const BOT = {
  /** px : au-delà (bord à bord), un ennemi est ignoré */
  fearRadius: 260,
  /** px : on ne va chercher une gemme ou de la nourriture que dans ce rayon */
  lootRadius: 450,
  /** s : le bot juge chaque direction par la position où elle le mène dans ce délai */
  lookAhead: 0.4,
  /** Nombre de directions essayées (16 : plus fin que les 8 du clavier, arrondies ensuite) */
  candidates: 16,
  /** Poids du danger : un basique à 45 px (bord à bord) de la position visée coûte ~1 */
  dangerScale: 45 ** 2 / 1.5,
  /** Bonus pour aller vers la gemme la plus proche */
  lootPull: 1,
  /** Nourriture : bien plus attirante quand il manque des PV */
  foodPull: 1.5,
  /**
   * Bonus pour tourner autour de la horde (direction perpendiculaire à « horde → joueur ») : le
   * bot repasse sur les gemmes qu'il a laissées au lieu de fuir en ligne droite.
   */
  orbitPull: 0.4,
  /** Charge de boss annoncée : coût d'une position sur sa ligne */
  chargeCost: 4,
  /** s entre deux décisions : temps de réaction d'un humain (~0,1 s) */
  thinkEvery: 0.1,
} as const;

export interface Direction {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

/** Arrondit un vecteur aux 8 directions du clavier (sous un seuil : ne bouge pas). */
function toKeys(vx: number, vy: number): Direction {
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return { x: 0, y: 0 };
  const sector = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
  const ax = Math.round(Math.cos(sector * (Math.PI / 4)));
  const ay = Math.round(Math.sin(sector * (Math.PI / 4)));
  return { x: ax as -1 | 0 | 1, y: ay as -1 | 0 | 1 };
}

/** Danger à la position (x, y) : somme des ennemis proches, plus proches = bien plus dangereux. */
function dangerAt(scene: GameScene, x: number, y: number): number {
  const p = scene.player;
  let danger = 0;
  for (const e of scene.enemies.items) {
    if (!e.active || e.type.prop) continue;
    const gap = Math.hypot(x - e.x, y - e.y) - e.type.radius - p.radius;
    if (gap > BOT.fearRadius) continue;
    danger += (1 + e.type.contactDamage / 10) / Math.max(gap, 6) ** 2;
    // Charge annoncée : rester sur sa ligne (devant le boss) est très risqué.
    if (e.chargeState === 'windup') {
      const along = (x - e.x) * e.chargeDirX + (y - e.y) * e.chargeDirY;
      const across = Math.abs((x - e.x) * -e.chargeDirY + (y - e.y) * e.chargeDirX);
      if (along > 0 && across < e.type.radius + p.radius + 20) danger += BOT.chargeCost / 1000;
    }
  }
  return danger * BOT.dangerScale;
}

/** Cible de butin : nourriture si blessé, sinon la gemme la plus proche (null : rien en vue). */
function lootTarget(scene: GameScene): { x: number; y: number; pull: number } | null {
  const p = scene.player;
  const missingHp = 1 - p.hp / p.maxHp;
  let best: number = BOT.lootRadius;
  let target: { x: number; y: number; pull: number } | null = null;
  if (missingHp >= 0.2) {
    for (const it of scene.pickups.items) {
      if (!it.active || it.kind !== 'food') continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < best) {
        best = d;
        target = { x: it.x, y: it.y, pull: BOT.foodPull * missingHp * 2 };
      }
    }
  }
  if (target) return target;
  for (const g of scene.gems.gems.items) {
    if (!g.active) continue;
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < best) {
      best = d;
      target = { x: g.x, y: g.y, pull: BOT.lootPull };
    }
  }
  return target;
}

/** Direction voulue par le bot : la moins dangereuse, avec un bonus vers le butin et en cercle. */
export function decideMove(scene: GameScene): Direction {
  const p = scene.player;
  const step = p.speed * BOT.lookAhead;

  // Centre de la horde proche : pour tourner autour (sens fixe).
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (const e of scene.enemies.items) {
    if (!e.active || e.type.prop) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) > BOT.fearRadius * 2) continue;
    cx += e.x;
    cy += e.y;
    n++;
  }
  let tx = 0;
  let ty = 0;
  if (n > 0) {
    const ax = p.x - cx / n;
    const ay = p.y - cy / n;
    const d = Math.hypot(ax, ay) || 1;
    tx = -ay / d;
    ty = ax / d;
  }

  const loot = lootTarget(scene);
  let lx = 0;
  let ly = 0;
  if (loot) {
    const d = Math.hypot(loot.x - p.x, loot.y - p.y) || 1;
    lx = ((loot.x - p.x) / d) * loot.pull;
    ly = ((loot.y - p.y) / d) * loot.pull;
  }

  // Rester sur place est aussi un choix (score de référence).
  let bestX = 0;
  let bestY = 0;
  let bestScore = dangerAt(scene, p.x, p.y);
  for (let i = 0; i < BOT.candidates; i++) {
    const a = (i / BOT.candidates) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const score =
      dangerAt(scene, p.x + dx * step, p.y + dy * step) -
      (dx * lx + dy * ly) -
      BOT.orbitPull * (dx * tx + dy * ty);
    if (score < bestScore) {
      bestScore = score;
      bestX = dx;
      bestY = dy;
    }
  }
  return toKeys(bestX, bestY);
}

/** Level up : une des cartes au hasard, comme un joueur qui ne connaît pas la méta. */
export function pickUpgrade(scene: GameScene, rng: Rng): number {
  return rng.int(0, scene.currentChoices.length - 1);
}
