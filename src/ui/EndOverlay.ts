import type { RunReport } from '../systems/runReport';
import { formatTime } from './formatTime';

/** Une tuile du bilan : la valeur en gros, son libellé dessous. */
function stat(value: string, label: string): HTMLElement {
  const box = document.createElement('span');
  box.className = 'end-stat';
  const v = document.createElement('span');
  v.className = 'end-stat-value';
  v.textContent = value;
  const l = document.createElement('span');
  l.className = 'end-stat-label';
  l.textContent = label;
  box.append(v, l);
  return box;
}

/** Écran de fin de partie : victoire ou défaite, bilan et damage meter. */
export class EndOverlay {
  constructor(
    private readonly el: HTMLElement,
    private readonly titleEl: HTMLElement,
    private readonly infoEl: HTMLElement,
    private readonly meterEl: HTMLElement,
    private readonly hintEl: HTMLElement,
    private readonly unlocksEl: HTMLElement,
  ) {}

  /** `canContinue` : écran de victoire d'où l'on peut lancer le mode sans fin (touche C). */
  show(report: RunReport, canContinue = false, unlocks: readonly string[] = []): void {
    this.unlocksEl.hidden = unlocks.length === 0;
    // Annonce des persos débloqués par cette partie (une ligne par perso).
    this.unlocksEl.textContent = unlocks
      .map((name) => `Nouveau perso débloqué : ${name} !`)
      .join('\n');
    this.el.classList.toggle('overlay-victory', report.victory);
    this.el.classList.toggle('overlay-death', !report.victory);
    this.titleEl.textContent = report.endless ? 'SANS FIN' : report.victory ? 'VICTOIRE' : 'MORT';
    // Bilan en tuiles (valeur en gros, libellé dessous) plutôt qu'en une longue phrase.
    this.infoEl.replaceChildren(
      stat(formatTime(report.time), report.endless ? 'survécu (sans fin)' : 'survécu'),
      stat(String(report.kills), 'kills'),
      stat(`+${report.gold}`, 'or'),
      stat(String(report.level), 'niveau'),
      stat(
        report.maxedAt === null ? '—' : formatTime(report.maxedAt),
        report.maxedAt === null ? 'build incomplet' : 'build complet',
      ),
    );
    this.hintEl.textContent = canContinue
      ? 'C pour continuer en sans fin · R pour rejouer · M pour le menu'
      : 'R pour rejouer · M pour le menu';

    // Créer des éléments est sans risque ici : une seule fois, en fin de partie.
    this.meterEl.replaceChildren(
      ...report.weapons.map((w) => {
        const row = document.createElement('div');
        row.className = 'meter-row';

        const label = document.createElement('span');
        label.className = 'meter-label';
        label.textContent = `${w.name} (niv ${w.level})`;

        const bar = document.createElement('span');
        bar.className = 'meter-bar';
        const fill = document.createElement('span');
        fill.className = 'meter-fill';
        fill.style.width = `${Math.round(w.share * 100)}%`;
        fill.style.background = w.color;
        bar.append(fill);

        const value = document.createElement('span');
        value.className = 'meter-value';
        value.textContent = `${w.damage} dégâts · ${Math.round(w.share * 100)} % · ${w.kills} kills`;

        row.append(label, bar, value);
        return row;
      }),
    );
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
