import type { Rng } from '../core/math';
import type { SpriteAtlas } from '../core/SpriteAtlas';
import { FLOOR } from '../data/sprites';
import type { FloorDef } from '../data/stages';

/**
 * Image du sol : FLOOR.size × FLOOR.size dalles tirées selon leur poids, préparée une fois puis
 * répétée en motif. Partagée par la partie (sol du niveau) et le fond du menu (sol du donjon).
 * `darken` : assombrissement (0 à 1), celui du sol par défaut.
 */
export function buildFloor(
  sprites: SpriteAtlas,
  rng: Rng,
  floor: FloorDef = FLOOR,
  darken: number = floor.darken,
): HTMLCanvasElement {
  const total = floor.tiles.reduce((sum, t) => sum + t.weight, 0);
  const pick = (): string => {
    let roll = rng.next() * total;
    for (const t of floor.tiles) {
      roll -= t.weight;
      if (roll < 0) return t.name;
    }
    return floor.tiles[0].name;
  };
  const grid = Array.from({ length: floor.size }, () => Array.from({ length: floor.size }, pick));
  return sprites.buildTiles(grid, floor.scale, darken);
}
