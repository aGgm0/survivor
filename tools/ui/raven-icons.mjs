// Icônes du pack Raven Fantasy Icons utilisées par le jeu. Partagé par copy-raven.mjs (copie)
// et icons-preview.html (planche) : un seul endroit où changer un choix.

/** Par sorte : id dans le jeu → numéro de l'icône dans le pack (fichiers `faN.png`, en 16 × 16). */
export const ICON_GROUPS = {
  Armes: {
    arcaneBolt: 783, // comète bleue
    burningAura: 758, // spirale de feu
    runicOrbs: 776, // cercle runique violet
    sword: 156, // épée bleue
  },
  Mutations: {
    piercingBolt: 1010, // lance de glace
    burstBolt: 774, // éclat violet
    furnace: 767, // explosion de feu (ex-Brasier)
    frostAura: 787, // flocon de glace qui rayonne
    giantOrbs: 773, // anneau violet
    orbStorm: 786, // tourbillon bleu
    whirlwind: 725, // coup en tourbillon
    thrust: 728, // épée pointée qui scintille (coup d'estoc)
  },
  Passifs: {
    vitality: 659, // cœur
    swiftness: 667, // botte ailée
    attraction: 118, // aimant
    power: 657, // bras musclé
    haste: 1025, // éclair
    impact: 1044, // marteau doré
    size: 865, // flèche vers le haut
    velocity: 1018, // trait rapide
    duplicator: 969, // éclats en double
    penetration: 870, // bouclier fendu orange, flèche rouge
  },
  // Résistances des ennemis, à côté des barres de PV du boss et des élites (0.3). Les malus
  // (flèche rouge) attendent un effet qui baisse l'armure d'un ennemi (enchantements, 0.4).
  Résistances: {
    'armor-physical': 597, // bouclier gris
    'armor-magical': 598, // bouclier bleu
    'armor-physical-down': 621, // bouclier gris, flèche rouge
    'armor-magical-down': 622, // bouclier bleu, flèche rouge
  },
  // Cartes de fin de build (tout est au maximum)
  'Fin de build': {
    heal: 281, // potion rouge (comme la nourriture au sol)
    gold: 158, // bourse
  },
};

/** Toutes les icônes : id dans le jeu → numéro dans le pack. */
export const ICONS = Object.assign({}, ...Object.values(ICON_GROUPS));
