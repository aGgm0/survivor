export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Écrit dans `out` le vecteur (x, y) ramené à une longueur de 1, ou (0, 0) s'il est nul.
 * On écrit dans un objet fourni au lieu d'en renvoyer un nouveau : zéro allocation dans la boucle.
 */
export function normalizeInto(x: number, y: number, out: Vec2): Vec2 {
  const length = Math.hypot(x, y);
  if (length === 0) {
    out.x = 0;
    out.y = 0;
  } else {
    out.x = x / length;
    out.y = y / length;
  }
  return out;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Interpolation linéaire : t = 0 → a, t = 1 → b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Générateur aléatoire seedé (algorithme mulberry32).
 *
 * Contrairement à Math.random(), la même seed donne toujours la même suite de
 * nombres. Si un bug arrive pendant une run, on note la seed et on peut rejouer
 * exactement les mêmes spawns / choix d'upgrades pour le reproduire.
 */
export class Rng {
  private state: number;

  constructor(readonly seed: number) {
    // `>>> 0` force un entier non signé 32 bits, ce que l'algorithme attend.
    this.state = seed >>> 0;
  }

  /** Nombre dans [0, 1[. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Nombre réel dans [min, max[. */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

/**
 * Tirage pondéré : avec [['a', 3], ['b', 1]], 'a' sort 3 fois plus souvent que 'b'.
 * `roll` est un nombre dans [0, 1[ (typiquement `rng.next()`), ce qui rend la fonction testable.
 */
export function pickWeighted<T>(entries: readonly (readonly [T, number])[], roll: number): T {
  let total = 0;
  for (const [, weight] of entries) total += weight;

  let target = roll * total;
  for (const [value, weight] of entries) {
    if (target < weight) return value;
    target -= weight;
  }
  // Inatteignable avec roll < 1, mais rassure le typage (et protège des arrondis).
  const last = entries[entries.length - 1];
  if (!last) throw new Error('pickWeighted : liste vide');
  return last[0];
}
