// Sprites du pack 0x72 DungeonTileset II (CC0, voir public/assets/LICENSES.md).
// Noms des animations : fichier tile_list_v1.7 du pack, sans le suffixe `_fN`.
import type { SpriteTint } from '../core/SpriteAtlas';
import type { ENEMY_TYPES } from './enemies';

const BASE = `${import.meta.env.BASE_URL}assets/sprites/0x72/`;

/** Barres de PV du monde : morceaux du pack Dark Ages (ignoré par git : absent = rectangles). */
export const HP_BAR_URLS = {
  frame: `${import.meta.env.BASE_URL}assets/ui/darkages/bar-body.png`,
  fill: `${import.meta.env.BASE_URL}assets/ui/darkages/bar-red.png`,
} as const;

/** Icône Raven (copiée par tools/ui/copy-raven.mjs, ignorée par git) */
export function ravenIconUrl(id: string): string {
  return `${import.meta.env.BASE_URL}assets/ui/raven/${id}.png`;
}

export const ATLAS_URLS = {
  image: `${BASE}0x72_DungeonTilesetII_v1.7.png`,
  list: `${BASE}tile_list_v1.7`,
} as const;

/**
 * Monstres faits maison à partir du pack (`node tools/sprites/tank-demon.mjs`), collés sous
 * l'atlas du pack au chargement : leurs animations se lisent comme celles du pack.
 */
export const MONSTERS_ATLAS_URLS = {
  image: `${import.meta.env.BASE_URL}assets/sprites/monsters/monsters.png`,
  list: `${import.meta.env.BASE_URL}assets/sprites/monsters/monsters_list`,
} as const;

/** Apparence d'une entité animée */
export interface SpriteDef {
  /** Animation à l'arrêt */
  readonly idle: string;
  /** Animation en mouvement */
  readonly run: string;
  /** Agrandissement (pixels nets) : ×2 pour tous, ×3 pour le boss et les élites */
  readonly scale: number;
  /** s par image d'animation */
  readonly frameTime: number;
  /** Teinte permanente (élites) */
  readonly tint?: SpriteTint;
  /** Apparence de secours si l'animation manque à l'atlas (monstre fait maison non chargé) */
  readonly fallback?: SpriteDef;
}

export const PLAYER_SPRITE: SpriteDef = {
  idle: 'wizzard_m_idle_anim',
  run: 'wizzard_m_run_anim',
  scale: 2,
  frameTime: 0.1,
};

/**
 * Apparence de chaque perso (id de data/characters.ts), en jeu et sur sa carte du menu.
 * `portraitY` : ligne de son animation de repos dans l'atlas (tile_list : x 128, 4 images de
 * 16 × 28 côte à côte), pour le portrait animé en CSS de l'écran de choix.
 */
export const CHARACTER_SPRITES: Readonly<
  Record<string, SpriteDef & { readonly portraitY: number }>
> = {
  arcanist: { ...PLAYER_SPRITE, portraitY: 164 },
  pyromancer: {
    idle: 'wizzard_f_idle_anim',
    run: 'wizzard_f_run_anim',
    scale: 2,
    frameTime: 0.1,
    portraitY: 132,
  },
  runist: {
    idle: 'elf_m_idle_anim',
    run: 'elf_m_run_anim',
    scale: 2,
    frameTime: 0.1,
    portraitY: 36,
  },
  bladeMage: {
    idle: 'knight_m_idle_anim',
    run: 'knight_m_run_anim',
    scale: 2,
    frameTime: 0.1,
    portraitY: 100,
  },
};

/** Silhouette blanche quand on prend un coup (joueur et ennemis) */
export const HIT_FLASH_TINT: SpriteTint = { color: '#ffffff', mode: 'silhouette' };
/** Filtre doré des mini-boss : on garde le dessin du monstre, mais il « brille » */
export const ELITE_TINT: SpriteTint = { color: '#ffd36b', mode: 'multiply' };

/**
 * Apparence de chaque type d'ennemi. Un type absent (mobilier) garde sa forme simple.
 * Les élites reprennent le sprite de leur version normale, ×3 et teintés.
 */
