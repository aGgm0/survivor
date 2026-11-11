/** Le minimum de `localStorage` dont on a besoin (les tests fournissent un faux). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Sauvegarde générique en JSON (core/ ne connaît pas le gameplay : il ne sait pas ce qu'il range).
 *
 * `localStorage` peut être absent ou lever une erreur (navigation privée, stockage plein ou
 * bloqué) : aucune méthode ne lève jamais. Le jeu continue simplement sans sauvegarde.
 * Ce qui est lu est `unknown` : c'est à l'appelant de le valider (la donnée peut être corrompue,
 * venir d'une ancienne version ou avoir été modifiée à la main).
 */
export class SaveStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  /** `localStorage` du navigateur s'il est utilisable, sinon un store qui ne garde rien. */
  static fromBrowser(): SaveStore {
    try {
      return new SaveStore(window.localStorage);
    } catch {
      return new SaveStore(null);
    }
  }

  /** La valeur rangée sous `key`, ou `undefined` (absente, illisible ou JSON invalide). */
  load(key: string): unknown {
    try {
      const text = this.storage?.getItem(key);
      return text == null ? undefined : (JSON.parse(text) as unknown);
    } catch {
      return undefined;
    }
  }

  /** Vrai si la valeur a bien été écrite. */
  save(key: string, value: unknown): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}
