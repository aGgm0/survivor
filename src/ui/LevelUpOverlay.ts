import type { StatChange } from '../systems/choiceDetails';
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
  /** Niveau actuel (0 : pas encore possédé) et max : les crans sous le nom */
  readonly level?: number;
  readonly maxLevel?: number;
  /** Ce qui change, avant → après */
  readonly changes?: readonly StatChange[];
  /** Bas de la carte : ce que l'upgrade touche, ou l'emplacement qu'il prend */
  readonly scope?: string;
  /** Pourquoi la carte apparaît (soin, or : tout est au maximum) */
  readonly reason?: string;
}

/** Étiquette et style de carte selon la sorte d'upgrade (voir UpgradeChoice). */
const CARD_STYLES: Readonly<Record<string, { readonly tag: string; readonly css: string }>> = {
  newWeapon: { tag: 'Nouvelle arme', css: 'choice-weapon' },
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
    // Créer des éléments ici est sans risque : ça n'arrive qu'au level up, pas à chaque frame.
    this.choicesEl.replaceChildren(
      ...choices.map((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        const style = choice.kind ? CARD_STYLES[choice.kind] : undefined;
        button.className = style ? `choice ${style.css}` : 'choice';
        // Les cartes arrivent une par une (décalage lu par le CSS).
        button.style.setProperty('--card-index', String(index));
        if (choice.accent) button.style.setProperty('--accent', choice.accent);

        // Haut : badge de la sorte. Les touches 1-2-3 marchent toujours, mais ne sont plus écrites
        // (2026-11-27 : aucun raccourci clavier affiché à l'écran).
        const top = el('span', 'choice-top');
        if (style) top.append(el('span', 'choice-badge', style.tag));

        // Icône dans sa case, nom, puis crans de niveau ou tampon de mutation.
        const head = el('span', 'choice-head');
        const iconBox = el('span', 'choice-icon');
        if (choice.iconId) iconBox.append(iconElement(choice.iconId, ''));
        const names = el('span', 'choice-names');
        const isMutation = choice.kind === 'mutation';
        names.append(
          el('span', 'choice-title', isMutation ? choice.title.replace(/^★\s*/, '') : choice.title),
        );
        if (isMutation && choice.weaponName) {
          names.append(el('span', 'choice-weapon-name', `de ${choice.weaponName}`));
        }
        if (choice.level !== undefined && choice.maxLevel !== undefined) {
          names.append(
            pips(choice.level, choice.maxLevel),
            el('span', 'choice-level', levelText(choice)),
          );
        } else if (!isMutation && choice.levelText) {
          names.append(el('span', 'choice-level', choice.levelText));
        }
        head.append(iconBox, names);
        button.append(top, head);
        if (isMutation) button.append(el('span', 'choice-stamp', '★ Niv 6 · définitif'));
        if (choice.reason) button.append(el('span', 'choice-reason', choice.reason));

        button.append(el('span', 'choice-sep'));
        // Effet : chiffres mis en avant (textContent par morceau, jamais d'innerHTML).
        const desc = el('span', 'choice-desc');
        desc.append(
          ...splitStats(choice.description).map((part) =>
            part.stat ? el('span', 'choice-stat', part.text) : part.text,
          ),
        );
        button.append(desc);
        for (const c of choice.changes ?? []) {
          const line = el('span', 'choice-change');
          line.append(`${c.label} : ${c.before} → `, el('span', 'choice-stat', c.after));
          button.append(line);
        }
        if (choice.scope) {
          // Une ligne par morceau (« Orbite · tourne autour de toi · emplacement 3 / 4 »)
          const scope = el('span', 'choice-scope');
          for (const part of choice.scope.split(' · ')) {
            scope.append(el('span', 'choice-scope-part', part));
          }
          button.append(scope);
        }
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
    this.rerollButton.textContent = `Relancer · ${left}`;
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

/** Petit élément avec sa classe et son texte (seulement au level up : pas dans la boucle). */
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Crans de niveau : remplis jusqu'au niveau actuel, le suivant (celui qu'on prend) clignote. */
function pips(level: number, maxLevel: number): HTMLElement {
  const row = el('span', 'choice-pips');
  for (let i = 0; i < maxLevel; i++) {
    row.append(el('span', i < level ? 'pip pip-on' : i === level ? 'pip pip-next' : 'pip'));
  }
  return row;
}

/** « Nouveau » pour une arme ou un passif pas encore possédé, sinon « Niv 2 → 3 ». */
function levelText(choice: ChoiceView): string {
  const level = choice.level ?? 0;
  return level === 0 ? 'Nouveau' : `Niv ${level} → ${level + 1}`;
}