export const ENEMY_SPRITES: Partial<Record<keyof typeof ENEMY_TYPES, SpriteDef>> = {
  basic: { idle: 'chort_idle_anim', run: 'chort_run_anim', scale: 2, frameTime: 0.1 },
  fast: { idle: 'imp_idle_anim', run: 'imp_run_anim', scale: 2, frameTime: 0.08 },
  // Démon fait à partir de l'orc `ogre` du pack (tools/sprites/tank-demon.mjs), même animation.
  tank: {
    idle: 'tank_demon_idle_anim',
    run: 'tank_demon_run_anim',
    scale: 2,
    frameTime: 0.13,
    fallback: { idle: 'ogre_idle_anim', run: 'ogre_run_anim', scale: 2, frameTime: 0.13 },
  },
  boss: { idle: 'big_demon_idle_anim', run: 'big_demon_run_anim', scale: 3, frameTime: 0.13 },
  fastElite: {
    idle: 'imp_idle_anim',
    run: 'imp_run_anim',
    scale: 3,
    frameTime: 0.08,
    tint: ELITE_TINT,
  },
  crate: { idle: 'crate', run: 'crate', scale: 2, frameTime: 1 },
  basicElite: {
    idle: 'chort_idle_anim',
    run: 'chort_run_anim',
    scale: 3,
    frameTime: 0.1,
    tint: ELITE_TINT,
  },
};

/**
 * Sol : un motif de `size` × `size` dalles tirées au hasard (seed de la partie), préparé une
 * fois puis répété à l'infini. `weight` = chances relatives de chaque dalle.
 */
export const FLOOR = {
  tiles: [
    { name: 'floor_1', weight: 40 },
    { name: 'floor_2', weight: 1 },
    { name: 'floor_3', weight: 1 },
    { name: 'floor_4', weight: 1 },
    { name: 'floor_5', weight: 1 },
    { name: 'floor_6', weight: 1 },
    { name: 'floor_7', weight: 1 },
    { name: 'floor_8', weight: 1 },
  ],
  size: 16,
  scale: 2,
  /**
   * Assombrissement (0 à 1) : le sol doit rester en retrait derrière les monstres, mais assez
   * clair pour qu'ils s'en détachent (0,55 → 0,4 : retour de testeur, ennemis peu contrastés).
   */
  darken: 0.4,
} as const;

/** Atlas des effets, généré par `node tools/sprites/build.mjs` (ce que le pack 0x72 n'a pas). */
export const FX_ATLAS_URLS = {
  image: `${import.meta.env.BASE_URL}assets/sprites/fx/fx.png`,
  list: `${import.meta.env.BASE_URL}assets/sprites/fx/fx_list`,
} as const;

/** Gemme de chaque palier de GEM_TIERS (même ordre), dessinée ×2 */
export const GEM_SPRITES = ['gem_1', 'gem_2', 'gem_3'] as const;
/** Gemme verte boostée (voir BONUS_GEM dans data/xp.ts) */
export const BONUS_GEM_SPRITE = 'gem_bonus';
export const GEM_SCALE = 2;

/**
 * Projectile du Trait arcanique (gris, teint à la couleur de l'arme). Sa taille suit le rayon
 * de la hitbox : la tête du sprite (`headDiameter` px d'art) = le diamètre du projectile.
 */
export const BOLT_SPRITE = {
  anim: 'bolt_anim',
  headDiameter: 7,
  /** px d'art : centre de la tête, posé sur la position du projectile */
  headCenterX: 12,
  frameTime: 0.08,
} as const;

/**
 * Flèche (Arc) : sprite `weapon_arrow` du pack 0x72, vertical (pointe en haut), dessiné à sa
 * couleur (sans teinte ni halo) et tourné dans le sens du tir. `scale` : largeur ≈ la hitbox.
 */
/** Flèche en vol (effet du pack, en boucle, pointe sur la position du projectile) */
export const ARROW_FLIGHT_FX = { effect: 'arrowFlight', scale: 1 } as const;

