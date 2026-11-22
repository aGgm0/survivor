/** Nombre à la française (virgule), sans décimale inutile : 1.50 → "1,5". */
export function formatNumber(n: number, decimals = 0): string {
  const rounded = Number(n.toFixed(decimals));
  return String(rounded).replace('.', ',');
}
