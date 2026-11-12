// Sprites du pack 0x72 DungeonTileset II (CC0, voir public/assets/LICENSES.md).
// Noms des animations : fichier tile_list_v1.7 du pack, sans le suffixe `_fN`.
import type { SpriteTint } from '../core/SpriteAtlas';
import type { ENEMY_TYPES } from './enemies';

const BASE = `${import.meta.env.BASE_URL}assets/sprites/0x72/`;

export const ATLAS_URLS = {
  image: `${BASE}0x72_DungeonTilesetII_v1.7.png`,
  list: `${BASE}tile_list_v1.7`,
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
}

export const PLAYER_SPRITE: SpriteDef = {
  idle: 'wizzard_m_idle_anim',
  run: 'wizzard_m_run_anim',
  scale: 2,
  frameTime: 0.1,
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
  tank: { idle: 'ogre_idle_anim', run: 'ogre_run_anim', scale: 2, frameTime: 0.13 },
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
  /** Assombrissement (0 à 1) : le sol doit rester en retrait derrière les monstres */
  darken: 0.55,
} as const;

/** Atlas des effets, généré par `node tools/sprites/build.mjs` (ce que le pack 0x72 n'a pas). */
export const FX_ATLAS_URLS = {
  image: `${import.meta.env.BASE_URL}assets/sprites/fx/fx.png`,
  list: `${import.meta.env.BASE_URL}assets/sprites/fx/fx_list`,
} as const;

/** Gemme de chaque palier de GEM_TIERS (même ordre), dessinée ×2 */
export const GEM_SPRITES = ['gem_1', 'gem_2', 'gem_3'] as const;
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

/** Orbe runique (gris, teint) : son diamètre (`diameter` px d'art) = celui de la hitbox. */
export const ORB_SPRITE = { anim: 'orb_anim', diameter: 14, frameTime: 0.25 } as const;

// ---------------------------------------------------------------- effets PVFX Foundry (CC0)
// Style « strict » (pixels nets). Chaque dossier contient sprite-sheet.png + manifest.json.

const PVFX = `${import.meta.env.BASE_URL}assets/sprites/pvfx/`;

export const EFFECT_DIRS = {
  burst: `${PVFX}arcane-burst/`,
  slash: `${PVFX}axe-smear/`,
  wave: `${PVFX}wind-blade/`,
} as const;
export type EffectName = keyof typeof EFFECT_DIRS;

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

/** Lame d'onde : la hauteur du croissant formé (px d'art, mesurée dans le manifeste) = le diamètre de la hitbox */
export const WAVE_FX = { artHeight: 33 } as const;

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
