import { describe, expect, it } from 'vitest';
import { splitStats } from '../src/ui/highlightStats';

describe('splitStats', () => {
  it('met en valeur les bonus signés, avec leur unité', () => {
    expect(splitStats('+20 PV max (et soigne 20)')).toEqual([
      { text: '+20 PV', stat: true },
      { text: ' max (et soigne 20)', stat: false },
    ]);
    expect(splitStats('Cooldown -20 %')).toEqual([
      { text: 'Cooldown ', stat: false },
      { text: '-20 %', stat: true },
    ]);
  });

  it('trouve plusieurs bonus dans la même description', () => {
    const stats = splitStats('+3 dégâts, rayon +20 px').filter((p) => p.stat);
    expect(stats.map((p) => p.text)).toEqual(['+3', '+20 px']);
  });

  it('laisse les facteurs (souvent des malus) et le texte sans chiffre tels quels', () => {
    expect(splitStats('dégâts ×0,9')).toEqual([{ text: 'dégâts ×0,9', stat: false }]);
    expect(splitStats('Brûle les ennemis')).toEqual([{ text: 'Brûle les ennemis', stat: false }]);
  });

  it('ne perd aucun caractère', () => {
    const desc = '+1 orbe, +3 dégâts, recul ×0,3';
    expect(splitStats(desc).map((p) => p.text).join('')).toBe(desc);
  });
});
