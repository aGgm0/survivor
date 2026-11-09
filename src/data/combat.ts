// Règles de combat générales (voir CLAUDE.md § 5.4).

/** Un coup fait toujours au moins ce montant, même contre beaucoup d'armure. */
export const MIN_DAMAGE = 1;

/**
 * s : un même ennemi ne peut toucher le joueur qu'une fois par cette durée. Chaque ennemi a son
 * propre délai (pas d'invincibilité globale) : plus il y a d'ennemis au contact, plus ça fait mal.
 */
export const CONTACT_HIT_COOLDOWN = 0.7;
