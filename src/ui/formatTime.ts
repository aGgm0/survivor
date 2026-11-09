/** 75.4 → "01:15". Les secondes sont tronquées (le timer n'avance qu'à chaque seconde pleine). */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
