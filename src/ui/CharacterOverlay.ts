import { challengeProgress, isUnlocked, type CharacterDef } from '../data/characters';
import type { Profile } from '../data/profile';

/**
 * Écran de choix du perso : une carte par perso. Un perso verrouillé est grisé et affiche son
 * défi (avec la progression s'il est chiffré). Comme les autres menus, le clic est seulement
 * mémorisé ; la scène le lit pendant son update.
 */
export class CharacterOverlay {
  private clicked: number | null = null;
  private backClicked = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly cardsEl: HTMLElement,
    backButton: HTMLButtonElement,
  ) {
    backButton.addEventListener('click', () => (this.backClicked = true));
  }

  /** Créer des éléments ici est sans risque : seulement à l'ouverture de l'écran, hors partie. */
  show(characters: readonly CharacterDef[], profile: Readonly<Profile>): void {
    this.clicked = null;
    this.backClicked = false;
    this.cardsEl.replaceChildren(
      ...characters.map((character, index) => {
        const unlocked = isUnlocked(character, profile);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'choice character-card';
        card.disabled = !unlocked;
        card.style.borderColor = unlocked ? character.weapon.color : '';
        card.addEventListener('click', () => (this.clicked = index));

        const key = document.createElement('span');
        key.className = 'choice-key';
        key.textContent = String(index + 1);
        const name = document.createElement('span');
        name.className = 'choice-title';
        name.textContent = unlocked ? character.name : `🔒 ${character.name}`;
        const weapon = document.createElement('span');
        weapon.className = 'choice-level';
        weapon.textContent = `Arme : ${character.weapon.name}`;
        const desc = document.createElement('span');
        desc.className = 'choice-desc';
        if (unlocked) {
          desc.textContent = character.weapon.description;
        } else {
          const progress = challengeProgress(character, profile);
          desc.textContent = progress
            ? `${character.challengeText} — ${Math.min(progress.current, progress.target)} / ${progress.target}`
            : character.challengeText;
        }
        card.append(key, name, weapon, desc);
        return card;
      }),
    );
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Index de la carte cliquée depuis la dernière lecture, ou null. */
  takeChoice(): number | null {
    const index = this.clicked;
    this.clicked = null;
    return index;
  }

  /** Vrai une seule fois après un clic sur Retour. */
  takeBack(): boolean {
    const back = this.backClicked;
    this.backClicked = false;
    return back;
  }
}
