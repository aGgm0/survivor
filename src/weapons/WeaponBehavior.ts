// Contrat d'un comportement d'arme (projectile, aura, orbite, mêlée...). Tout ce qui dépend du
// TYPE d'arme vit dans son module (src/weapons/<type>.ts) : le moteur appelle ces fonctions sans
// savoir de quelle arme il s'agit. Ajouter un type = un module + une ligne dans registry.ts.

import type { Pool } from '../core/Pool';
import type { SpriteAtlas } from '../core/SpriteAtlas';
import type { WeaponDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Weapon, WeaponModifiers } from '../entities/Weapon';
import type { CollisionSystem } from '../systems/CollisionSystem';
import type { HitEvents } from '../systems/damage';

export type WeaponKind = WeaponDef['kind'];

/** La définition d'arme d'un type donné (ex. `DefOf<'aura'>` = AuraWeaponDef). */
export type DefOf<K extends WeaponKind> = Extract<WeaponDef, { kind: K }>;

/**
 * Bonus des niveaux 2 à N additionnés, en partant des valeurs de base du type (`levelBase`).
 * Un seul objet réutilisé à chaque recalcul : pas d'allocation.
 */
export interface LevelTotals {
  damage: number;
  count: number;
  radius: number;
  cooldownPct: number;
  orbitDistance: number;
  arcDeg: number;
  range: number;
}

/**
 * Ce qu'une arme peut lire et utiliser pendant l'update. Un seul objet, mis à jour à chaque
 * update par le WeaponSystem (pas d'allocation).
 */
export interface WeaponUpdateContext {
  dt: number;
  /** Temps de partie (s) */
  now: number;
  /** Position du joueur */
  x: number;
  y: number;
  /** Direction regardée par le joueur (longueur 1) */
  facingX: number;
  facingY: number;
  readonly collisions: CollisionSystem;
  readonly projectiles: Pool<Projectile>;
  readonly events: HitEvents;
  /** Tableau de résultats de requête dans la grille, réutilisé */
  readonly candidates: Enemy[];
  /** Ennemi actif le plus proche dans `range` (mobilier ignoré), ou null */
  findNearest(x: number, y: number, range: number): Enemy | null;
}

/** Ce qu'une arme peut lire pour se dessiner. Un seul objet, mis à jour à chaque rendu. */
export interface WeaponRenderContext {
  /** Fraction d'update écoulée (interpolation) */
  alpha: number;
  /** Position interpolée du joueur */
  playerX: number;
  playerY: number;
  /** Temps de partie (s) : animations, scintillements */
  time: number;
  /** Atlas des effets générés ; null : formes simples */
  readonly fx: SpriteAtlas | null;
  /** Atlas du pack (persos, ennemis, objets, armes) ; null : formes simples */
  readonly sprites: SpriteAtlas | null;
  readonly projectiles: Pool<Projectile>;
  isOnScreen(x: number, y: number, r: number): boolean;
}

/**
 * Comportement d'un type d'arme. Les fonctions de rendu ne modifient jamais l'état (CLAUDE.md
 * § 4) ; `update` ne dessine jamais. Syntaxe « méthode » : le registre peut ranger chaque
 * module sous le type général sans conversion.
 */
export interface WeaponBehavior<D extends WeaponDef = WeaponDef> {
  /** Stats du niveau 1, sans passifs (constructeur de l'arme) */
  init(weapon: Weapon, def: D): void;
  /** Valeurs de base du type avant d'ajouter les bonus des niveaux (count, rayon, portée...) */
  levelBase(def: D, totals: LevelTotals): void;
  /**
   * Stats propres au type, après les dégâts et le recul (communs, calculés par l'arme).
   * Doit aussi régler `weapon.cooldown` (voir `scaledCooldown`).
   */
  applyStats(weapon: Weapon, def: D, totals: Readonly<LevelTotals>, mods: WeaponModifiers): void;
  update(weapon: Weapon, def: D, ctx: WeaponUpdateContext): void;
  /** Dessin au sol, sous les ennemis (aura) */
  renderGround?(
    ctx: CanvasRenderingContext2D,
    weapon: Weapon,
    def: D,
    rc: WeaponRenderContext,
  ): void;
  /** Dessin par-dessus le joueur (orbes, projectiles) */
  renderAbove?(
    ctx: CanvasRenderingContext2D,
    weapon: Weapon,
    def: D,
    rc: WeaponRenderContext,
  ): void;
  /** Stats comparables affichées sur la carte de level up (avant → après), mises en forme */
  cardStats(weapon: Weapon, def: D): [string, string][];
}
