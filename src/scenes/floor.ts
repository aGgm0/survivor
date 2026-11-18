import type { Rng } from '../core/math';
import type { SpriteAtlas } from '../core/SpriteAtlas';
import { FLOOR } from '../data/sprites';

/**
 * Image du sol : FLOOR.size × FLOOR.size dalles tirées selon leur poids, préparée une fois puis
 * répétée en motif. Partagée par la partie et le fond du menu. `darken` : assombrissement (0 à 1).
 */
export function buildFloor(
  sprites: SpriteAtlas,
  rng: Rng,
  darken: number = FLOOR.darken,
): HTMLCanvasElement {
  const total = FLOOR.tiles.reduce((sum, t) => sum + t.weight, 0);
  const pick = (): string => {
    let roll = rng.next() * total;
    for (const t of FLOOR.tiles) {
      roll -= t.weight;
      if (roll < 0) return t.name;
    }
    return FLOOR.tiles[0].name;
  };
  const grid = Array.from({ length: FLOOR.size }, () => Array.from({ length: FLOOR.size }, pick));
  return sprites.buildTiles(grid, FLOOR.scale, darken);
}
