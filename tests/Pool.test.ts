import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/Pool';

class Thing {
  active = false;
}

describe('Pool', () => {
  it('crée tous les objets au départ, inactifs', () => {
    const pool = new Pool(3, () => new Thing());
    expect(pool.capacity).toBe(3);
    expect(pool.activeCount).toBe(0);
    expect(pool.items.every((t) => !t.active)).toBe(true);
  });

  it('acquire active un objet, release le rend', () => {
    const pool = new Pool(2, () => new Thing());
    const t = pool.acquire();
    expect(t?.active).toBe(true);
    expect(pool.activeCount).toBe(1);
    if (t) pool.release(t);
    expect(pool.activeCount).toBe(0);
  });

  it('renvoie null quand la réserve est vide', () => {
    const pool = new Pool(1, () => new Thing());
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).toBeNull();
  });

  it('réutilise les mêmes objets (aucune nouvelle instance)', () => {
    const pool = new Pool(1, () => new Thing());
    const a = pool.acquire();
    if (a) pool.release(a);
    expect(pool.acquire()).toBe(a);
  });

  it('un double release ne duplique pas l’objet dans la réserve', () => {
    const pool = new Pool(2, () => new Thing());
    const t = pool.acquire();
    if (!t) throw new Error();
    pool.release(t);
    pool.release(t);
    expect(pool.activeCount).toBe(0);
    pool.acquire();
    pool.acquire();
    expect(pool.acquire()).toBeNull();
  });
});