export const ARROW_SPRITE = {
  frame: 'weapon_arrow',
  scale: 1.5,
  /** Le sprite pointe vers le haut : un quart de tour de plus que le sens du tir */
  rotation: Math.PI / 2,
} as const;

/** Hache de lancer : sprite `weapon_throwing_axe` du pack 0x72, qui tourne sur elle-même. */
export const THROWING_AXE_SPRITE = {
  frame: 'weapon_throwing_axe',
  /** rad/s de rotation */
  spin: 14,
} as const;

/**
 * Chausse-trapes : tuiles de pointes du pack (`floor_spikes_anim`, 4 images : rentrées → sorties)
 * posées en grille dans la zone ; bombe du pack pour les Mines.
 */
export const CALTROPS_SPRITE = {
  spikes: 'floor_spikes_anim',
  bomb: 'bomb',
  scale: 2,
  /** s pour sortir les pointes à la pose (puis les rentrer à la fin) */
  riseTime: 0.25,
  /** s par image de la bombe qui clignote */
  bombFrameTime: 0.15,
} as const;

/** Orbe runique (gris, teint) : son diamètre (`diameter` px d'art) = celui de la hitbox. */
export const ORB_SPRITE = { anim: 'orb_anim', diameter: 14, frameTime: 0.25 } as const;

// ---------------------------------------------------------------- effets PVFX Foundry (CC0)
// Style « strict » (pixels nets). Chaque dossier contient sprite-sheet.png + manifest.json.

const PVFX = `${import.meta.env.BASE_URL}assets/sprites/pvfx/`;

export const EFFECT_DIRS = {
  burst: `${PVFX}arcane-burst/`,
  slash: `${PVFX}axe-smear/`,
  // 0.3, bloc C (retour de jeu : « visuel trop simple, pas dans le thème de l'arme »)
  spikes: `${PVFX}earth-spike/`,
  clang: `${PVFX}metal-clang/`,
  barrel: `${PVFX}barrel-explosion/`,
  vines: `${PVFX}vine-snare/`,
  strike: `${PVFX}lightning-strike/`,
  // Demandés par l'utilisateur (2026-11-23) : neige dans l'Aura de givre, fouet électrique au
  // premier coup de l'Éclair en chaîne, éclair en chaîne à chaque ricochet.
  snow: `${PVFX}snowfall/`,
  whip: `${PVFX}lightning-whip/`,
  chainBolt: `${PVFX}chain-lightning/`,
  // Arc (demandé par l'utilisateur) : la flèche en vol, puis son impact quand elle s'arrête.
  arrowFlight: `${PVFX}arrow-flight/`,
  arrowImpact: `${PVFX}arrow-impact/`,
} as const;
export type EffectName = keyof typeof EFFECT_DIRS;

/**
 * Effets joués une fois là où il se passe quelque chose (coup, explosion, foudre) : `speed` =
 * vitesse de lecture (2 = deux fois plus vite que dans le pack).
 */
export const ONE_SHOT_FX = {
  /** Étincelles d'acier sur un ennemi touché par les chausse-trapes */
  clang: { speed: 1.5 },
  /** Explosion d'une mine : feu puis colonne de fumée (2 s dans le pack, accélérée) */
  barrel: { speed: 1.6 },
  /** Foudre de l'Orage, qui tombe sur l'ennemi */
  strike: { speed: 1.4 },
  /** Flèche qui se fiche (dans un ennemi ou au sol, en bout de course) puis s'efface */
  arrowImpact: { speed: 1.3 },
} as const satisfies Partial<Record<EffectName, { speed: number }>>;
export type OneShotName = keyof typeof ONE_SHOT_FX;

/**
 * Zones au sol qui vivent avec leur effet : il se joue jusqu'à `holdFrame` à la pose, reste sur
 * cette image tant que la zone dure, puis joue sa fin pendant les derniers instants de la zone.
 * `cover` : part du diamètre de la zone couverte par la largeur visible de l'effet.
 */
