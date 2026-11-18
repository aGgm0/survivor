// Stats de base du joueur (voir CLAUDE.md § 5.2).
export const PLAYER_BASE = {
  maxHp: 100,
  /** px/s */
  speed: 200,
  /** px, rayon dans lequel les gemmes d'XP sont attirées */
  pickupRadius: 60,
  /** réduction plate des dégâts reçus */
  armor: 0,
  /** PV rendus par seconde (régénération de base : 0.1 = 6 PV par minute) */
  regen: 0.1,
  /** px, taille du joueur (affichage et future hitbox) */
  radius: 16,
} as const;
