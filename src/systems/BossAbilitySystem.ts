import type { Pool } from '../core/Pool';
import { BOSS_ABILITIES, BOSS_TYPE } from '../data/waves';
import type { Enemy } from '../entities/Enemy';
import type { SpawnSystem } from './SpawnSystem';

/**
 * Capacités des boss : charge et invocation (réglages dans BOSS_ABILITIES).
 * Chaque capacité passe par une étape d'ANNONCE (dessinée par la scène) avant d'agir :
 * c'est ce qui permet au joueur de l'esquiver. Le mouvement pendant la charge est géré par
 * MovementSystem, qui lit `chargeState`.
 */
export class BossAbilitySystem {
  update(
    enemies: Pool<Enemy>,
    now: number,
    playerX: number,
    playerY: number,
    spawner: Pick<SpawnSystem, 'summonAround'>,
  ): number {
    let charges = 0;
    for (const e of enemies.items) {
      if (!e.active || e.type !== BOSS_TYPE) continue;
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
        e.chargeUntil = now + c.windup;
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
      if (now >= e.nextSummonAt) e.summonAt = now + s.cast;
      return;
    }
    if (now < e.summonAt) return;
    spawner.summonAround(e.x, e.y, now);
    e.summonAt = 0;
    e.nextSummonAt = now + s.interval * e.abilityRate;
  }
}
