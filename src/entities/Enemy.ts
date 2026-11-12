import { lerp } from '../core/math';
import type { Poolable } from '../core/Pool';
import { ENEMY_TYPES, type EnemyType } from '../data/enemies';
import { MAX_ORBS } from '../data/weapons';
import type { Weapon } from './Weapon';

/** Un ennemi. Les instances vivent dans un Pool : on ne les crée jamais en cours de partie. */
export class Enemy implements Poolable {
  active = false;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  /** Vitesse actuelle en px/s. Elle évolue progressivement (voir MovementSystem). */
  vx = 0;
  vy = 0;
  hp = 0;
  /** PV au moment du spawn (pour la barre de vie du boss) */
  maxHp = 0;
  /** Multiplicateur de la vague au spawn : un ennemi plus résistant rapporte autant de fois plus d'XP. */
  xpMult = 1;
  /** Multiplicateur de vitesse de la vague au spawn (paliers de fin de partie) */
  speedMult = 1;
  type: EnemyType = ENEMY_TYPES.basic;
  /** Index dans BOSS_SPAWNS pour un boss prévu (0 = 5:00, 1 = 9:00) ; -1 sinon (défis des persos) */
  bossIndex = -1;
  // Capacités de boss (voir BossAbilitySystem). Dates en temps de partie, comme les autres délais.
  /** Charge : rien, arrêt annoncé (ligne rouge), ou charge en ligne droite */
  chargeState: 'none' | 'windup' | 'dash' = 'none';
  /** Fin de l'étape de charge en cours */
  chargeUntil = 0;
  nextChargeAt = Infinity;
  /** Direction de la charge, fixée au début de l'annonce (longueur 1) */
  chargeDirX = 0;
  chargeDirY = 0;
  /** Invocation : prochaine, et fin de l'annonce en cours (0 = pas d'annonce) */
  nextSummonAt = Infinity;
  summonAt = 0;
  /** Délais des capacités × ce facteur (boss du sans fin : de plus en plus rapides) */
  abilityRate = 1;
  /** Instant (temps de partie, en s) à partir duquel il peut de nouveau toucher le joueur. */
  nextContactHitAt = 0;
  /** Instant (temps de partie, en s) jusqu'auquel il est affiché en blanc (vient d'être touché). */
  flashUntil = -Infinity;
  /**
   * Pour chaque orbe (index = n° de l'orbe) : instant à partir duquel il peut de nouveau le
   * toucher. Tableau typé créé une seule fois avec l'ennemi : aucune allocation en jeu.
   */
  readonly orbitHitAt = new Float64Array(MAX_ORBS);
  /** Instant (temps de partie, en s) à partir duquel l'aura peut de nouveau le brûler. */
  nextAuraHitAt = 0;

  // Effets d'état (voir systems/status.ts). Chacun a une date de fin en temps de partie.
  /** Fraction de vitesse retirée (0,3 = 30 % plus lent) tant que `now < slowUntil` */
  slowAmount = 0;
  slowUntil = 0;
  /** Dégâts de poison par seconde tant que `now < poisonUntil` */
  poisonDps = 0;
  poisonUntil = 0;
  nextPoisonTickAt = 0;
  /** Arme qui a empoisonné l'ennemi : les dégâts de poison comptent pour elle (damage meter) */
  poisonSource: Weapon | null = null;

  /**
   * @param id identifiant stable = place dans le pool. Sert de départage déterministe
   * (ex. ennemis superposés). Pas un compteur global : sinon une partie relancée avec la même
   * seed aurait d'autres ids, donc un autre déroulement.
   */
  constructor(readonly id: number = 0) {}

  /**
   * Réinitialise TOUT l'état : un ennemi recyclé ne doit rien garder de sa vie précédente.
   * `hpMult` / `speedMult` : les vagues tardives donnent plus de PV et de vitesse (voir waves.ts).
   */
  spawn(type: EnemyType, x: number, y: number, hpMult = 1, speedMult = 1): void {
    this.speedMult = speedMult;
    this.type = type;
    this.bossIndex = -1;
    this.chargeState = 'none';
    this.chargeUntil = 0;
    this.nextChargeAt = Infinity;
    this.nextSummonAt = Infinity;
    this.summonAt = 0;
    this.abilityRate = 1;
    this.maxHp = type.hp * hpMult;
    this.hp = this.maxHp;
    // Plus de PV à percer = plus d'XP : sinon monter de niveau ralentit à chaque vague.
    this.xpMult = hpMult;
    this.nextContactHitAt = 0;
    this.flashUntil = -Infinity; // jamais flashé : le 1er coup flashe toujours
    this.orbitHitAt.fill(0);
    this.nextAuraHitAt = 0;
    this.slowAmount = 0;
    this.slowUntil = 0;
    this.poisonDps = 0;
    this.poisonUntil = 0;
    this.nextPoisonTickAt = 0;
    this.poisonSource = null;
    this.teleport(x, y);
  }

  /**
   * Déplace sans interpolation (sinon on le verrait "glisser" depuis l'ancienne position).
   * La vitesse repart de zéro : l'ancienne direction n'a plus de sens au nouvel endroit.
   */
  teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.syncPrevious();
  }

  /** Masse = rayon² (proportionnelle à la surface) : plus il est gros, plus il pousse. */
  get mass(): number {
    return this.type.radius * this.type.radius;
  }

  syncPrevious(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }

  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha);
  }
}
