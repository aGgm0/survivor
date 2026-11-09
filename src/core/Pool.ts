export interface Poolable {
  active: boolean;
}

/**
 * Object pool : tous les objets sont créés une seule fois, au départ.
 *
 * "Créer" un objet en jeu = en sortir un de la réserve ; le "détruire" = l'y remettre.
 * Aucun `new` pendant la partie, donc rien à nettoyer pour le garbage collector
 * (qui, sinon, met le jeu en pause quelques ms de temps en temps : saccades visibles).
 */
export class Pool<T extends Poolable> {
  /** Tous les objets, actifs ou non. Pour itérer : boucle sur `items` en sautant les inactifs. */
  readonly items: readonly T[];
  /** Pile des objets libres. Sa taille ne dépasse jamais la capacité : pas de réallocation. */
  private readonly free: T[];

  /** `factory` reçoit l'index de l'objet (stable, utile comme identifiant). */
  constructor(capacity: number, factory: (index: number) => T) {
    const items: T[] = [];
    for (let i = 0; i < capacity; i++) items.push(factory(i));
    this.items = items;
    this.free = items.slice().reverse();
  }

  get capacity(): number {
    return this.items.length;
  }

  get activeCount(): number {
    return this.items.length - this.free.length;
  }

  /** Renvoie un objet libre (marqué actif), ou `null` si la réserve est vide. */
  acquire(): T | null {
    const item = this.free.pop();
    if (!item) return null;
    item.active = true;
    return item;
  }

  release(item: T): void {
    // Garde-fou : relâcher deux fois le même objet le mettrait deux fois dans la pile.
    if (!item.active) return;
    item.active = false;
    this.free.push(item);
  }

  releaseAll(): void {
    for (const item of this.items) this.release(item);
  }
}
