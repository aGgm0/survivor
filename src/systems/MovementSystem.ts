import type { Pool } from '../core/Pool';
import { CROWD } from '../data/physics';
import type { Enemy } from '../entities/Enemy';
import { MAX_ENEMY_RADIUS, type CollisionSystem } from './CollisionSystem';
import { slowFactor } from './status';

/**
 * Mouvement de la horde par "steering" : on ne déplace pas les ennemis directement, on
 * ajuste leur VITESSE, qui ne peut changer que progressivement (accélération limitée).
 * C'est ce qui rend le mouvement fluide, même quand ils se bousculent.
 *
 * Chaque update, pour chaque ennemi :
 * 1. Envie : une vitesse vers le joueur (sa vitesse de base).
 * 2. Répulsion : chaque voisin qui le chevauche le pousse, d'autant plus fort que le voisin est
 *    lourd par rapport à lui. Un tank écarte les petits ; les petits ne font presque rien au tank.
 * 3. Écart latéral : si un plus gros, derrière lui, le pousse vers le joueur, le petit est poussé
 *    sur le CÔTÉ plutôt que vers l'avant, et insiste moins pour avancer (selon la force de la
 *    poussée). Ça ouvre un passage au gros au lieu de bloquer.
 * 4. La vitesse se rapproche de (envie + répulsion), sans dépasser l'accélération max.
 */
export class MovementSystem {
  private readonly neighbors: Enemy[];
  // Les nouvelles vitesses sont toutes calculées AVANT d'être appliquées : chaque ennemi voit
  // les positions de la même update, donc le résultat ne dépend pas de l'ordre de la liste.
  private readonly nextVx: Float64Array;
  private readonly nextVy: Float64Array;

  constructor(
    capacity: number,
    private readonly collisions: CollisionSystem,
  ) {
    this.neighbors = new Array<Enemy>(capacity);
    this.nextVx = new Float64Array(capacity);
    this.nextVy = new Float64Array(capacity);
  }

