import type { RunReport } from '../systems/runReport';
import { formatTime } from './formatTime';

/** Écran de fin de partie : victoire ou défaite, bilan et damage meter. */
export class EndOverlay {
  constructor(
    private readonly el: HTMLElement,
    private readonly titleEl: HTMLElement,
    private readonly infoEl: HTMLElement,
    private readonly meterEl: HTMLElement,
  ) {}

  show(report: RunReport): void {
    this.el.classList.toggle('overlay-victory', report.victory);
    this.el.classList.toggle('overlay-death', !report.victory);
    this.titleEl.textContent = report.victory ? 'VICTOIRE' : 'MORT';
    const maxed =
      report.maxedAt === null ? 'build incomplet' : `build complet à ${formatTime(report.maxedAt)}`;
    this.infoEl.textContent = `Survécu ${formatTime(report.time)} · ${report.kills} kills · niveau ${report.level} · ${maxed}`;

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
