/** Ce qu'il faut pour afficher un choix (le reste de l'upgrade ne concerne pas l'UI). */
export interface ChoiceView {
  readonly title: string;
  readonly description: string;
  readonly levelText: string;
}

/**
 * Écran de level up : 3 cartes cliquables. L'UI ne modifie jamais le jeu elle-même :
 * un clic est seulement mémorisé, et la scène le lit pendant son update (`takeClick`).
 * Toute la logique reste ainsi dans la game loop.
 */
export class LevelUpOverlay {
  private clicked: number | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly titleEl: HTMLElement,
    private readonly choicesEl: HTMLElement,
  ) {}

  /** `title` remplace "NIVEAU N" (ex. pour l'écran de mutation). */
  show(level: number, choices: readonly ChoiceView[], title?: string): void {
    this.clicked = null;
    this.titleEl.textContent = title ?? `NIVEAU ${level}`;
    this.el.classList.toggle('overlay-mutation', title !== undefined);
    // L'aide liste les touches réellement utilisables (2 choix pour une mutation).
    const hint = this.el.querySelector('.overlay-hint');
    if (hint) hint.textContent = `Clic ou touches ${choices.map((_, i) => i + 1).join(' · ')}`;
    // Créer des éléments ici est sans risque : ça n'arrive qu'au level up, pas à chaque frame.
    this.choicesEl.replaceChildren(
      ...choices.map((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice';
        const key = document.createElement('span');
        key.className = 'choice-key';
        key.textContent = String(index + 1);
        const title = document.createElement('span');
        title.className = 'choice-title';
        title.textContent = choice.title;
        const level = document.createElement('span');
        level.className = 'choice-level';
        level.textContent = choice.levelText;
        const desc = document.createElement('span');
        desc.className = 'choice-desc';
        desc.textContent = choice.description;
        button.append(key, title, level, desc);
        button.addEventListener('click', () => (this.clicked = index));
        return button;
      }),
    );
    this.el.hidden = false;
  }

  /** Index de la carte cliquée depuis la dernière lecture, ou null. */
  takeClick(): number | null {
    const index = this.clicked;
    this.clicked = null;
    return index;
  }

  hide(): void {
    this.el.hidden = true;
    this.clicked = null;
  }
}
