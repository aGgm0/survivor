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

/** Ce que le joueur peut demander depuis l'écran de fin. */
export type EndAction = 'continue' | 'restart' | 'menu';

/**
 * Écran de fin de partie : victoire ou défaite, bilan et damage meter. Comme le menu pause,
 * un clic est seulement mémorisé : la scène le lit pendant son update (`takeAction`).
 */
export class EndOverlay {
  private action: EndAction | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly titleEl: HTMLElement,
    private readonly infoEl: HTMLElement,
    private readonly meterEl: HTMLElement,
    private readonly unlocksEl: HTMLElement,
    private readonly buttons: Readonly<Record<EndAction, HTMLButtonElement>>,
  ) {
    buttons.continue.addEventListener('click', () => (this.action = 'continue'));
    buttons.restart.addEventListener('click', () => (this.action = 'restart'));
    buttons.menu.addEventListener('click', () => (this.action = 'menu'));
  }

  /** L'action cliquée depuis la dernière lecture, ou null. */
  takeAction(): EndAction | null {
    const action = this.action;
    this.action = null;
    return action;
  }

  /** `canContinue` : écran de victoire d'où l'on peut lancer le mode sans fin (touche C). */
  show(report: RunReport, canContinue = false, unlocks: readonly string[] = []): void {
    // Un clic d'un écran de fin précédent ne doit pas resservir.
    this.action = null;
    this.buttons.continue.hidden = !canContinue;
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
