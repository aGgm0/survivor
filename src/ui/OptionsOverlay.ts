import { SETTING_LABELS, type SettingKey, type Settings } from '../data/settings';

/** Ce que le joueur peut demander depuis l'écran Options. */
export type OptionsAction =
  { readonly kind: 'toggle'; readonly key: SettingKey } | { readonly kind: 'back' };

/**
 * Écran Options : une case à cocher par réglage + Retour. Comme les autres menus, un clic est
 * seulement mémorisé ; la scène le lit pendant son update, change le réglage et le sauvegarde.
 */
export class OptionsOverlay {
  private action: OptionsAction | null = null;
  private readonly boxes = new Map<SettingKey, HTMLInputElement>();

  constructor(
    private readonly el: HTMLElement,
    listEl: HTMLElement,
    backButton: HTMLButtonElement,
  ) {
    // Les cases sont créées une seule fois, à partir de la liste des réglages (data/settings.ts).
    for (const [key, label] of SETTING_LABELS) {
      const row = document.createElement('label');
      row.className = 'option-row';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.addEventListener('change', () => (this.action = { kind: 'toggle', key }));
      const text = document.createElement('span');
      text.textContent = label;
      row.append(box, text);
      listEl.append(row);
      this.boxes.set(key, box);
    }
    backButton.addEventListener('click', () => (this.action = { kind: 'back' }));
  }

  show(settings: Readonly<Settings>): void {
    this.action = null;
    this.refresh(settings);
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Recoche les cases selon les réglages réels (la source de vérité, c'est la scène). */
  refresh(settings: Readonly<Settings>): void {
    for (const [key, box] of this.boxes) box.checked = settings[key];
  }

  /** L'action cliquée depuis la dernière lecture, ou null. */
  takeAction(): OptionsAction | null {
    const action = this.action;
    this.action = null;
    return action;
  }
}
