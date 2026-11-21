import { HP_BARS } from '../data/feel';

/** Ce qu'il faut pour suivre la traînée d'une barre de PV (joueur, boss, élites). */
export interface HpTrailState {
  readonly hp: number;
  readonly maxHp: number;
  /** PV affichés par la traînée claire (≥ hp) */
  hpTrail: number;
  /** s restantes avant que la traînée commence à fondre */
  hpTrailHold: number;
}

/**
 * Traînée de dégâts (dans l'update : c'est un état, même s'il ne sert qu'au dessin). Un soin la
 * remet sur les PV ; un coup la laisse en place `hold` s, puis elle fond vers les PV. Le délai ne
 * repart que quand elle a rattrapé les PV : sous des coups continus (boss), elle fond quand même.
 */
export function updateHpTrail(s: HpTrailState, dt: number): void {
  const t = HP_BARS.trail;
  if (s.hp >= s.hpTrail) {
    s.hpTrail = s.hp;
    s.hpTrailHold = t.hold;
    return;
  }
  if (s.hpTrailHold > 0) {
    s.hpTrailHold -= dt;
    return;
  }
  const speed = Math.max((s.hpTrail - s.hp) * t.rate, s.maxHp * t.minRate);
  s.hpTrail = Math.max(s.hp, s.hpTrail - speed * dt);
}
