// Icônes du pack Raven Fantasy Icons utilisées par le jeu. Partagé par copy-raven.mjs (copie)
// et icons-preview.html (planche) : un seul endroit où changer un choix.

/** Par sorte : id dans le jeu → numéro de l'icône dans le pack (fichiers `faN.png`, en 16 × 16). */
export const ICON_GROUPS = {
  Armes: {
    arcaneBolt: 783, // comète bleue
    burningAura: 758, // spirale de feu
    runicOrbs: 776, // cercle runique violet
    sword: 156, // épée bleue
    bow: 1564, // arc
    throwingAxe: 1464, // petite hache (1457 jusqu'au 2026-11-27)
    caltrops: 1016, // pointes qui sortent du sol
    chainLightning: 1025, // éclair (celui de la Hâte jusqu'au 2026-11-23)
  },
  Mutations: {
    piercingBolt: 1010, // lance de glace
    burstBolt: 774, // éclat violet
    furnace: 767, // explosion de feu (ex-Brasier)
    frostAura: 788, // comète de glace (787 jusqu'au 2026-11-27 : même étoile que la Fournaise)
    giantOrbs: 830, // amas de grosses bulles violettes (773 jusqu'au 2026-11-27 : même spirale que la Tempête)
    orbStorm: 826, // croissant violet qui tourne (786 jusqu'au 2026-11-27)
    whirlwind: 725, // coup en tourbillon
    thrust: 728, // épée pointée qui scintille (coup d'estoc)
    heavyArrow: 401, // flèche à pointe d'acier
    volley: 1136, // pluie de flèches
    mines: 764, // bombe à mèche
    brambles: 251, // rameau épineux (241 jusqu'au 2026-11-27 : on aurait dit des ciseaux)
    twinAxes: 1467, // grande hache à double tranchant (1458 jusqu'au 2026-11-27 : comme la Hache de lancer)
    executionerAxe: 1547, // grosse hache double orange (1539 jusqu'au 2026-11-27)
    thunderstorm: 1031, // nuage d'orage
    unbrokenArc: 1037, // arcs entrelacés
  },
  Passifs: {
    vitality: 659, // cœur
    swiftness: 667, // botte ailée
    attraction: 118, // aimant
    power: 657, // bras musclé
    haste: 98, // grimoire ouvert (lancer plus vite) ; l'éclair 1025 va à l'Éclair en chaîne
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
  // Boutique (2026-11-27) : les bonus de départ reprennent l'icône de leur passif.
  Boutique: {
    startVitality: 659, // cœur (Vitalité)
    startPower: 657, // bras musclé (Puissance)
    startSwiftness: 667, // botte ailée (Célérité)
    startAttraction: 118, // aimant (Attraction)
    wisdom: 101, // livre bleu fermé (la Hâte a le grimoire rouge ouvert)
  },
  // Cartes de fin de build (tout est au maximum)
  'Fin de build': {
    heal: 281, // potion rouge (comme la nourriture au sol)
    gold: 158, // bourse
  },
};

/** Toutes les icônes : id dans le jeu → numéro dans le pack. */
export const ICONS = Object.assign({}, ...Object.values(ICON_GROUPS));
