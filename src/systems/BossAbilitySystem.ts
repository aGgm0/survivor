import type { Pool } from '../core/Pool';
import { BOSS_ABILITIES } from '../data/waves';
import type { Enemy } from '../entities/Enemy';
import type { SpawnSystem } from './SpawnSystem';

/**
 * Vitesse de la charge (px/s). Le boss de 9:00 marche ×2 mais charge sur ×1,2 (`dashSpeedMult`) :
 * le mouvement ET l'annonce passent par ici, pour que la ligne annoncée soit la vraie trajectoire.
 */
export function chargeSpeed(e: Enemy): number {
  return e.type.speed * (e.dashSpeedMult || e.speedMult) * BOSS_ABILITIES.charge.speedMult;
}

/** Distance parcourue pendant la charge (px) : longueur de l'annonce. */
export function chargeDistance(e: Enemy): number {
  return chargeSpeed(e) * BOSS_ABILITIES.charge.duration;
}

/**
 * Capacités des boss : charge et invocation (réglages dans BOSS_ABILITIES).
 * Chaque capacité passe par une étape d'ANNONCE (dessinée par la scène) avant d'agir :
 * c'est ce qui permet au joueur de l'esquiver. Le mouvement pendant la charge est géré par
 * MovementSystem, qui lit `chargeState`.
 */
export class BossAbilitySystem {
  /** Charges annoncées pendant la dernière update (la scène joue le son d'avertissement). */
  chargeWarnings = 0;
  /** Invocations annoncées pendant la dernière update */
  summonWarnings = 0;

  update(
    enemies: Pool<Enemy>,
    now: number,
    playerX: number,
    playerY: number,
    spawner: Pick<SpawnSystem, 'summonAround'>,
  ): number {
    let charges = 0;
    this.chargeWarnings = 0;
    this.summonWarnings = 0;
    for (const e of enemies.items) {
      if (!e.active || !e.type.boss) continue;
      if (this.updateCharge(e, now, playerX, playerY)) charges++;
      this.updateSummon(e, now, spawner);
    }
    return charges;
  }

  /**
   * none → windup (arrêt + ligne rouge) → dash (ligne droite) → none.
   * Renvoie vrai quand le boss se lance (la scène fait trembler l'écran).
   */
  private updateCharge(e: Enemy, now: number, playerX: number, playerY: number): boolean {
    const c = BOSS_ABILITIES.charge;
    switch (e.chargeState) {
      case 'none': {
        if (now < e.nextChargeAt) return false;
        // Direction fixée MAINTENANT : la ligne rouge montre exactement où il va foncer.
        const dx = playerX - e.x;
        const dy = playerY - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        e.chargeDirX = dx / dist;
        e.chargeDirY = dy / dist;
        e.chargeState = 'windup';
        e.chargeUntil = now + (e.chargeWindup || c.windup);
        this.chargeWarnings++;
        return false;
      }
      case 'windup':
        if (now < e.chargeUntil) return false;
        e.chargeState = 'dash';
        e.chargeUntil = now + c.duration;
        return true;
      case 'dash':
        if (now < e.chargeUntil) return false;
        e.chargeState = 'none';
        e.nextChargeAt = now + c.interval * e.abilityRate;
        return false;
    }
  }

  /** Annonce (cercle violet qui grandit) puis sbires autour du boss. */
  private updateSummon(e: Enemy, now: number, spawner: Pick<SpawnSystem, 'summonAround'>): void {
    const s = BOSS_ABILITIES.summon;
    if (e.summonAt === 0) {
      if (now >= e.nextSummonAt) {
        e.summonAt = now + s.cast;
        this.summonWarnings++;
      }
      return;
    }
    if (now < e.summonAt) return;
    spawner.summonAround(e.x, e.y, now);
    e.summonAt = 0;
    e.nextSummonAt = now + s.interval * e.abilityRate;
  }
}
