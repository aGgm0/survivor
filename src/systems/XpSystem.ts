import { xpToNext } from '../data/progression';

/** Niveau du joueur et XP accumulée vers le niveau suivant. */
export class XpSystem {
  level = 1;
  /** XP déjà gagnée dans le niveau en cours (repart de 0 à chaque level up, le surplus est gardé) */
  xpIntoLevel = 0;
  /** XP totale de la partie (stats de fin) */
  totalXp = 0;
  /**
   * Multiplicateur de l'XP requise. La scène le passe à MAXED_XP_MULT quand plus rien n'est
   * améliorable : sinon les level up "soin" s'enchaînent et rendent le joueur intuable.
   */
  xpMult = 1;

  get xpForNext(): number {
    return xpToNext(this.level) * this.xpMult;
  }

  /** Remplissage de la barre d'XP, de 0 à 1. */
  get progress(): number {
    return this.xpIntoLevel / this.xpForNext;
  }

  /**
   * Ajoute de l'XP et renvoie le nombre de niveaux gagnés (souvent 0 ou 1, parfois plus
   * avec une grosse gemme). Le surplus passe au niveau suivant : rien n'est perdu.
   */
  addXp(amount: number): number {
    if (amount <= 0) return 0;
    this.totalXp += amount;
    this.xpIntoLevel += amount;
    let gained = 0;
    while (this.xpIntoLevel >= this.xpForNext) {
      this.xpIntoLevel -= this.xpForNext;
      this.level++;
      gained++;
    }
    return gained;
  }
}