/** Aura de givre : neige du pack qui tombe dans le cercle (boucle), un peu transparente */
export const FROST_SNOW_FX = { effect: 'snow', alpha: 0.85 } as const;

/**
 * Éclair en chaîne : chaque saut est un effet du pack étiré entre ses deux bouts (`whip` pour le
 * premier coup, du joueur à la cible ; `chainBolt` pour les ricochets). `life` : s pour jouer
 * toute l'animation ; `thickness` : agrandissement en travers du trait.
 */
export const CHAIN_FX = { first: 'whip', jump: 'chainBolt', life: 0.45, thickness: 0.9 } as const;

export const ZONE_FX = {
  spikes: { effect: 'spikes', holdFrame: 6, cover: 1.15 },
  brambles: { effect: 'vines', holdFrame: 7, cover: 1.25 },
} as const satisfies Record<string, { effect: EffectName; holdFrame: number; cover: number }>;

/** Explosion du Trait éclaté : la zone visible de l'effet = le diamètre de l'explosion. */
export const EXPLOSION_FX = {
  /** s : l'animation (1,3 s dans le pack) est jouée en accéléré, sinon elles s'empilent */
  duration: 0.5,
} as const;

/** Coup d'épée : l'arc du sprite (`artRadius` px d'art depuis son pivot) = la portée de l'épée. */
export const SLASH_FX = {
  /** s (0,72 s dans le pack) : 0,25 s était trop rapide (retour de jeu) */
  duration: 0.45,
  artRadius: 35,
  /** Tourbillon (360°) : autant de coups répartis autour du joueur */
  fullCircleCopies: 3,
} as const;

/**
 * Fond animé du menu : le sol du donjon qui défile lentement, des démons qui le traversent, et
 * des bords assombris (vignette). Positions en coordonnées logiques (1280 × 720).
 */
export const MENU_BACKDROP = {
  /** px/s de défilement du sol */
  scrollX: 14,
  scrollY: 7,
  /** Assombrissement du sol (moins qu'en jeu : il n'y a pas de horde à faire ressortir) */
  floorDarken: 0.3,
  /** Opacité du noir sur les bords (le centre reste clair pour le titre et les boutons) */
  vignette: 0.6,
  /**
   * Démons qui passent : animation, agrandissement, ligne (bas du sprite), vitesse en px/s
   * (négatif = vers la gauche) et décalage de départ (px) pour qu'ils ne soient pas alignés.
   */
  walkers: [
    { anim: 'chort_run_anim', scale: 2, y: 600, speed: 42, offset: 0 },
    { anim: 'imp_run_anim', scale: 2, y: 640, speed: 75, offset: 500 },
    { anim: 'tank_demon_run_anim', scale: 2, y: 700, speed: 30, offset: 900 },
    { anim: 'big_demon_run_anim', scale: 3, y: 712, speed: 22, offset: 250 },
    { anim: 'chort_run_anim', scale: 2, y: 140, speed: -38, offset: 300 },
    { anim: 'imp_run_anim', scale: 2, y: 96, speed: -64, offset: 1000 },
  ],
  /** s par image des démons */
  frameTime: 0.1,
} as const;

/** Objets ramassables */
export const PICKUP_SPRITES = {
  gold: { anim: 'coin_anim', scale: 2, frameTime: 0.12 },
  food: { anim: 'flask_red', scale: 2, frameTime: 1 },
} as const;

/** Apparence d'un type d'ennemi par son id ; undefined = forme simple. */
export function enemySprite(typeId: string): SpriteDef | undefined {
  return (ENEMY_SPRITES as Readonly<Record<string, SpriteDef | undefined>>)[typeId];
}

/** px/s : en dessous, l'ennemi est considéré à l'arrêt (animation de repos, ex. boss qui annonce sa charge) */
export const ENEMY_IDLE_SPEED = 5;
/** s : décalage d'animation entre deux ennemis voisins dans le pool, pour que la horde ne marche pas au pas */
export const ENEMY_ANIM_OFFSET = 0.137;