  /** `collisions.rebuild()` doit avoir été appelé juste avant (grille à jour). */
  /** `now` = temps de partie (s), pour savoir si un ralentissement est encore actif. */
  update(enemies: Pool<Enemy>, targetX: number, targetY: number, dt: number, now = 0): void {
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (e?.active) this.steer(e, i, targetX, targetY, dt, now);
    }
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e?.active) continue;
      e.syncPrevious();
      e.vx = this.nextVx[i] ?? 0;
      e.vy = this.nextVy[i] ?? 0;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }

  private steer(
    e: Enemy,
    index: number,
    targetX: number,
    targetY: number,
    dt: number,
    now: number,
  ): void {
    // Mobilier : ne bouge jamais. On écrit bien 0 dans nextVx/nextVy : sinon la case gardait la
    // vitesse de l'ennemi qui occupait cette place du pool avant, et la caisse glissait.
    if (e.type.prop) {
      this.nextVx[index] = 0;
      this.nextVy[index] = 0;
      return;
    }
    // 1. Envie : direction unitaire (px, py) vers le joueur.
    const toTargetX = targetX - e.x;
    const toTargetY = targetY - e.y;
    const distToTarget = Math.hypot(toTargetX, toTargetY);
    const px = distToTarget === 0 ? 0 : toTargetX / distToTarget;
    const py = distToTarget === 0 ? 0 : toTargetY / distToTarget;
    // Vitesse de base × palier de la vague (fin de partie) × ralentissement éventuel.
    const speed = e.type.speed * e.speedMult * slowFactor(e, now);

    // 2 et 3. Répulsion des voisins qui chevauchent.
    let sepX = 0;
    let sepY = 0;
    /** 0 = rien ne me pousse par derrière ; plus c'est haut, plus je laisse passer. */
    let yieldAmount = 0;
    /** 0 = voie libre devant ; plus c'est haut, plus je suis bloqué par un voisin devant. */
    let blockAmount = 0;
    const myMass = e.mass;
    const count = this.collisions.queryNeighbors(
      e.x,
      e.y,
      e.type.radius + MAX_ENEMY_RADIUS,
      this.neighbors,
    );
    for (let j = 0; j < count; j++) {
      const other = this.neighbors[j];
      if (!other || other === e) continue;
      const minDist = e.type.radius + other.type.radius;
      let nx = e.x - other.x;
      let ny = e.y - other.y;
      const dist = Math.hypot(nx, ny);
      if (dist >= minDist) continue;
      if (dist === 0) {
        // Exactement superposés : direction arbitraire mais fixe (partie reproductible).
        nx = Math.cos(e.id);
        ny = Math.sin(e.id);
      } else {
        nx /= dist;
        ny /= dist;
      }

      const otherMass = other.mass;
      const overlapRatio = (minDist - dist) / minDist; // 0 = effleure, 1 = superposés
      // File d'attente : un voisin aussi gros ou plus gros que moi, DEVANT moi (entre moi et
      // le joueur), me bloque. Je cesse de pousser au lieu d'écraser la foule contre lui.
      // (Un gros derrière des petits, lui, continue de pousser : c'est voulu.)
      if (otherMass >= myMass && nx * px + ny * py < -CROWD.queueConeCos) {
        if (overlapRatio > blockAmount) blockAmount = overlapRatio;
      }
      if (otherMass > myMass && pushesTowardTarget(nx, ny, px, py)) {
        const otherToTarget = Math.hypot(targetX - other.x, targetY - other.y);
        if (otherToTarget > distToTarget) {
          // Un plus gros derrière moi me rentre dedans : plus il pousse fort, moins j'insiste
          // pour avancer (je me laisse déborder). N'arrive que dans la mêlée : en terrain
          // dégagé, un gros (plus lent) ne rattrape jamais un petit.
          const pressure = (overlapRatio * (otherMass - myMass)) / (otherMass + myMass);
          if (pressure > yieldAmount) yieldAmount = pressure;
          // Et sa poussée m'écarte sur le côté au lieu de m'écraser vers le joueur.
          const along = nx * px + ny * py;
          nx -= along * px;
          ny -= along * py;
          const len = Math.hypot(nx, ny);
          if (len < 1e-6) {
            // Pile dans l'axe : on choisit un côté selon l'id (déterministe).
            const side = e.id % 2 === 0 ? 1 : -1;
            nx = -py * side;
            ny = px * side;
          } else {
            nx /= len;
            ny /= len;
          }
        }
      }

      // Part de la poussée que je subis : 1 entre égaux, proche de 2 pour un petit contre un
      // tank, proche de 0 pour un tank contre un petit. L'exposant `massContrast` accentue
      // l'écart (avec 2 : un rapide ne freine un tank qu'à 0,06 au lieu de 0,3).
      const myM = myMass ** CROWD.massContrast;
      const otherM = otherMass ** CROWD.massContrast;
      const weight = (2 * otherM) / (myM + otherM);
      // Répulsion qui se raidit : r / (1 - r) vaut ~r quand ils se frôlent, mais grimpe vite
      // quand ils s'enfoncent (×3 à 75 %). Sans ça, la pression de la foule écrase les
      // ennemis les uns dans les autres (les tanks finissaient fondus en une seule masse).
      const stiffOverlap = overlapRatio / (1 - Math.min(overlapRatio, CROWD.maxStiffOverlap));
      const push = stiffOverlap * weight * CROWD.separationSpeed;
      sepX += nx * push;
      sepY += ny * push;
    }

    const sepLen = Math.hypot(sepX, sepY);
    if (sepLen > CROWD.maxSeparationSpeed) {
      const k = CROWD.maxSeparationSpeed / sepLen;
      sepX *= k;
      sepY *= k;
    }

    // 4. Accélération limitée vers la vitesse voulue.
    const desire =
      speed *
      (1 - Math.min(1, yieldAmount * CROWD.yieldStrength)) *
      (1 - Math.min(1, blockAmount * CROWD.queueStrength));
    let dvx = px * desire + sepX - e.vx;
    let dvy = py * desire + sepY - e.vy;
    const dvLen = Math.hypot(dvx, dvy);
    const maxDv = CROWD.maxAcceleration * dt;
    if (dvLen > maxDv) {
      dvx *= maxDv / dvLen;
      dvy *= maxDv / dvLen;
    }
    this.nextVx[index] = e.vx + dvx;
    this.nextVy[index] = e.vy + dvy;
  }
}

/** Vrai si la poussée (nx, ny) a une composante vers la cible (px, py). */
function pushesTowardTarget(nx: number, ny: number, px: number, py: number): boolean {
  return nx * px + ny * py > 0;
}
