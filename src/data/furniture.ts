// Mobilier cassable, or et nourriture (voir CLAUDE.md § 5.9).

export const FURNITURE = {
  /** s entre deux apparitions de mobilier */
  spawnInterval: 15,
  /** Mobilier présent en même temps, au maximum */
  maxActive: 8,
  /** Chances qu'un meuble cassé lâche de l'or (sinon de la nourriture). 0,85 → 0,7 : on manquait de soins */
  goldChance: 0.7,
  /** Pièces lâchées : entre min et max... */
  goldMin: 1,
  goldMax: 3,
  /** ...+1 toutes les `goldBonusEvery` secondes de partie (un peu plus en fin de partie) */
  goldBonusEvery: 300,
  /** PV rendus par la nourriture */
  foodHeal: 20,
  /** Or donné directement à la mort d'un boss */
  bossGold: 25,
  /** Un élite tué lâche toujours de la nourriture (récompense après un combat dur) */
  eliteFood: true,
} as const;

/** Objets au sol (pièces, nourriture) : apparence et aimant. */
export const PICKUPS = {
  poolSize: 200,
  goldColor: '#ffd54f',
  goldRadius: 6,
  foodColor: '#ff6f61',
  foodRadius: 8,
} as const;
