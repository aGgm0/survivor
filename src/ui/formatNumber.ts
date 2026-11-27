/**
 * Espace entre les milliers : insécable (U+00A0), pour qu'un nombre ne soit jamais coupé en fin
 * de ligne. Les deux polices pixel la dessinent aussi large qu'une espace normale.
 */
const THOUSANDS_SEPARATOR = '\u00a0';

/**
 * Nombre à la française : virgule décimale, sans décimale inutile, milliers espacés
 * (1.50 → "1,5", 12345 → "12 345").
 */
export function formatNumber(n: number, decimals = 0): string {
  const rounded = Number(n.toFixed(decimals));
  const [int = '', frac] = String(Math.abs(rounded)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
  return `${rounded < 0 ? '-' : ''}${grouped}${frac ? `,${frac}` : ''}`;
}
