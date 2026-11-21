import { splitStats } from './highlightStats';
import { iconElement } from './icons';

/** Ce qu'il faut pour afficher un choix (le reste de l'upgrade ne concerne pas l'UI). */
export interface ChoiceView {
  readonly title: string;
  readonly description: string;
  readonly levelText: string;
  /** Sorte d'upgrade : donne le cadre et l'étiquette de la carte (absente : carte neutre) */
  readonly kind?: string;
  /** Icône (id de l'arme, de la mutation ou du passif) ; absente : pas d'icône */
  readonly iconId?: string;
  /** Mutation : nom de l'arme qui mute (affiché sous le nom de la mutation) */
  readonly weaponName?: string;
  /**
   * Mutation : sa couleur (nom et contour de l'icône). Les 2 mutations d'une arme ont le même
   * cadre doré : sans couleur propre, un testeur ne voyait pas la différence entre les deux.
   */
  readonly accent?: string;
}

/** Étiquette et style de carte selon la sorte d'upgrade (voir UpgradeChoice). */
const CARD_STYLES: Readonly<Record<string, { readonly tag: string; readonly css: string }>> = {
  newWeapon: { tag: 'Arme', css: 'choice-weapon' }, // « Nouvelle arme » est déjà le texte de niveau
  weaponLevel: { tag: 'Arme', css: 'choice-weapon' },
  passive: { tag: 'Passif', css: 'choice-passive' },
  mutation: { tag: 'Mutation', css: 'choice-mutation' },
  heal: { tag: 'Soin', css: 'choice-heal' },
  gold: { tag: 'Or', css: 'choice-gold' },
};

/**
 * Écran de level up : 3 cartes cliquables. L'UI ne modifie jamais le jeu elle-même :
 * un clic est seulement mémorisé, et la scène le lit pendant son update (`takeClick`).
 * Toute la logique reste ainsi dans la game loop.
 */
export class LevelUpOverlay {
  private clicked: number | null = null;
  private rerollClicked = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly titleEl: HTMLElement,
    private readonly choicesEl: HTMLElement,
    private readonly rerollButton: HTMLButtonElement,
  ) {
    rerollButton.addEventListener('click', () => (this.rerollClicked = true));
  }

  /** `title` remplace "NIVEAU N" (ex. pour l'écran de mutation). */
  show(level: number, choices: readonly ChoiceView[], title?: string): void {
    this.clicked = null;
    this.rerollClicked = false;
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
        const style = choice.kind ? CARD_STYLES[choice.kind] : undefined;
        button.className = style ? `choice ${style.css}` : 'choice';
        const key = document.createElement('span');
        key.className = 'choice-key';
        // Touche à presser, puis la sorte d'upgrade (« 1 · Passif »).
        key.textContent = style ? `${index + 1} · ${style.tag}` : String(index + 1);
        const title = document.createElement('span');
        title.className = 'choice-title';
        title.textContent = choice.title;
        const level = document.createElement('span');
        level.className = 'choice-level';
        level.textContent = choice.levelText;
        const desc = document.createElement('span');
        desc.className = 'choice-desc';
        // Bonus chiffrés en vert vif ; textContent par morceau (jamais d'innerHTML).
        desc.append(
          ...splitStats(choice.description).map((part) => {
            if (!part.stat) return part.text;
            const stat = document.createElement('span');
            stat.className = 'choice-stat';
            stat.textContent = part.text;
            return stat;
          }),
        );
        const head = document.createElement('span');
        head.className = 'choice-head';
        if (choice.iconId) head.append(iconElement(choice.iconId, ''));
        if (choice.kind === 'mutation') {
          // Mutation : le nom seul (l'étoile passe dans la ligne de niveau), l'arme dessous, et
          // « niveau 6 » au lieu de « Niv 6 · Mutation » (l'étiquette dit déjà « Mutation »).
          title.textContent = choice.title.replace(/^★\s*/, '');
          const names = document.createElement('span');
          names.className = 'choice-names';
          const weapon = document.createElement('span');
          weapon.className = 'choice-weapon-name';
          weapon.textContent = choice.weaponName ? `de ${choice.weaponName}` : '';
          names.append(title, weapon);
          head.append(names);
          level.textContent = '★ Niveau 6 · définitif';
          if (choice.accent) button.style.setProperty('--accent', choice.accent);
        } else {
          head.append(title);
        }
        button.append(key, head, level, desc);
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

  /** Bouton de relance : relances restantes, grisé quand on ne peut pas relancer. */
  setRerolls(left: number, enabled: boolean): void {
    // Retour à la ligne voulu (white-space: pre-line) : sinon le compteur tombe seul en dessous.
    this.rerollButton.textContent = `Relancer\n(R) · ${left}`;
    this.rerollButton.disabled = !enabled;
  }

  /** Vrai si le bouton de relance a été cliqué depuis la dernière lecture. */
  takeReroll(): boolean {
    const clicked = this.rerollClicked;
    this.rerollClicked = false;
    return clicked;
  }

  hide(): void {
    this.el.hidden = true;
    this.clicked = null;
    this.rerollClicked = false;
  }
}
