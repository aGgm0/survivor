import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../src/core/SpatialGrid';

function queryAll<T>(grid: SpatialGrid<T>, x: number, y: number, r: number): T[] {
  const out = new Array<T>(100);
  const n = grid.query(x, y, r, out);
  return out.slice(0, n);
}

describe('SpatialGrid', () => {
  it('trouve les objets proches et ignore les lointains', () => {
    const grid = new SpatialGrid<string>(50, 10);
    grid.insert('près', 10, 10);
    grid.insert('loin', 1000, 1000);
    const found = queryAll(grid, 0, 0, 20);
    expect(found).toContain('près');
    expect(found).not.toContain('loin');
  });

  it('marche avec des coordonnées négatives (map infinie)', () => {
    const grid = new SpatialGrid<string>(50, 10);
    grid.insert('a', -510, -230);
    expect(queryAll(grid, -500, -240, 30)).toEqual(['a']);
  });

  it('trouve un objet dans une case voisine', () => {
    const grid = new SpatialGrid<string>(50, 10);
    grid.insert('voisin', 55, 0); // case (1, 0)
    expect(queryAll(grid, 45, 0, 20)).toEqual(['voisin']); // requête depuis la case (0, 0)
  });

  it('ne renvoie jamais deux fois le même objet, même si des cases partagent un seau', () => {
    // 1 seul seau : toutes les cases y tombent, cas extrême de collision de hachage.
    const grid = new SpatialGrid<string>(10, 10, 1);
    grid.insert('a', 0, 0);
    grid.insert('b', 15, 0);
    const found = queryAll(grid, 5, 0, 30);
    expect(found.sort()).toEqual(['a', 'b']);
  });

  it('clear() vide la grille', () => {
    const grid = new SpatialGrid<string>(50, 10);
    grid.insert('a', 0, 0);
    grid.clear();
    expect(queryAll(grid, 0, 0, 100)).toEqual([]);
  });

  it('ignore les insertions au-delà de la capacité au lieu de planter', () => {
    const grid = new SpatialGrid<number>(50, 2);
    grid.insert(1, 0, 0);
    grid.insert(2, 0, 0);
    grid.insert(3, 0, 0);
    expect(queryAll(grid, 0, 0, 10).sort()).toEqual([1, 2]);
  });
});
