/**
 * Spatial hash : partition du monde en cases carrées pour trouver vite "qui est près de qui".
 *
 * Au lieu de comparer chaque ennemi à tous les autres (n² tests : 1 000 000 pour 1000 ennemis),
 * on range chaque objet dans sa case, puis on ne regarde que les cases autour du point demandé.
 *
 * Map infinie → on ne peut pas faire un tableau 2D de cases. On "hache" les coordonnées (cx, cy)
 * d'une case vers un des `bucketCount` seaux. Deux cases éloignées peuvent tomber dans le même
 * seau : ce n'est pas grave, la requête renvoie juste quelques candidats en trop, et l'appelant
 * vérifie de toute façon la vraie distance.
 *
 * Zéro allocation : tout est stocké dans des tableaux créés une fois, et chaque seau est une
 * liste chaînée d'indices (`head` = premier élément du seau, `next` = élément suivant).
 */
export class SpatialGrid<T> {
  private readonly head: Int32Array;
  private readonly next: Int32Array;
  private readonly items: (T | null)[];
  /** Anti-doublons : numéro de la dernière requête qui a déjà renvoyé l'élément i. */
  private readonly seenAt: Int32Array;
  private readonly bucketMask: number;
  private count = 0;
  private queryId = 0;

  /**
   * @param cellSize taille d'une case en px (idéalement ≥ 2× le rayon des objets)
   * @param capacity nombre max d'objets insérés entre deux `clear()`
   * @param bucketCount nombre de seaux, puissance de 2
   */
  constructor(
    private readonly cellSize: number,
    capacity: number,
    bucketCount = 4096,
  ) {
    if ((bucketCount & (bucketCount - 1)) !== 0) throw new Error('bucketCount : puissance de 2');
    this.bucketMask = bucketCount - 1;
    this.head = new Int32Array(bucketCount).fill(-1);
    this.next = new Int32Array(capacity);
    this.seenAt = new Int32Array(capacity);
    this.items = new Array<T | null>(capacity).fill(null);
  }

  /** Vide la grille. On la reconstruit à chaque update, car tout le monde bouge. */
  clear(): void {
    this.head.fill(-1);
    // Libère les références pour ne pas garder d'objets "fantômes" d'une update à l'autre.
    for (let i = 0; i < this.count; i++) this.items[i] = null;
    this.count = 0;
  }

  insert(item: T, x: number, y: number): void {
    if (this.count >= this.items.length) return; // plein : on ignore plutôt que de planter
    const bucket = this.bucketOf(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    const index = this.count++;
    this.items[index] = item;
    this.next[index] = this.head[bucket] ?? -1;
    this.head[bucket] = index;
  }

  /**
   * Remplit `out` avec les objets des cases qui touchent le carré (x ± radius, y ± radius).
   * Renvoie le nombre d'objets écrits. `out` est fourni par l'appelant et réutilisé : pas d'allocation.
   * Ce sont des *candidats* : l'appelant doit vérifier la vraie distance.
   */
  query(x: number, y: number, radius: number, out: T[]): number {
    // `| 0` garde le compteur en entier 32 bits, comme le tableau `seenAt` où on le stocke.
    // 0 est sauté car c'est la valeur initiale de `seenAt`.
    this.queryId = (this.queryId + 1) | 0;
    if (this.queryId === 0) this.queryId = 1;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    let n = 0;
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        let index = this.head[this.bucketOf(cx, cy)] ?? -1;
        while (index !== -1) {
          const item = this.items[index];
          // Deux cases de la zone peuvent partager un seau : on ne renvoie chaque objet qu'une fois.
          if (item != null && this.seenAt[index] !== this.queryId && n < out.length) {
            this.seenAt[index] = this.queryId;
            out[n++] = item;
          }
          index = this.next[index] ?? -1;
        }
      }
    }
    return n;
  }

  private bucketOf(cx: number, cy: number): number {
    // Multiplication par de grands nombres premiers puis XOR : répartit bien les cases voisines.
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.bucketMask;
  }
}
