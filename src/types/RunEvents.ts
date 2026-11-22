// Ce qui se passe pendant une partie, annoncé par les règles (GameScene, systèmes) à qui veut
// l'entendre. Aujourd'hui un seul écouteur : Feedback (son, tremblement, particules, nombres
// de dégâts). Les règles ne savent pas ce qu'on en fait : la simulation tourne sans aucun effet.
// Des méthodes plutôt que des objets « événement » : aucune allocation par événement.

import type { Enemy } from '../entities/Enemy';
import type { Weapon } from '../entities/Weapon';
import type { HitKind } from '../systems/damage';

export interface RunEvents {
  /** Un ennemi (ou une caisse) vient d'être touché, coup fatal compris */
  enemyHit(enemy: Enemy, damage: number, kind: HitKind, source: Weapon): void;
  /** Un ennemi tombe (pas le mobilier : voir `crateBroken`) */
  enemyKilled(enemy: Enemy): void;
  /** Une caisse ou un tonneau est cassé */
  crateBroken(x: number, y: number): void;
  /** Le joueur prend un coup d'un ennemi au contact */
  playerHit(): void;
  /** Un ou plusieurs niveaux gagnés d'un coup, le joueur en (x, y) */
  levelUp(x: number, y: number): void;
  /** Ramassages de cette update */
  gemsPicked(): void;
  goldPicked(): void;
  healed(): void;
  /** Capacités des boss : début d'une charge, annonce d'une charge, annonce d'une invocation */
  bossCharge(): void;
  chargeWarning(): void;
  summonWarning(): void;
  /** Explosion (Trait éclaté) */
  explosion(x: number, y: number, radius: number, color: string): void;
  /** Départ d'une onde de feu (Fournaise) */
  auraPulse(x: number, y: number, radius: number): void;
  /** Coup d'épée en arc, ou d'estoc. `angle` = direction, `arc` = ouverture (rad) */
  slash(x: number, y: number, angle: number, arc: number, range: number, color: string): void;
  thrust(x: number, y: number, angle: number, arc: number, range: number, color: string): void;
  /** Une arme à projectiles vient de tirer */
  fired(): void;
  /** Un choix validé dans un écran de la partie (carte de level up, relance) */
  uiClick(): void;
}
