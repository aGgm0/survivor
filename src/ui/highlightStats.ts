/** Un morceau de description : texte normal, ou bonus chiffré à mettre en valeur. */
export interface DescPart {
  readonly text: string;
  readonly stat: boolean;
}

/*
 * Bonus chiffré : un signe + ou − (ou -) suivi d'un nombre, avec son unité éventuelle
 * (« +5 », « -20 % », « +1 », « +20 PV »). Les facteurs « ×0,9 » ne sont pas pris : dans les
 * mutations, ce sont souvent des malus, les mettre en vert induirait en erreur.
 */
const STAT_PATTERN = /[+\-−]\d+(?:[.,]\d+)?(?:\s?%|\s?px|\s?PV)?/g;

/**
 * Découpe une description pour colorer ses bonus (retour de testeur : « les stats améliorées
 * en vert flashy »). Fonction pure : l'UI ne fait que créer un <span> par morceau.
 */
export function splitStats(description: string): DescPart[] {
  const parts: DescPart[] = [];
  let last = 0;
  for (const match of description.matchAll(STAT_PATTERN)) {
    const start = match.index;
    if (start > last) parts.push({ text: description.slice(last, start), stat: false });
    parts.push({ text: match[0], stat: true });
    last = start + match[0].length;
  }
  if (last < description.length) parts.push({ text: description.slice(last), stat: false });
  return parts;
}
