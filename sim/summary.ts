// Mise en forme des résultats du bot : une ligne par seed, puis le bilan de toutes les parties.

import { WEAPON_LIST } from '../src/data/weapons';
import type { SimResult } from './runSim';

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? (v[mid] ?? NaN) : ((v[mid - 1] ?? 0) + (v[mid] ?? 0)) / 2;
}

function pct(x: number): string {
  return `${Math.round(x * 100)} %`;
}

/** Une ligne par partie. */
export function formatRuns(results: readonly SimResult[]): string {
  const lines = [
    'seed  fin        temps  niv  n3:00 n6:00 1re mut  kills   or  build  PV min  armes (part du damage meter)',
  ];
  for (const r of results) {
    const rep = r.report;
    const end = !rep ? 'trop long' : rep.victory ? 'VICTOIRE' : 'mort';
    const weapons = rep?.weapons.map((w) => `${w.name} ${pct(w.share)}`).join(', ') ?? '';
    lines.push(
      [
        String(r.seed).padEnd(4),
        end.padEnd(9),
        mmss(r.time).padStart(6),
        String(rep?.level ?? '').padStart(4),
        String(r.levelAt3 ?? '—').padStart(5),
        String(r.levelAt6 ?? '—').padStart(5),
        (r.firstMutationAt != null ? mmss(r.firstMutationAt) : '—').padStart(7),
        String(rep?.kills ?? '').padStart(6),
        String(rep?.gold ?? '').padStart(4),
        (rep?.maxedAt != null ? mmss(rep.maxedAt) : '—').padStart(6),
        pct(r.minHpShare).padStart(7),
        ` ${weapons}`,
      ].join(' '),
    );
  }
  return lines.join('\n');
}

/** Bilan de toutes les parties : ce qu'on compare d'une version à l'autre. */
export function formatSummary(results: readonly SimResult[]): string {
  const done = results.filter((r) => r.report);
  const wins = done.filter((r) => r.report?.victory).length;
  const times = results.map((r) => r.time);
  const levels3 = results.flatMap((r) => (r.levelAt3 != null ? [r.levelAt3] : []));
  const levels6 = results.flatMap((r) => (r.levelAt6 != null ? [r.levelAt6] : []));
  const mutations = results.flatMap((r) => (r.firstMutationAt != null ? [r.firstMutationAt] : []));
  const maxed = done.flatMap((r) => (r.report?.maxedAt != null ? [r.report.maxedAt] : []));
  const lines = [
    `Parties : ${results.length} (${results.length - done.length} arrêtées, trop longues)`,
    `Victoires : ${wins} / ${results.length} (${pct(wins / Math.max(1, results.length))})`,
    `Temps de survie : médiane ${mmss(median(times))}, min ${mmss(Math.min(...times))}, max ${mmss(Math.max(...times))}`,
    `Build complet : ${maxed.length} parties${maxed.length ? `, médiane ${mmss(median(maxed))}` : ''}`,
    `Niveau atteint (médiane) : ${median(done.map((r) => r.report?.level ?? 0))}`,
    `Or gagné (médiane) : ${median(done.map((r) => r.report?.gold ?? 0))}`,
    `Niveau à 3:00 (médiane) : ${median(levels3)}, à 6:00 : ${median(levels6)} (${levels6.length} parties y arrivent)`,
    `Première mutation : ${mutations.length} / ${results.length} parties${mutations.length ? `, médiane ${mmss(median(mutations))}` : ''}`,
    '',
    'Part moyenne du damage meter, dans les parties où l’arme est présente :',
  ];
  for (const def of WEAPON_LIST) {
    const shares = done.flatMap(
      (r) => r.report?.weapons.filter((w) => w.id === def.id).map((w) => w.share) ?? [],
    );
    if (shares.length === 0) {
      lines.push(`  ${def.name.padEnd(18)} jamais prise`);
      continue;
    }
    const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
    lines.push(
      `  ${def.name.padEnd(18)} ${pct(mean).padStart(5)}  (dans ${shares.length} parties)`,
    );
  }
  const wall = results.reduce((a, r) => a + r.wallSeconds, 0);
  lines.push('', `Simulé en ${wall.toFixed(1)} s réelles`);
  return lines.join('\n');
}
